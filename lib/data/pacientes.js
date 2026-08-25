import { supabase } from "@/lib/supabaseClient";

export async function obtenerPacientesActivos() {
  const { data, error } = await supabase
    .from("pacientes")
    .select("id, apellido_y_nombre, celular, tipo_paciente, obra_social")
    .eq("estado", "Activo")
    .order("apellido_y_nombre")
    .limit(500);

  if (error) throw error;
  return data;
}

// Regla del doc 9: historial de turnos de un paciente, el más reciente primero.
export async function obtenerHistorialTurnosGeneral(pacienteId) {
  const { data, error } = await supabase
    .from("turnos_general")
    .select(
      `id, fecha, hora_inicio, tipo_atencion, cobertura, estado, confirmacion, asistencia,
       profesional_de_turno:profesionales!profesional_de_turno_id(nombre)`
    )
    .eq("paciente_id", pacienteId)
    .order("fecha", { ascending: false })
    .order("hora_inicio", { ascending: false })
    .limit(50);

  if (error) throw error;

  return data.map((fila) => ({
    id: fila.id,
    fecha: fila.fecha,
    horaInicio: fila.hora_inicio.slice(0, 5),
    tipoAtencion: fila.tipo_atencion,
    cobertura: fila.cobertura,
    estado: fila.estado,
    confirmacion: fila.confirmacion,
    asistencia: fila.asistencia,
    profesionalDeTurno: fila.profesional_de_turno?.nombre ?? "—",
  }));
}

export async function crearPaciente({ apellidoYNombre, celular, tipoPaciente, obraSocial }) {
  const { data, error } = await supabase
    .from("pacientes")
    .insert({
      apellido_y_nombre: apellidoYNombre,
      celular: celular || null,
      tipo_paciente: tipoPaciente,
      obra_social: obraSocial || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
