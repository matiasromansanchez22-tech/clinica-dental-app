import { supabase } from "@/lib/supabaseClient";

export async function obtenerTurnosGeneralPorFecha(fecha) {
  const { data, error } = await supabase
    .from("turnos_general")
    .select(
      `id, hora_inicio, duracion_min, consultorio, tipo_atencion, cobertura,
       estado, confirmacion, presencia, asistencia, observaciones,
       paciente:pacientes(apellido_y_nombre),
       profesional_de_turno:profesionales!profesional_de_turno_id(nombre)`
    )
    .eq("fecha", fecha)
    .order("hora_inicio");

  if (error) throw error;

  return data.map((fila) => ({
    id: fila.id,
    horaInicio: fila.hora_inicio.slice(0, 5), // "09:00:00" -> "09:00"
    duracionMin: fila.duracion_min,
    consultorio: fila.consultorio,
    paciente: fila.paciente?.apellido_y_nombre ?? "(sin paciente asignado)",
    profesionalDeTurno: fila.profesional_de_turno?.nombre ?? "(sin asignar)",
    tipoAtencion: fila.tipo_atencion,
    cobertura: fila.cobertura,
    estado: fila.estado,
    confirmacion: fila.confirmacion,
    presencia: fila.presencia,
    asistencia: fila.asistencia,
    observaciones: fila.observaciones,
  }));
}
