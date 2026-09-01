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
