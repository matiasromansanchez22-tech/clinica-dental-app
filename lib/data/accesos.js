import { supabase } from "@/lib/supabaseClient";

// Se llama justo después de un login exitoso (no en cada refresh de
// sesión) — best-effort: si falla, no debe romper el login de nadie.
export async function registrarAcceso() {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("accesos").insert({ usuario_id: user.id });
  } catch {
    // silencioso a propósito
  }
}

export async function obtenerAccesos({ fechaInicio, fechaFin } = {}) {
  let query = supabase
    .from("accesos")
    .select("id, logueado_en, usuario:perfiles(nombre, rol)")
    .order("logueado_en", { ascending: false });
  if (fechaInicio) query = query.gte("logueado_en", `${fechaInicio}T00:00:00`);
  if (fechaFin) query = query.lte("logueado_en", `${fechaFin}T23:59:59`);

  const { data, error } = await query.limit(500);
  if (error) throw error;
  return data.map((f) => ({
    id: f.id,
    logueadoEn: f.logueado_en,
    nombre: f.usuario?.nombre ?? "—",
    rol: f.usuario?.rol ?? "—",
  }));
}
