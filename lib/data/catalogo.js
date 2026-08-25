import { supabase } from "@/lib/supabaseClient";

export async function obtenerCatalogo(busqueda) {
  let query = supabase
    .from("catalogo_prestaciones")
    .select("*")
    .order("prestacion");

  if (busqueda) {
    query = query.or(`prestacion.ilike.%${busqueda}%,id.ilike.%${busqueda}%,categoria.ilike.%${busqueda}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function actualizarPrestacionCatalogo(id, cambios) {
  const { data, error } = await supabase.from("catalogo_prestaciones").update(cambios).eq("id", id).select().single();
  if (error) throw error;
  return data;
}
