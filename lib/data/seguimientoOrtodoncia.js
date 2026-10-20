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
    traerTodo("turnos_ortodoncia", "paciente_id, fecha, estado, presencia"),
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
  const registrar = (id, fecha) => {
    if (id && fecha && fecha <= hoy && (!ultimaVisita[id] || fecha > ultimaVisita[id])) ultimaVisita[id] = fecha;
  };
  for (const c of cobros) if (c.concepto !== "Pago adelantado") registrar(c.paciente_id, c.fecha);
  for (const p of prestaciones) registrar(p.paciente_ortodoncia_id, p.fecha);
  const proximoTurno = {};
  for (const t of turnos) {
    if (t.estado !== "Agendado" || !t.paciente_id) continue;
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
    let situacion;
    if (t.asistencia === "No asistió") situacion = ESTADOS_ASISTENCIA.NO_ASISTIO;
    else if (PRESENCIAS_QUE_VINO.includes(t.presencia)) situacion = ESTADOS_ASISTENCIA.ASISTIO;
    else if (t.fecha < hoy) situacion = ESTADOS_ASISTENCIA.SIN_MARCAR;
    else situacion = ESTADOS_ASISTENCIA.POR_VENIR;
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
