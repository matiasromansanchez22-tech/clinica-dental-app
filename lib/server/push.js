import webpush from "web-push";

// Envío de avisos push desde el servidor (cron). Devuelve false si faltan las claves VAPID.
export function prepararWebPush() {
  const clavePublica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const clavePrivada = process.env.VAPID_PRIVATE_KEY;
  if (!clavePublica || !clavePrivada) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:soporte@example.com", clavePublica, clavePrivada);
  return true;
}

// Manda `payload` ({ title, body, url }) a cada suscripción de la lista; borra las que ya no existen. Devuelve cuántas llegaron.
export async function enviarPushASuscripciones(supabase, suscripciones, payload) {
  const texto = JSON.stringify({ ...payload, body: String(payload.body || "").slice(0, 150) });
  let enviados = 0;
  await Promise.all(
    suscripciones.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } }, texto);
        enviados++;
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) await supabase.from("push_subscriptions").delete().eq("id", s.id);
      }
    })
  );
  return enviados;
}
