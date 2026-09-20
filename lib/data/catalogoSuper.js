import { supabase } from "@/lib/supabaseClient";

export async function obtenerCatalogoProductosSuper() {
  const { data, error } = await supabase.from("catalogo_productos_super").select("*").order("nombre");
  if (error) throw error;
  return data;
}

export async function agregarProductoCatalogoSuper(datos) {
  const { data, error } = await supabase
    .from("catalogo_productos_super")
    .insert({
      nombre: datos.nombre,
      grupo: datos.grupo,
      categoria: datos.categoria,
      unidad: datos.unidad || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
