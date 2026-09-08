import { supabase } from "@/lib/supabaseClient";
import { moverAPapelera } from "@/lib/data/papelera";

function mapearFila(f) {
  return {
    id: f.id,
    laboratorio: f.laboratorio,
    categoria: f.categoria,
    trabajo: f.trabajo,
    precio: f.precio === null ? null : Number(f.precio),
    observaciones: f.observaciones,
    contacto: f.contacto,
    actualizadoEn: f.actualizado_en,
    preferido: f.preferido,
    idCatalogo: f.id_catalogo,
  };
}

export async function obtenerPreciosMecanicos() {
  const { data, error } = await supabase
    .from("mecanicos_precios")
    .select("*")
    .order("categoria")
    .order("trabajo");
  if (error) throw error;
  return data.map(mapearFila);
}

export async function crearPrecioMecanico(datos) {
  const { data, error } = await supabase
    .from("mecanicos_precios")
    .insert({
      laboratorio: datos.laboratorio,
      categoria: datos.categoria,
      trabajo: datos.trabajo,
      precio: datos.precio === "" || datos.precio === null ? null : Number(datos.precio),
      observaciones: datos.observaciones || null,
      contacto: datos.contacto || null,
      actualizado_en: datos.actualizadoEn || new Date().toISOString().slice(0, 10),
      preferido: Boolean(datos.preferido),
      id_catalogo: datos.idCatalogo || null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapearFila(data);
}

export async function actualizarPrecioMecanico(id, datos) {
  const { data, error } = await supabase
    .from("mecanicos_precios")
    .update({
      laboratorio: datos.laboratorio,
      categoria: datos.categoria,
      trabajo: datos.trabajo,
      precio: datos.precio === "" || datos.precio === null ? null : Number(datos.precio),
      observaciones: datos.observaciones || null,
      contacto: datos.contacto || null,
      actualizado_en: datos.actualizadoEn,
      preferido: Boolean(datos.preferido),
      id_catalogo: datos.idCatalogo || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return mapearFila(data);
}

export async function eliminarPrecioMecanico(id) {
  await moverAPapelera("mecanicos_precios", id);
}

// A diferencia de las funciones de arriba, estas dos las puede usar
// cualquier usuario logueado (no solo la Dueña): devuelven un dato puntual
// (el precio de un laboratorio+trabajo exacto, o la lista de nombres de
// laboratorio) sin exponer el resto de la comparativa de mecánicos
// (contactos, observaciones, cuál está descartado, etc.), que sigue
// siendo Dueña-only.
export async function obtenerPrecioMecanico(laboratorio, trabajo) {
  if (!laboratorio?.trim() || !trabajo?.trim()) return null;
  const { data, error } = await supabase.rpc("obtener_precio_mecanico", {
    p_laboratorio: laboratorio.trim(),
    p_trabajo: trabajo.trim(),
  });
  if (error) throw error;
  return data === null || data === undefined ? null : Number(data);
}

export async function obtenerNombresLaboratoriosMecanicos() {
  const { data, error } = await supabase.rpc("obtener_laboratorios_mecanicos");
  if (error) throw error;
  return data.map((f) => f.laboratorio);
}

// El id de catálogo que ya se vinculó a mano en la comparativa de
// mecánicos para ese laboratorio + trabajo exactos (ver PrecioMecanicoModal).
// Es más confiable que comparar el nombre del trabajo contra el catálogo,
// porque el mecánico no siempre le pone el mismo nombre que nosotros.
export async function obtenerIdCatalogoMecanico(laboratorio, trabajo) {
  if (!laboratorio?.trim() || !trabajo?.trim()) return null;
  const { data, error } = await supabase.rpc("obtener_id_catalogo_mecanico", {
    p_laboratorio: laboratorio.trim(),
    p_trabajo: trabajo.trim(),
  });
  if (error) throw error;
  return data || null;
}

// El catálogo completo de ESE mecánico (nombre + precio, como el catálogo
// propio de la clínica) para mostrar al elegir "Tipo de trabajo" al cargar
// un trabajo de laboratorio — así se ve y se elige con el nombre y el
// valor que el mecánico realmente usa, no el nuestro.
export async function obtenerPreciosDelMecanico(laboratorio) {
  if (!laboratorio?.trim()) return [];
  const { data, error } = await supabase.rpc("obtener_precios_mecanico", { p_laboratorio: laboratorio.trim() });
  if (error) throw error;
  return data.map((f) => ({ trabajo: f.trabajo, precio: f.precio === null ? null : Number(f.precio) }));
}
