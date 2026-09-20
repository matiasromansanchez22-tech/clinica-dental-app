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

export async function actualizarCantidadItemCasa(id, cantidad) {
  const { error } = await supabase
    .from("casa_items")
    .update({ cantidad: Number(cantidad) || 0, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// Registra varios productos comprados de una — un mismo nombre solo se
// considera "el mismo producto" si además coincide la ubicación (así no
// mezcla, por ejemplo, detergente del baño con el de la despensa). Si el
// mismo nombre+ubicación aparece dos veces en la misma compra, se suman
// entre sí antes.
export async function registrarCompraCasa(items) {
  const agrupados = new Map();
  for (const item of items) {
    const nombre = (item.nombre || "").trim();
    if (!nombre) continue;
    const ubicacionId = item.ubicacionId || null;
    const clave = `${nombre.toLowerCase()}|${ubicacionId || ""}`;
    const cantidad = Number(item.cantidad) || 0;
    if (agrupados.has(clave)) {
      agrupados.get(clave).cantidad += cantidad;
    } else {
      agrupados.set(clave, { nombre, categoria: item.categoria, ubicacionId, unidad: item.unidad, cantidad });
    }
  }
  if (agrupados.size === 0) return;

  const { data: itemsActuales, error } = await supabase.from("casa_items").select("id, nombre, ubicacion_id, cantidad");
  if (error) throw error;

  for (const item of agrupados.values()) {
    const existente = itemsActuales.find(
      (i) =>
        i.nombre.trim().toLowerCase() === item.nombre.toLowerCase() && (i.ubicacion_id || null) === item.ubicacionId
    );
    if (existente) {
      await actualizarCantidadItemCasa(existente.id, Number(existente.cantidad) + item.cantidad);
    } else {
      await crearItemCasa(item);
    }
  }
}

const CAMPOS_LISTA_CASA = "id, nombre, categoria, ubicacion_id, cantidad, unidad, notas, created_at, updated_at";

export async function obtenerListaComprasCasa() {
  const { data, error } = await supabase.from("casa_lista_compras").select(CAMPOS_LISTA_CASA).order("nombre");
  if (error) throw error;
  return data;
}

export async function agregarItemListaComprasCasa(datos) {
  const { data, error } = await supabase
    .from("casa_lista_compras")
    .insert({
      nombre: datos.nombre,
      categoria: datos.categoria,
      ubicacion_id: datos.ubicacionId || null,
      cantidad: Number(datos.cantidad) || 1,
      unidad: datos.unidad || null,
      notas: datos.notas || null,
    })
    .select(CAMPOS_LISTA_CASA)
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarItemListaComprasCasa(id, datos) {
  const { data, error } = await supabase
    .from("casa_lista_compras")
    .update({
      nombre: datos.nombre,
      categoria: datos.categoria,
      ubicacion_id: datos.ubicacionId || null,
      cantidad: Number(datos.cantidad) || 1,
      unidad: datos.unidad || null,
      notas: datos.notas || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(CAMPOS_LISTA_CASA)
    .single();
  if (error) throw error;
  return data;
}

export async function eliminarItemListaComprasCasa(id) {
  await moverAPapelera("casa_lista_compras", id);
}

// Al tildar un producto de la lista: suma la cantidad al inventario de la
// Casa (mismo criterio que registrarCompraCasa) y lo saca de la lista.
export async function marcarCompradoListaCasa(item) {
  await registrarCompraCasa([
    {
      nombre: item.nombre,
      categoria: item.categoria,
      ubicacionId: item.ubicacion_id,
      cantidad: item.cantidad,
      unidad: item.unidad,
    },
  ]);
  await moverAPapelera("casa_lista_compras", item.id);
}
