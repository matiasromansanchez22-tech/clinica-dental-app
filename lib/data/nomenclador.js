import { supabase } from "@/lib/supabaseClient";

export async function obtenerObrasSociales() {
  const { data, error } = await supabase.from("obras_sociales").select("id, nombre").order("nombre");
  if (error) throw error;
  return data;
}

export async function obtenerNomencladorPorObraSocial(obraSocial, busqueda) {
  let query = supabase
    .from("nomenclador")
    .select("id, obra_social, codigo, prestacion_os, valor_os, id_catalogo, prestacion_interna, copago_oficial, estado")
    .ilike("obra_social", obraSocial)
    .order("prestacion_os")
    .limit(500);

  if (busqueda) {
    query = query.or(`prestacion_os.ilike.%${busqueda}%,prestacion_interna.ilike.%${busqueda}%,codigo.ilike.%${busqueda}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function actualizarFilaNomenclador(id, cambios) {
  const { data, error } = await supabase.from("nomenclador").update(cambios).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function obtenerEscalasCopago() {
  const { data, error } = await supabase
    .from("configuracion_copago_escala")
    .select("*")
    .order("orden");
  if (error) throw error;
  return data;
}

export async function actualizarEscalaCopago(id, porcentaje) {
  const { error } = await supabase.from("configuracion_copago_escala").update({ porcentaje }).eq("id", id);
  if (error) throw error;
}

export async function obtenerExcepcionesCopago() {
  const { data, error } = await supabase
    .from("configuracion_copago_excepcion")
    .select("*")
    .order("obra_social");
  if (error) throw error;
  return data;
}

export async function actualizarExcepcionCopago(id, cambios) {
  const { error } = await supabase.from("configuracion_copago_excepcion").update(cambios).eq("id", id);
  if (error) throw error;
}

export async function crearExcepcionCopago({ obraSocial, porcentaje, observaciones }) {
  const { error } = await supabase
    .from("configuracion_copago_excepcion")
    .insert({ obra_social: obraSocial, porcentaje, observaciones: observaciones || null });
  if (error) throw error;
}

export async function eliminarExcepcionCopago(id) {
  const { error } = await supabase.from("configuracion_copago_excepcion").delete().eq("id", id);
  if (error) throw error;
}
