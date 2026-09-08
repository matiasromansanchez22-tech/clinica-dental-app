import { supabase } from "@/lib/supabaseClient";
import { moverAPapelera } from "@/lib/data/papelera";

export async function obtenerProfesionales() {
  const { data, error } = await supabase
    .from("profesionales")
    .select(
      "id, nombre, especialidad, observaciones, activo, porcentaje_honorarios_copago, porcentaje_honorarios_os, disponibilidad_profesional(id, dia_semana, hora_inicio, hora_fin, consultorio, activo)"
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
      activo: datos.activo ?? true,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarProfesional(id, datos) {
  const { error } = await supabase
    .from("profesionales")
    .update({
      nombre: datos.nombre,
      especialidad: datos.especialidad || null,
      observaciones: datos.observaciones || null,
      porcentaje_honorarios_copago: datos.porcentajeHonorariosCopago,
      porcentaje_honorarios_os: datos.porcentajeHonorariosOS,
      activo: datos.activo,
    })
    .eq("id", id);
  if (error) throw error;
}

// Solo se puede borrar si el profesional no tiene turnos, cobros, pagos ni
// trabajos cargados a su nombre (la base lo protege sola con esa
// restricción) — para no perder historial real por error. Sirve para
// sacar altas duplicadas o cargadas por equivocación.
export async function eliminarProfesional(id) {
  try {
    await moverAPapelera("profesionales", id);
  } catch (e) {
    if (e.code === "23503") {
      throw new Error(
        "No se puede borrar: este profesional ya tiene turnos, cobros o pagos cargados. Si fue un error de carga, marcalo como Inactivo en vez de borrarlo."
      );
    }
    throw e;
  }
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
  await moverAPapelera("disponibilidad_profesional", id);
}

export async function actualizarBloqueDisponibilidad(id, bloque) {
  const { error } = await supabase
    .from("disponibilidad_profesional")
    .update({
      dia_semana: bloque.diaSemana,
      hora_inicio: bloque.horaInicio,
      hora_fin: bloque.horaFin,
      consultorio: bloque.consultorio || null,
    })
    .eq("id", id);
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

// Excepciones de honorarios por especialidad (ej. Catalina cobra 35% en
// Prótesis Fija pero 50% en Periodoncia) — si un profesional no tiene
// ninguna cargada, se sigue usando su % general de siempre. Tabla nueva:
// si todavía no se corrió la migración, se devuelve vacío en vez de romper
// las pantallas que ya andaban (Profesionales, Producción).
export async function obtenerHonorariosEspecialidad(profesionalId) {
  const { data, error } = await supabase
    .from("honorarios_especialidad")
    .select("id, especialidad, porcentaje_copago")
    .eq("profesional_id", profesionalId);
  if (error) throw error;
  return data;
}

// Todas las excepciones de todos los profesionales de una vez, para no
// tener que consultar una por una en Producción.
export async function obtenerTodosHonorariosEspecialidad() {
  const { data, error } = await supabase.from("honorarios_especialidad").select("profesional_id, especialidad, porcentaje_copago");
  if (error) throw error;
  return data;
}

export async function guardarHonorarioEspecialidad(profesionalId, especialidad, porcentajeCopago) {
  const { error } = await supabase
    .from("honorarios_especialidad")
    .upsert(
      { profesional_id: profesionalId, especialidad, porcentaje_copago: Number(porcentajeCopago) },
      { onConflict: "profesional_id,especialidad" }
    );
  if (error) throw error;
}

export async function eliminarHonorarioEspecialidad(id) {
  const { error } = await supabase.from("honorarios_especialidad").delete().eq("id", id);
  if (error) throw error;
}
