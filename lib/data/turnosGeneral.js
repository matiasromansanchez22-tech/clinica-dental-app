import { supabase } from "@/lib/supabaseClient";
import { conMarcaDeConsentimiento } from "@/lib/data/consentimientos";
import { conMarcaDePresupuesto } from "@/lib/data/marcasAgenda";

const SELECT_TURNO = `id, fecha, hora_inicio, duracion_min, consultorio, tipo_atencion, cobertura,
  prioridad, estado, confirmacion, presencia, asistencia, observaciones, motivo, prestaciones,
  paciente_id, profesional_de_turno_id, profesional_responsable_id,
  paciente:pacientes(apellido_y_nombre),
  profesional_de_turno:profesionales!profesional_de_turno_id(nombre),
  profesional_responsable:profesionales!profesional_responsable_id(nombre)`;

function mapearFilaTurno(fila) {
  return {
    id: fila.id,
    fecha: fila.fecha,
    horaInicio: fila.hora_inicio.slice(0, 5), // "09:00:00" -> "09:00"
    duracionMin: fila.duracion_min,
    consultorio: fila.consultorio,
    pacienteId: fila.paciente_id,
    paciente: fila.paciente?.apellido_y_nombre ?? "(sin paciente asignado)",
    profesionalDeTurnoId: fila.profesional_de_turno_id,
    profesionalDeTurno: fila.profesional_de_turno?.nombre ?? "(sin asignar)",
    profesionalResponsableId: fila.profesional_responsable_id,
    profesionalResponsable: fila.profesional_responsable?.nombre ?? null,
    tipoAtencion: fila.tipo_atencion,
    cobertura: fila.cobertura,
    prestaciones: fila.prestaciones || [],
    prioridad: fila.prioridad,
    estado: fila.estado,
    confirmacion: fila.confirmacion,
    presencia: fila.presencia,
    asistencia: fila.asistencia,
    observaciones: fila.observaciones,
    motivo: fila.motivo,
  };
}

// Pedidos de turno de Odontología General hechos desde la página pública que Recepción todavía no resolvió. Mientras estén
// pendientes "congelan" su horario: se muestran en la Agenda como un turno reservado (pedidoOnline: true) y cuentan para los choques
// de horario. Quien no tiene permiso para verlos recibe [].
export async function obtenerPedidosOnlineGeneralComoTurnos(fechaInicio, fechaFin) {
  const { data, error } = await supabase
    .from("solicitudes_turno_ortodoncia")
    .select("id, nombre, whatsapp, fecha, hora_inicio, duracion_min, profesional_id, consultorio, motivo, profesional:profesionales!profesional_id(nombre)")
    .eq("estado", "Pendiente")
    .eq("area", "General")
    .gte("fecha", fechaInicio)
    .lte("fecha", fechaFin);
  if (error) return [];
  return data.map((f) => ({
    id: `pedido-${f.id}`,
    pedidoOnline: true,
    pedidoId: f.id,
    fecha: f.fecha,
    horaInicio: String(f.hora_inicio).slice(0, 5),
    duracionMin: f.duracion_min,
    consultorio: f.consultorio,
    pacienteId: null,
    paciente: f.nombre,
    profesionalDeTurnoId: f.profesional_id,
    profesionalDeTurno: f.profesional?.nombre ?? "(sin asignar)",
    profesionalResponsableId: null,
    profesionalResponsable: null,
    tipoAtencion: f.motivo || "Consulta",
    cobertura: null,
    prestaciones: [],
    prioridad: "Normal",
    estado: "Pendiente",
    confirmacion: "Sin confirmar",
    presencia: "Pendiente",
    asistencia: "Pendiente",
    observaciones: null,
    motivo: f.motivo,
    sobreturno: false,
  }));
}

// conPedidosOnline: suma los pedidos online pendientes como turnos reservados (para la Agenda y los choques de horario).
export async function obtenerTurnosGeneralPorFecha(fecha, { conPedidosOnline = false } = {}) {
  const { data, error } = await supabase
    .from("turnos_general")
    .select(SELECT_TURNO)
    .eq("fecha", fecha)
    .order("hora_inicio");

  if (error) throw error;
  const turnos = await conMarcaDePresupuesto(await conMarcaDeConsentimiento("general", data.map(mapearFilaTurno)));
  return conPedidosOnline ? [...turnos, ...(await obtenerPedidosOnlineGeneralComoTurnos(fecha, fecha))] : turnos;
}

export async function obtenerTurnosGeneralPorRango(fechaInicio, fechaFin, { conPedidosOnline = false } = {}) {
  const { data, error } = await supabase
    .from("turnos_general")
    .select(SELECT_TURNO)
    .gte("fecha", fechaInicio)
    .lte("fecha", fechaFin)
    .order("fecha")
    .order("hora_inicio");

  if (error) throw error;
  const turnos = await conMarcaDePresupuesto(await conMarcaDeConsentimiento("general", data.map(mapearFilaTurno)));
  return conPedidosOnline ? [...turnos, ...(await obtenerPedidosOnlineGeneralComoTurnos(fechaInicio, fechaFin))] : turnos;
}

// Todos los turnos de un paciente (pasados y futuros) — para poder
// contestar "¿cuándo tenía turno?" sin tener que ir día por día en la
// agenda. Más recientes primero.
export async function obtenerTurnosGeneralPorPaciente(pacienteId) {
  const { data, error } = await supabase
    .from("turnos_general")
    .select(SELECT_TURNO)
    .eq("paciente_id", pacienteId)
    .order("fecha", { ascending: false })
    .order("hora_inicio", { ascending: false });

  if (error) throw error;
  return data.map(mapearFilaTurno);
}

export async function crearTurnoGeneral(turno) {
  const { data, error } = await supabase
    .from("turnos_general")
    .insert({
      fecha: turno.fecha,
      hora_inicio: turno.horaInicio,
      duracion_min: turno.duracionMin,
      consultorio: turno.consultorio,
      paciente_id: turno.pacienteId,
      celular: turno.celular || null,
      profesional_de_turno_id: turno.profesionalDeTurnoId,
      profesional_responsable_id: turno.profesionalResponsableId || null,
      tipo_atencion: turno.tipoAtencion,
      cobertura: turno.cobertura,
      prestaciones: turno.prestaciones || [],
      prioridad: turno.prioridad || "Normal",
      observaciones: turno.observaciones || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function actualizarEstadoTurnoGeneral(id, cambios) {
  const { data, error } = await supabase
    .from("turnos_general")
    .update({ ...cambios, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(SELECT_TURNO)
    .single();

  if (error) throw error;
  return mapearFilaTurno(data);
}
