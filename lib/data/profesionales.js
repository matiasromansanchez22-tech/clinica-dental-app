import { supabase } from "@/lib/supabaseClient";

export async function obtenerProfesionales() {
  const { data, error } = await supabase
    .from("profesionales")
    .select(
      "id, nombre, especialidad, observaciones, porcentaje_honorarios_copago, porcentaje_honorarios_os, disponibilidad_profesional(dia_semana, hora_inicio, hora_fin)"
    )
    .order("nombre");

  if (error) throw error;
  return data;
}

export async function actualizarPorcentajeHonorariosCopago(profesionalId, porcentaje) {
  const { error } = await supabase
    .from("profesionales")
    .update({ porcentaje_honorarios_copago: porcentaje })
    .eq("id", profesionalId);
  if (error) throw error;
}

export async function actualizarPorcentajeHonorariosOS(profesionalId, porcentaje) {
  const { error } = await supabase
    .from("profesionales")
    .update({ porcentaje_honorarios_os: porcentaje })
    .eq("id", profesionalId);
  if (error) throw error;
}

export function atiendeEseDia(profesional, diaSemana) {
  return (profesional.disponibilidad_profesional || []).some((d) => d.dia_semana === diaSemana);
}

export async function obtenerDisponibilidadProfesional(profesionalId) {
  const { data, error } = await supabase
    .from("disponibilidad_profesional")
    .select("dia_semana, hora_inicio, hora_fin, consultorio, activo")
    .eq("profesional_id", profesionalId)
    .eq("activo", true);

  if (error) throw error;
  return data;
}
