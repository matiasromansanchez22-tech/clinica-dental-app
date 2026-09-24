import { supabase } from "@/lib/supabaseClient";

// Header de autorización para mandar a las rutas /api/* que necesitan
// confirmar que quien llama está logueado en la app (evita que cualquiera
// que encuentre la URL pueda usarlas sin pasar por el login).
export async function headerDeSesion() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session ? { Authorization: `Bearer ${session.access_token}` } : {};
}
