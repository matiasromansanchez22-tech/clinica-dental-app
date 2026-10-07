import { supabase } from "@/lib/supabaseClient";
import { totalContado } from "@/lib/billetes";

export async function obtenerConteos() {
  const { data, error } = await supabase
    .from("conteos_billetes")
    .select("id, usuario_id, nombre_usuario, nota, billetes, monedas, total, esperado, created_at, updated_at")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
}

// Si viene `id` actualiza ese conteo; si no, crea uno nuevo.
export async function guardarConteo({ id, nombreUsuario, nota, conteo, esperado }) {
  const fila = {
    nota: nota?.trim() || null,
    billetes: conteo.billetes || {},
    monedas: Number(conteo.monedas) || 0,
    total: totalContado(conteo),
    esperado: esperado === null || esperado === undefined || esperado === "" ? null : Number(esperado),
    updated_at: new Date().toISOString(),
  };
  if (id) {
    const { data, error } = await supabase.from("conteos_billetes").update(fila).eq("id", id).select().single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase
    .from("conteos_billetes")
    .insert({ ...fila, nombre_usuario: nombreUsuario || null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function eliminarConteo(id) {
  const { error } = await supabase.from("conteos_billetes").delete().eq("id", id);
  if (error) throw error;
}
