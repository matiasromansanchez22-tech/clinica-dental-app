import { supabase } from "@/lib/supabaseClient";

function mapearMensaje(f) {
  return {
    id: f.id,
    autorId: f.autor_id,
    texto: f.texto,
    creadoEn: f.created_at,
  };
}

export async function obtenerMensajes({ limite = 200 } = {}) {
  const { data, error } = await supabase
    .from("chat_mensajes")
    .select("id, autor_id, texto, created_at")
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return data.map(mapearMensaje).reverse();
}

export async function enviarMensaje(texto) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("chat_mensajes").insert({ autor_id: user.id, texto: texto.trim() });
  if (error) throw error;
}

export async function eliminarMensaje(id) {
  const { error } = await supabase.from("chat_mensajes").delete().eq("id", id);
  if (error) throw error;
}

export async function obtenerPlantillas() {
  const { data, error } = await supabase.from("chat_plantillas").select("id, texto, autor_id").order("created_at");
  if (error) throw error;
  return data.map((f) => ({ id: f.id, texto: f.texto, autorId: f.autor_id }));
}

export async function crearPlantilla(texto) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("chat_plantillas").insert({ autor_id: user.id, texto: texto.trim() });
  if (error) throw error;
}

export async function eliminarPlantilla(id) {
  const { error } = await supabase.from("chat_plantillas").delete().eq("id", id);
  if (error) throw error;
}

// Avisa (sin traer el mensaje entero, para no depender de a quién se lo
// junta) cada vez que se escribe o se borra algo en el chat, así la
// pantalla se puede volver a pedir la lista sola. Devuelve una función
// para cortar la suscripción al desmontar la pantalla.
export function suscribirseAChat(alCambiar) {
  const canal = supabase
    .channel("chat_mensajes_en_vivo")
    .on("postgres_changes", { event: "*", schema: "public", table: "chat_mensajes" }, alCambiar)
    .subscribe();
  return () => {
    supabase.removeChannel(canal);
  };
}
