import { supabase } from "@/lib/supabaseClient";
import { fechaDeHoyISO } from "@/lib/agenda";

// Seguimiento de los pacientes de Ortodoncia: quién viene, quién se alejó y quién nunca figuró
// en la app. Todo se calcula en el momento con lo que hay cargado (no se guarda nada aparte).
//
// Una "visita" cuenta cuando hay: un cobro de ortodoncia (sin los pagos adelantados), un turno
// marcado en espera / en consultorio / finalizado, o un "qué se hizo" cargado por el
// ortodoncista. Un turno agendado que nadie marcó como presente no cuenta. La app tiene datos
// de visitas desde el 26/8/2026; antes de eso solo está la grilla de Controles del cuaderno
// (el último mes marcado "Pago").

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const PRESENCIAS_QUE_VINO = ["En espera", "En consultorio", "Finalizado"];

export const SEGMENTOS = {
  AL_DIA: "Al día",
  SE_ALEJO: "Venía y se alejó",
  SOLO_CUADERNO: "Solo figura en el cuaderno",
  SIN_MOVIMIENTO: "Sin ningún movimiento",
};

async function traerTodo(tabla, columnas, filtrar = (q) => q) {
  const filas = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await filtrar(supabase.from(tabla).select(columnas)).range(desde, desde + 999);
    if (error) throw error;
    filas.push(...data);
    if (data.length < 1000) break;
  }
  return filas;
}

function diasEntre(desdeISO, hastaISO) {
  return Math.round((new Date(`${hastaISO}T00:00:00`) - new Date(`${desdeISO}T00:00:00`)) / 86400000);
}

function maxFecha(...fechas) {
  return fechas.filter(Boolean).sort().slice(-1)[0] || null;
}

export async function obtenerSeguimientoOrtodoncia() {
  const hoy = fechaDeHoyISO();
  const [pacientes, cobros, turnos, prestaciones, controles, profesionales] = await Promise.all([
    traerTodo(
      "pacientes_ortodoncia",
      "id, nombre, whatsapp, estado_paciente, fecha_instalacion, ortodoncista_id, origen_paciente"
    ),
    traerTodo("caja_ortodoncia", "paciente_id, fecha, concepto"),
    traerTodo("turnos_ortodoncia", "paciente_id, fecha, estado, presencia, asistencia"),
    traerTodo("prestaciones_realizadas_agenda", "paciente_ortodoncia_id, fecha", (q) =>
      q.not("paciente_ortodoncia_id", "is", null)
    ),
    traerTodo("controles_ortodoncia", `paciente_id, anio, ${MESES.join(", ")}`),
    traerTodo("profesionales", "id, nombre"),
  ]);

  const nombreProfesional = Object.fromEntries(profesionales.map((p) => [p.id, p.nombre]));

  const ultimoMesPago = {};
  for (const c of controles) {
    MESES.forEach((m, i) => {
      if (!c[m]) return;
      const clave = `${c.anio}-${String(i + 1).padStart(2, "0")}`;
      if (!ultimoMesPago[c.paciente_id] || clave > ultimoMesPago[c.paciente_id]) ultimoMesPago[c.paciente_id] = clave;
    });
  }

  const ultimaVisita = {};
  const todasLasVisitas = {}; // paciente -> fechas de todas sus visitas
  const turnosDelPaciente = {}; // paciente -> turnos agendados con su situación
  const registrar = (id, fecha) => {
    if (!id || !fecha || fecha > hoy) return;
    if (!ultimaVisita[id] || fecha > ultimaVisita[id]) ultimaVisita[id] = fecha;
    (todasLasVisitas[id] ||= []).push(fecha);
  };
  for (const c of cobros) if (c.concepto !== "Pago adelantado") registrar(c.paciente_id, c.fecha);
  for (const p of prestaciones) registrar(p.paciente_ortodoncia_id, p.fecha);
  const proximoTurno = {};
  for (const t of turnos) {
    if (t.estado !== "Agendado" || !t.paciente_id) continue;
    (turnosDelPaciente[t.paciente_id] ||= []).push({ fecha: t.fecha, situacion: situacionDelTurno(t, hoy) });
    if (PRESENCIAS_QUE_VINO.includes(t.presencia)) registrar(t.paciente_id, t.fecha);
    if (t.fecha >= hoy && (!proximoTurno[t.paciente_id] || t.fecha < proximoTurno[t.paciente_id])) {
      proximoTurno[t.paciente_id] = t.fecha;
    }
  }

  return pacientes.map((p) => {
    const visita = ultimaVisita[p.id] || null;
    const mesPago = ultimoMesPago[p.id] || null;
    const dias = visita ? diasEntre(visita, hoy) : null;
    let segmento;
    if (visita) segmento = dias <= 30 ? SEGMENTOS.AL_DIA : SEGMENTOS.SE_ALEJO;
    else segmento = mesPago ? SEGMENTOS.SOLO_CUADERNO : SEGMENTOS.SIN_MOVIMIENTO;
    return {
      id: p.id,
      nombre: p.nombre,
      whatsapp: p.whatsapp,
      estado: p.estado_paciente,
      ortodoncistaId: p.ortodoncista_id,
      ortodoncista: nombreProfesional[p.ortodoncista_id] || "Sin asignar",
      fechaInstalacion: p.fecha_instalacion,
      ultimaVisita: visita,
      diasDesdeUltimaVisita: dias,
      ultimoMesPago: mesPago,
      proximoTurno: proximoTurno[p.id] || null,
      visitas: todasLasVisitas[p.id] || [],
      turnos: turnosDelPaciente[p.id] || [],
      segmento,
      ultimoMovimiento: maxFecha(visita, mesPago ? `${mesPago}-01` : null),
    };
  });
}

// ---------- Asistencia a los turnos ----------

export const ESTADOS_ASISTENCIA = {
  ASISTIO: "Asistió",
  NO_ASISTIO: "No asistió",
  SIN_MARCAR: "Sin marcar",
  POR_VENIR: "Por venir",
};

function situacionDelTurno(t, hoy) {
  if (t.asistencia === "No asistió") return ESTADOS_ASISTENCIA.NO_ASISTIO;
  if (PRESENCIAS_QUE_VINO.includes(t.presencia)) return ESTADOS_ASISTENCIA.ASISTIO;
  if (t.fecha < hoy) return ESTADOS_ASISTENCIA.SIN_MARCAR;
  return ESTADOS_ASISTENCIA.POR_VENIR;
}

// Los turnos de Ortodoncia de un rango, cada uno con su situación:
//  · Asistió: la secretaria lo marcó en espera / en consultorio / finalizado.
//  · No asistió: marcado así en la agenda.
//  · Sin marcar: la fecha ya pasó y nadie marcó si vino o no.
//  · Por venir: todavía no llegó la fecha (o es hoy y no llegó).
// Los cancelados y reprogramados no cuentan: se devuelven aparte.
export async function obtenerAsistenciaTurnosOrtodoncia(desde, hasta) {
  const hoy = fechaDeHoyISO();
  const filas = await traerTodo(
    "turnos_ortodoncia",
    `id, fecha, hora_inicio, concepto, estado, presencia, asistencia, paciente_id,
     paciente:pacientes_ortodoncia(nombre),
     ortodoncista:profesionales!ortodoncista_id(nombre)`,
    (q) => q.gte("fecha", desde).lte("fecha", hasta).order("fecha").order("hora_inicio")
  );
  const turnos = [];
  let cancelados = 0;
  for (const t of filas) {
    if (t.estado !== "Agendado") {
      if (t.estado === "Cancelado" || t.estado === "Reprogramado") cancelados += 1;
      continue;
    }
    const situacion = situacionDelTurno(t, hoy);
    turnos.push({
      id: t.id,
      fecha: t.fecha,
      hora: (t.hora_inicio || "").slice(0, 5),
      concepto: t.concepto,
      pacienteId: t.paciente_id,
      paciente: t.paciente?.nombre ?? "(sin paciente)",
      ortodoncista: t.ortodoncista?.nombre ?? "Sin asignar",
      situacion,
    });
  }
  return { turnos, cancelados };
}

// ---------- Estado de cada paciente en un mes ----------

export const ESTADOS_MES = {
  ASISTIO: "Ya asistió",
  FALTA_ASISTIR: "Tiene turno, falta asistir",
  TURNO_SIN_ASISTIR: "Su turno ya pasó y no asistió",
  SIN_TURNO: "Sin turno este mes",
};

// Clasifica a un paciente en el mes elegido (AAAA-MM). Orden de prioridad:
//  1) vino ese mes (cobro, turno marcado como presente o "qué se hizo") → Ya asistió
//  2) tiene un turno de hoy o futuro ese mes → Tiene turno, falta asistir
//  3) tuvo turno ese mes que ya pasó sin que vino ("No asistió" o sin marcar) → Su turno ya pasó
//  4) ninguna de las anteriores → Sin turno este mes (a esos hay que escribirles)
export function estadoEnElMes(paciente, mes) {
  const delMes = (fecha) => fecha.slice(0, 7) === mes;
  if (paciente.visitas.some(delMes)) return ESTADOS_MES.ASISTIO;
  const turnos = paciente.turnos.filter((t) => delMes(t.fecha));
  if (turnos.some((t) => t.situacion === ESTADOS_ASISTENCIA.POR_VENIR)) return ESTADOS_MES.FALTA_ASISTIR;
  if (turnos.length > 0) return ESTADOS_MES.TURNO_SIN_ASISTIR;
  return ESTADOS_MES.SIN_TURNO;
}

// ---------- Evolución mes a mes ----------

const CONCEPTOS_INSTALACION = ["Instalación (contado)", "Instalación (2 cuotas)", "Continuación de ortodoncia"];

// Primer mes con datos propios de la app (cobros y turnos desde fines de agosto 2026). Antes de
// eso solo existe la grilla de Controles del cuaderno.
export const MES_INICIO_APP = "2026-08";
const MES_INICIO_GRILLA = "2026-06";

function mesesDesde(inicio, hasta) {
  const lista = [];
  let [a, m] = inicio.split("-").map(Number);
  const [aFin, mFin] = hasta.split("-").map(Number);
  while (a < aFin || (a === aFin && m <= mFin)) {
    lista.push(`${a}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      a += 1;
    }
  }
  return lista;
}

// Una fila por mes: controles pagados (grilla del cuaderno + app), plata cobrada por tipo,
// turnos asistidos y pacientes que vinieron. El mes en curso es parcial (hasta hoy).
export async function obtenerEvolucionMensualOrtodoncia() {
  const hoy = fechaDeHoyISO();
  const mesActual = hoy.slice(0, 7);
  const [cobros, turnos, prestaciones, controles] = await Promise.all([
    traerTodo("caja_ortodoncia", "paciente_id, fecha, concepto, importe"),
    traerTodo("turnos_ortodoncia", "paciente_id, fecha, estado, presencia, asistencia"),
    traerTodo("prestaciones_realizadas_agenda", "paciente_ortodoncia_id, fecha", (q) =>
      q.not("paciente_ortodoncia_id", "is", null)
    ),
    traerTodo("controles_ortodoncia", `paciente_id, anio, ${MESES.join(", ")}`),
  ]);

  const filas = Object.fromEntries(
    mesesDesde(MES_INICIO_GRILLA, mesActual).map((mes) => [
      mes,
      {
        mes,
        esParcial: mes === mesActual,
        tieneDatosApp: mes >= MES_INICIO_APP,
        pacientesControlPagado: 0,
        controlesCobrados: 0,
        pacientesQuePagaronControl: new Set(),
        plataControles: 0,
        plataInstalaciones: 0,
        cobrosInstalacion: 0,
        plataOtros: 0,
        plataTotal: 0,
        asistieron: 0,
        noAsistieron: 0,
        sinMarcar: 0,
        porVenir: 0,
        pacientesQueVinieron: new Set(),
      },
    ])
  );

  for (const c of controles) {
    MESES.forEach((m, i) => {
      const fila = filas[`${c.anio}-${String(i + 1).padStart(2, "0")}`];
      if (fila && c[m]) fila.pacientesControlPagado += 1;
    });
  }
  for (const c of cobros) {
    const fila = filas[c.fecha.slice(0, 7)];
    if (!fila) continue;
    const importe = Number(c.importe) || 0;
    fila.plataTotal += importe;
    if (c.concepto === "Control") {
      fila.controlesCobrados += 1;
      fila.plataControles += importe;
      fila.pacientesQuePagaronControl.add(c.paciente_id);
    } else if (CONCEPTOS_INSTALACION.includes(c.concepto)) {
      fila.cobrosInstalacion += 1;
      fila.plataInstalaciones += importe;
    } else {
      fila.plataOtros += importe;
    }
    if (c.concepto !== "Pago adelantado" && c.fecha <= hoy) fila.pacientesQueVinieron.add(c.paciente_id);
  }
  for (const p of prestaciones) {
    const fila = filas[p.fecha.slice(0, 7)];
    if (fila && p.fecha <= hoy) fila.pacientesQueVinieron.add(p.paciente_ortodoncia_id);
  }
  for (const t of turnos) {
    const fila = filas[t.fecha.slice(0, 7)];
    if (!fila || t.estado !== "Agendado") continue;
    const situacion = situacionDelTurno(t, hoy);
    if (situacion === ESTADOS_ASISTENCIA.ASISTIO) {
      fila.asistieron += 1;
      if (t.paciente_id) fila.pacientesQueVinieron.add(t.paciente_id);
    } else if (situacion === ESTADOS_ASISTENCIA.NO_ASISTIO) fila.noAsistieron += 1;
    else if (situacion === ESTADOS_ASISTENCIA.SIN_MARCAR) fila.sinMarcar += 1;
    else fila.porVenir += 1;
  }

  return Object.values(filas).map((f) => ({
    ...f,
    pacientesQuePagaronControl: f.pacientesQuePagaronControl.size,
    pacientesQueVinieron: f.pacientesQueVinieron.size,
    tasaAsistencia:
      f.asistieron + f.noAsistieron > 0 ? Math.round((f.asistieron / (f.asistieron + f.noAsistieron)) * 100) : null,
  }));
}
