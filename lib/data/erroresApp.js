import { supabase } from "@/lib/supabaseClient";

function mapearFila(f) {
  return {
    id: f.id,
    mensaje: f.mensaje,
    stack: f.stack,
    url: f.url,
    contexto: f.contexto,
    usuarioId: f.usuario_id,
    nombreUsuario: f.usuario?.nombre || null,
    creadoEn: f.created_at,
  };
}

// No debe frenar nunca la app: si esto falla (sin sesión, sin red), se
// ignora en silencio — es un registro de mejor esfuerzo, no algo crítico.
export async function registrarError({ mensaje, stack, url, contexto }) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("errores_app").insert({
      mensaje: mensaje ? String(mensaje).slice(0, 2000) : null,
      stack: stack ? String(stack).slice(0, 4000) : null,
      url: url || null,
      contexto: contexto || null,
      usuario_id: user.id,
    });

    // Avisa por notificación push a quien lo tenga activado — nunca
    // frena ni rompe el registro del error si esto falla.
    fetch("/api/avisos/enviar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titulo: "🚨 Error en la app", mensaje, url: "/gerencial/errores" }),
    }).catch(() => {});
  } catch {
    // silencioso a propósito
  }
}

export async function obtenerErroresApp() {
  const { data, error } = await supabase
    .from("errores_app")
    .select("*, usuario:perfiles(nombre)")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data.map(mapearFila);
}

export async function eliminarError(id) {
  const { error } = await supabase.from("errores_app").delete().eq("id", id);
  if (error) throw error;
}
