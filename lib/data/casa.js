import { supabase } from "@/lib/supabaseClient";
import { moverAPapelera } from "@/lib/data/papelera";

export const CATEGORIAS_CASA = [
  "Alimentos",
  "Limpieza",
  "Higiene y perfumería",
  "Electrodomésticos",
  "Herramientas",
  "Otros",
];

export async function obtenerUbicacionesCasa() {
  const { data, error } = await supabase.from("casa_ubicaciones").select("*").order("orden");
  if (error) throw error;
  return data;
}

export async function crearUbicacionCasa(nombre) {
  const { data: max } = await supabase
    .from("casa_ubicaciones")
    .select("orden")
    .order("orden", { ascending: false })
    .limit(1);
  const orden = (max?.[0]?.orden || 0) + 1;
  const { data, error } = await supabase.from("casa_ubicaciones").insert({ nombre, orden }).select().single();
  if (error) throw error;
  return data;
}

export async function renombrarUbicacionCasa(id, nombre) {
  const { error } = await supabase.from("casa_ubicaciones").update({ nombre }).eq("id", id);
  if (error) throw error;
}

export async function eliminarUbicacionCasa(id) {
  await moverAPapelera("casa_ubicaciones", id);
}

const CAMPOS_ITEM_CASA = "id, nombre, categoria, ubicacion_id, cantidad, unidad, fecha_vencimiento, notas, created_at, updated_at";

export async function obtenerItemsCasa() {
  const { data, error } = await supabase.from("casa_items").select(CAMPOS_ITEM_CASA).order("nombre");
  if (error) throw error;
  return data;
}

export async function crearItemCasa(datos) {
  const { data, error } = await supabase
    .from("casa_items")
    .insert({
      nombre: datos.nombre,
      categoria: datos.categoria,
      ubicacion_id: datos.ubicacionId || null,
      cantidad: Number(datos.cantidad) || 1,
      unidad: datos.unidad || null,
      fecha_vencimiento: datos.fechaVencimiento || null,
      notas: datos.notas || null,
    })
    .select(CAMPOS_ITEM_CASA)
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarItemCasa(id, datos) {
  const { data, error } = await supabase
    .from("casa_items")
    .update({
      nombre: datos.nombre,
      categoria: datos.categoria,
      ubicacion_id: datos.ubicacionId || null,
      cantidad: Number(datos.cantidad) || 1,
      unidad: datos.unidad || null,
      fecha_vencimiento: datos.fechaVencimiento || null,
      notas: datos.notas || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(CAMPOS_ITEM_CASA)
    .single();
  if (error) throw error;
  return data;
}

export async function eliminarItemCasa(id) {
  await moverAPapelera("casa_items", id);
}
