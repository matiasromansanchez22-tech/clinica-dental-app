import { supabase } from "@/lib/supabaseClient";

export async function obtenerDuracionesOrtodoncia() {
  const { data, error } = await supabase.from("configuracion_duracion_ortodoncia").select("*");
  if (error) throw error;
  const mapa = {};
  data.forEach((f) => (mapa[f.concepto] = Number(f.duracion_min)));
  return mapa;
}

export async function actualizarDuracionOrtodoncia(concepto, duracionMin) {
  const { error } = await supabase
    .from("configuracion_duracion_ortodoncia")
    .update({ duracion_min: duracionMin })
    .eq("concepto", concepto);
  if (error) throw error;
}
