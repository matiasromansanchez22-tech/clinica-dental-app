import { supabase } from "@/lib/supabaseClient";

// Doc 3.1: reporte de turnos marcados para reprogramar, con el celular del
// paciente y el turno original, para hacerles seguimiento telefónico.
export async function obtenerTurnosAReprogramar() {
  const { data, error } = await supabase
    .from("turnos_general")
    .select(
      `id, fecha, hora_inicio, consultorio, tipo_atencion,
       paciente:pacientes(apellido_y_nombre, celular),
       profesional_de_turno:profesionales!profesional_de_turno_id(nombre)`
    )
    .eq("estado", "Reprogramado")
    .order("fecha", { ascending: false });

  if (error) throw error;

  return data.map((f) => ({
    id: f.id,
    fecha: f.fecha,
    horaInicio: f.hora_inicio.slice(0, 5),
    consultorio: f.consultorio,
    tipoAtencion: f.tipo_atencion,
    paciente: f.paciente?.apellido_y_nombre ?? "—",
    celular: f.paciente?.celular ?? "—",
    profesionalDeTurno: f.profesional_de_turno?.nombre ?? "—",
  }));
}
