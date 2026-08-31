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
