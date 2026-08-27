import { supabase } from "@/lib/supabaseClient";

export const SECTORES_STOCK = ["Odontología General", "Tratamiento de Conducto", "Ortodoncia", "Otros"];

export async function obtenerRodantes() {
  const { data, error } = await supabase.from("stock_rodantes").select("*").order("orden");
  if (error) throw error;
  return data;
}

export async function crearRodante(nombre) {
  const { data: max } = await supabase.from("stock_rodantes").select("orden").order("orden", { ascending: false }).limit(1);
  const orden = (max?.[0]?.orden || 0) + 1;
  const { data, error } = await supabase.from("stock_rodantes").insert({ nombre, orden }).select().single();
  if (error) throw error;
  return data;
}

export async function renombrarRodante(id, nombre) {
  const { error } = await supabase.from("stock_rodantes").update({ nombre }).eq("id", id);
  if (error) throw error;
}

export async function eliminarRodante(id) {
  const { error } = await supabase.from("stock_rodantes").delete().eq("id", id);
  if (error) throw error;
}

export async function obtenerInsumosStock() {
  const { data, error } = await supabase.from("stock_insumos").select("*").order("nombre");
  if (error) throw error;
  return data;
}

export async function crearInsumoStock(nombre, sector) {
  const { data, error } = await supabase.from("stock_insumos").insert({ nombre, sector }).select().single();
  if (error) throw error;
  return data;
}

export async function eliminarInsumoStock(id) {
  const { error } = await supabase.from("stock_insumos").delete().eq("id", id);
  if (error) throw error;
}

export async function obtenerCantidadesStock() {
  const { data, error } = await supabase.from("stock_cantidades").select("insumo_id, rodante_id, cantidad");
  if (error) throw error;
  return data;
}

export async function actualizarCantidadStock(insumoId, rodanteId, cantidad) {
  const { error } = await supabase
    .from("stock_cantidades")
    .upsert(
      { insumo_id: insumoId, rodante_id: rodanteId, cantidad: Number(cantidad) || 0, updated_at: new Date().toISOString() },
      { onConflict: "insumo_id,rodante_id" }
    );
  if (error) throw error;
}
