import { headerDeSesion } from "@/lib/authHeaders";

// Wrapper de fetch("/api/avisos/enviar") que manda el token de sesión —
// la ruta lo exige para no dejar mandar notificaciones push a cualquiera
// que encuentre la URL, sin estar logueado en la app.
export async function enviarAviso(payload) {
  const headers = await headerDeSesion();
  if (!headers.Authorization) return;
  await fetch("/api/avisos/enviar", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(payload),
  });
}
