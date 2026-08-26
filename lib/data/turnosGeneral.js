import { supabase } from "@/lib/supabaseClient";

const SELECT_TURNO = `id, fecha, hora_inicio, duracion_min, consultorio, tipo_atencion, cobertura,
  prioridad, estado, confirmacion, presencia, asistencia, observaciones, prestaciones,
  paciente_id, profesional_de_turno_id,
  paciente:pacientes(apellido_y_nombre),
  profesional_de_turno:profesionales!profesional_de_turno_id(nombre)`;

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
    tipoAtencion: fila.tipo_atencion,
    cobertura: fila.cobertura,
    prestaciones: fila.prestaciones || [],
    prioridad: fila.prioridad,
    estado: fila.estado,
    confirmacion: fila.confirmacion,
    presencia: fila.presencia,
    asistencia: fila.asistencia,
    observaciones: fila.observaciones,
  };
}

export async function obtenerTurnosGeneralPorFecha(fecha) {
  const { data, error } = await supabase
    .from("turnos_general")
    .select(SELECT_TURNO)
    .eq("fecha", fecha)
    .order("hora_inicio");

  if (error) throw error;
  return data.map(mapearFilaTurno);
}

export async function obtenerTurnosGeneralPorRango(fechaInicio, fechaFin) {
  const { data, error } = await supabase
    .from("turnos_general")
    .select(SELECT_TURNO)
    .gte("fecha", fechaInicio)
    .lte("fecha", fechaFin)
    .order("fecha")
    .order("hora_inicio");

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
