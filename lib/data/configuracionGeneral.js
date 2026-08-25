import { supabase } from "@/lib/supabaseClient";

export async function obtenerConfiguracionGeneral() {
  const { data, error } = await supabase.from("configuracion_general").select("*");
  if (error) throw error;
  const mapa = {};
  data.forEach((f) => (mapa[f.clave] = Number(f.valor)));
  return mapa;
}

export async function actualizarConfiguracionGeneral(clave, valor) {
  const { error } = await supabase.from("configuracion_general").update({ valor }).eq("clave", clave);
  if (error) throw error;
}
