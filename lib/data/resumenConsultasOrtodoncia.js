import { supabase } from "@/lib/supabaseClient";
import { fechaDeHoyISO } from "@/lib/agenda";
import { ESTADOS_CONSULTA, obtenerGestionConsultas } from "@/lib/data/consultasOrtodoncia";

// Resumen de las CONSULTAS de Ortodoncia de un mes: cuántas se agendaron, cuántas se hicieron, si quedaron registradas en
// Caja (las gratuitas, con importe $0), qué pasó después (instaló, agendó, lo piensa...) y a quién falta contactar.
// Pensado para seguir de cerca la promoción de consultas gratis de noviembre 2026.

export const CONCEPTO_CONSULTA = "Consulta de ortodoncia";
const PRESENCIAS_QUE_VINO = ["En espera", "En consultorio", "Finalizado"];
// Precio normal de la consulta, para calcular cuánto se «regaló» (se toma lo cobrado en los meses anteriores).
const PRECIO_CONSULTA_POR_DEFECTO = 20000;
// Días sin contactar a quien ya vino a partir de los cuales se marca como atrasado.
export const DIAS_PARA_CONTACTAR = 2;

export const SITUACIONES = {
  VINO: "Vino",
  POR_VENIR: "Por venir",
  SIN_MARCAR: "Sin marcar",
  CANCELO: "Canceló o reprogramó",
};

function rangoDelMes(mes) {
  const [a, m] = mes.split("-").map(Number);
  const ultimo = new Date(a, m, 0).getDate();
  return { desde: `${mes}-01`, hasta: `${mes}-${String(ultimo).padStart(2, "0")}` };
}

function diasEntre(desdeISO, hastaISO) {
  return Math.round((new Date(`${hastaISO}T00:00:00`) - new Date(`${desdeISO}T00:00:00`)) / 86400000);
}

async function enLotes(ids, consultaPorLote) {
  const filas = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await consultaPorLote(ids.slice(i, i + 100));
    if (error) throw error;
    filas.push(...(data || []));
  }
  return filas;
}

const PESO_SITUACION = { [SITUACIONES.VINO]: 0, [SITUACIONES.POR_VENIR]: 1, [SITUACIONES.SIN_MARCAR]: 2, [SITUACIONES.CANCELO]: 3 };

export async function obtenerResumenConsultas(mes) {
  const hoy = fechaDeHoyISO();
  const { desde, hasta } = rangoDelMes(mes);

  const [turnosRes, cobrosRes, gestion, preciosRes] = await Promise.all([
    supabase
      .from("turnos_ortodoncia")
      .select(
        `id, fecha, hora_inicio, estado, presencia, asistencia, paciente_id,
         paciente:pacientes_ortodoncia(nombre, whatsapp, estado_paciente, fecha_instalacion, es_ortopedia, ortodoncista:profesionales!ortodoncista_id(nombre)),
         ortodoncista:profesionales!ortodoncista_id(nombre)`
      )
      .eq("concepto", CONCEPTO_CONSULTA)
      .gte("fecha", desde)
      .lte("fecha", hasta),
    supabase
      .from("caja_ortodoncia")
      .select(
        `paciente_id, fecha, importe, observaciones,
         paciente:pacientes_ortodoncia(nombre, whatsapp, estado_paciente, fecha_instalacion, es_ortopedia, ortodoncista:profesionales!ortodoncista_id(nombre)),
         ortodoncista:profesionales!ortodoncista_id(nombre)`
      )
      .eq("concepto", CONCEPTO_CONSULTA)
      .gte("fecha", desde)
      .lte("fecha", hasta),
    obtenerGestionConsultas(),
    supabase.from("caja_ortodoncia").select("importe").eq("concepto", CONCEPTO_CONSULTA).gt("importe", 0).lt("fecha", desde).order("fecha", { ascending: false }).limit(60),
  ]);
  if (turnosRes.error) throw turnosRes.error;
  if (cobrosRes.error) throw cobrosRes.error;

  // Precio normal: el importe que más se cobró en las consultas anteriores.
  const veces = {};
  for (const c of preciosRes.data || []) veces[Number(c.importe)] = (veces[Number(c.importe)] || 0) + 1;
  const precioNormal = Number(Object.entries(veces).sort((a, b) => b[1] - a[1])[0]?.[0]) || PRECIO_CONSULTA_POR_DEFECTO;

  // Una consulta por paciente: la «mejor» situación entre sus turnos de consulta del mes.
  const porPaciente = new Map();
  const agregar = (pacienteId, datos) => {
    const actual = porPaciente.get(pacienteId);
    if (!actual || PESO_SITUACION[datos.situacion] < PESO_SITUACION[actual.situacion]) porPaciente.set(pacienteId, { ...(actual || {}), ...datos });
  };
  for (const t of turnosRes.data) {
    if (!t.paciente_id || t.paciente?.es_ortopedia) continue;
    const vino = PRESENCIAS_QUE_VINO.includes(t.presencia) && t.asistencia !== "No asistió";
    let situacion;
    if (vino) situacion = SITUACIONES.VINO;
    else if (t.estado !== "Agendado" || t.asistencia === "Canceló") situacion = SITUACIONES.CANCELO;
    else if (t.asistencia === "No asistió" || t.fecha < hoy) situacion = SITUACIONES.SIN_MARCAR;
    else situacion = SITUACIONES.POR_VENIR;
    agregar(t.paciente_id, {
      pacienteId: t.paciente_id,
      nombre: t.paciente?.nombre?.trim() || "(sin nombre)",
      whatsapp: t.paciente?.whatsapp || "",
      estadoFicha: t.paciente?.estado_paciente,
      ortodoncista: t.ortodoncista?.nombre || t.paciente?.ortodoncista?.nombre || "Sin asignar",
      fechaConsulta: t.fecha,
      situacion,
    });
  }
  // Consultas cobradas (o registradas en $0) que no tienen turno de consulta ese mes: cuentan como que vinieron.
  const cobroPorPaciente = {};
  for (const c of cobrosRes.data) {
    if (c.paciente?.es_ortopedia) continue;
    (cobroPorPaciente[c.paciente_id] ||= []).push(c);
    if (!porPaciente.has(c.paciente_id)) {
      agregar(c.paciente_id, {
        pacienteId: c.paciente_id,
        nombre: c.paciente?.nombre?.trim() || "(sin nombre)",
        whatsapp: c.paciente?.whatsapp || "",
        estadoFicha: c.paciente?.estado_paciente,
        ortodoncista: c.ortodoncista?.nombre || c.paciente?.ortodoncista?.nombre || "Sin asignar",
        fechaConsulta: c.fecha,
        situacion: SITUACIONES.VINO,
      });
    }
  }

  const ids = [...porPaciente.keys()];
  // Qué pasó después: instalaciones cobradas y turnos de instalación agendados.
  const [instalaciones, turnosInstalacion] = await Promise.all([
    enLotes(ids, (lote) =>
      supabase.from("caja_ortodoncia").select("paciente_id, fecha, concepto").in("paciente_id", lote).in("concepto", ["Instalación (contado)", "Instalación (2 cuotas)"]).gte("fecha", desde)
    ),
    enLotes(ids, (lote) =>
      supabase.from("turnos_ortodoncia").select("paciente_id, fecha, concepto, estado").in("paciente_id", lote).eq("estado", "Agendado").ilike("concepto", "Instalación%").gte("fecha", desde)
    ),
  ]);

  const consultas = [...porPaciente.values()].map((c) => {
    const cobros = cobroPorPaciente[c.pacienteId] || [];
    const registrada = cobros.length > 0;
    const importe = cobros.reduce((a, x) => a + Number(x.importe), 0);
    const instalo = instalaciones.find((i) => i.paciente_id === c.pacienteId && i.fecha >= c.fechaConsulta)?.fecha || null;
    const instalacionAgendada = turnosInstalacion.filter((t) => t.paciente_id === c.pacienteId && t.fecha >= hoy).map((t) => t.fecha).sort()[0] || null;
    const seg = gestion.porPaciente[c.pacienteId];
    const estadoSeguimiento = seg?.estado || "Por contactar";
    let resultado = null;
    if (c.situacion === SITUACIONES.VINO) {
      if (instalo) resultado = "Instaló";
      else if (instalacionAgendada || c.estadoFicha === "Activo") resultado = instalacionAgendada ? "Instalación agendada" : "Ya está en tratamiento";
      else resultado = estadoSeguimiento;
    }
    const diasDesde = c.situacion === SITUACIONES.VINO ? diasEntre(c.fechaConsulta, hoy) : null;
    const atrasado =
      c.situacion === SITUACIONES.VINO && !instalo && !instalacionAgendada && c.estadoFicha !== "Activo" && estadoSeguimiento === "Por contactar" && diasDesde >= DIAS_PARA_CONTACTAR;
    return {
      ...c,
      registrada,
      gratis: registrada && importe === 0,
      importe,
      instalo,
      instalacionAgendada,
      estadoSeguimiento,
      fechaUltimoContacto: seg?.fecha_ultimo_contacto || null,
      nota: seg?.nota || "",
      resultado,
      diasDesde,
      atrasado,
      // Vino pero nadie la cargó en Caja: hay que registrarla (aunque sea en $0) para llevar la cuenta.
      sinRegistrarEnCaja: c.situacion === SITUACIONES.VINO && !registrada,
    };
  });
  consultas.sort((a, b) => (a.fechaConsulta < b.fechaConsulta ? 1 : a.fechaConsulta > b.fechaConsulta ? -1 : a.nombre.localeCompare(b.nombre, "es")));

  // ---------- totales ----------
  const vinieron = consultas.filter((c) => c.situacion === SITUACIONES.VINO);
  const cuenta = (f) => consultas.filter(f).length;
  const embudo = {
    vinieron: vinieron.length,
    instalaron: vinieron.filter((c) => c.resultado === "Instaló").length,
    agendaron: vinieron.filter((c) => c.resultado === "Instalación agendada" || c.resultado === "Ya está en tratamiento").length,
    quiereInstalar: vinieron.filter((c) => c.resultado === "Quiere instalar").length,
    loPiensa: vinieron.filter((c) => c.resultado === "Lo está pensando").length,
    mensajeEnviado: vinieron.filter((c) => c.resultado === "Mensaje enviado").length,
    sinRespuesta: vinieron.filter((c) => c.resultado === "Sin respuesta").length,
    porContactar: vinieron.filter((c) => c.resultado === "Por contactar").length,
    noVaAHacer: vinieron.filter((c) => c.resultado === "No va a hacer ortodoncia").length,
  };
  const gratis = consultas.filter((c) => c.gratis);
  const porOrtodoncista = {};
  for (const c of consultas) {
    const o = (porOrtodoncista[c.ortodoncista] ||= { nombre: c.ortodoncista, agendadas: 0, vinieron: 0, instalaron: 0, agendaron: 0 });
    o.agendadas += 1;
    if (c.situacion === SITUACIONES.VINO) {
      o.vinieron += 1;
      if (c.resultado === "Instaló") o.instalaron += 1;
      if (c.resultado === "Instalación agendada" || c.resultado === "Ya está en tratamiento") o.agendaron += 1;
    }
  }
  return {
    mes,
    hoy,
    consultas,
    precioNormal,
    totales: {
      pacientes: consultas.length,
      vinieron: vinieron.length,
      porVenir: cuenta((c) => c.situacion === SITUACIONES.POR_VENIR),
      sinMarcar: cuenta((c) => c.situacion === SITUACIONES.SIN_MARCAR),
      cancelaron: cuenta((c) => c.situacion === SITUACIONES.CANCELO),
      gratis: gratis.length,
      pagas: cuenta((c) => c.registrada && !c.gratis),
      valorRegalado: gratis.length * precioNormal,
      sinRegistrarEnCaja: cuenta((c) => c.sinRegistrarEnCaja),
      atrasadas: cuenta((c) => c.atrasado),
    },
    embudo,
    porOrtodoncista: Object.values(porOrtodoncista).sort((a, b) => b.vinieron - a.vinieron),
    estadosSeguimiento: ESTADOS_CONSULTA,
  };
}
