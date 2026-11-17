import { supabase } from "@/lib/supabaseClient";

// La "cortina" de notificaciones de las Dueñas: los avisos que el sistema les mandó al celular, guardados para volver a leerlos dentro de
// la app. Cada Dueña ve solo los suyos (la base lo garantiza). Si todavía no se corrió la migración 206, todo devuelve vacío.

export async function obtenerNotificaciones(limite = 60) {
  const { data, error } = await supabase.from("notificaciones").select("id, titulo, mensaje, url, created_at, leida_en").order("created_at", { ascending: false }).limit(limite);
  if (error) return { disponible: false, lista: [] };
  return { disponible: true, lista: data };
}

export async function marcarNotificacionLeida(id) {
  await supabase.from("notificaciones").update({ leida_en: new Date().toISOString() }).eq("id", id).is("leida_en", null);
}

export async function marcarTodasLeidas() {
  await supabase.from("notificaciones").update({ leida_en: new Date().toISOString() }).is("leida_en", null);
}

export async function borrarLeidas() {
  await supabase.from("notificaciones").delete().not("leida_en", "is", null);
}
