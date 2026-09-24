import { createClient } from "@supabase/supabase-js";

// Confirma que quien llama a esta ruta tiene una sesión válida de la app
// (manda el token en el header Authorization) — sin esto, cualquiera que
// encuentre la URL podría usar la ruta sin loguearse. Se valida con la
// clave pública (anon), nunca con la de service role.
export async function usuarioValido(request) {
  const auth = request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return false;
  const supabaseAnon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const {
    data: { user },
  } = await supabaseAnon.auth.getUser(token);
  return Boolean(user);
}
