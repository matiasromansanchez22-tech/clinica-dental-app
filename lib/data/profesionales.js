import { supabase } from "@/lib/supabaseClient";

export async function obtenerProfesionales() {
  const { data, error } = await supabase
    .from("profesionales")
    .select(
      "id, nombre, especialidad, observaciones, porcentaje_honorarios_copago, porcentaje_honorarios_os, disponibilidad_profesional(id, dia_semana, hora_inicio, hora_fin, consultorio, activo)"
    )
    .order("nombre");

  if (error) throw error;
  return data;
}

export async function crearProfesional(datos) {
  const { data, error } = await supabase
    .from("profesionales")
    .insert({
      nombre: datos.nombre,
      especialidad: datos.especialidad || null,
      observaciones: datos.observaciones || null,
      porcentaje_honorarios_copago: datos.porcentajeHonorariosCopago ?? 30,
      porcentaje_honorarios_os: datos.porcentajeHonorariosOS ?? 20,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function agregarBloqueDisponibilidad(profesionalId, bloque) {
  const { data, error } = await supabase
    .from("disponibilidad_profesional")
    .insert({
      profesional_id: profesionalId,
      dia_semana: bloque.diaSemana,
      hora_inicio: bloque.horaInicio,
      hora_fin: bloque.horaFin,
      consultorio: bloque.consultorio || null,
      activo: true,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function eliminarBloqueDisponibilidad(id) {
  const { error } = await supabase.from("disponibilidad_profesional").delete().eq("id", id);
  if (error) throw error;
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
