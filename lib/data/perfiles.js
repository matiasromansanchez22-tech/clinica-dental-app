import { supabase } from "@/lib/supabaseClient";

export async function obtenerPerfiles() {
  const { data, error } = await supabase.from("perfiles").select("id, nombre, rol");
  if (error) throw error;
  return data;
}
