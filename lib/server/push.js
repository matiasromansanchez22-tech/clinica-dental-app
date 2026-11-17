import webpush from "web-push";

// Envío de avisos push desde el servidor (cron). Devuelve false si faltan las claves VAPID.
export function prepararWebPush() {
  const clavePublica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const clavePrivada = process.env.VAPID_PRIVATE_KEY;
  if (!clavePublica || !clavePrivada) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:soporte@example.com", clavePublica, clavePrivada);
  return true;
}

// Guarda el aviso en la "cortina" de notificaciones (tabla notificaciones) de cada Dueña a la que le llega, una vez por persona aunque
// tenga varios dispositivos. Los avisos de otros roles no se guardan. Nunca frena ni rompe el envío: si falta la tabla (migración 206)
// o algo falla, simplemente no queda guardado.
export async function guardarNotificaciones(supabase, suscripciones, payload) {
  try {
    const ids = [...new Set((suscripciones || []).map((s) => s.usuario_id).filter(Boolean))];
    if (ids.length === 0) return 0;
    const { data: duenas } = await supabase.from("perfiles").select("id").in("id", ids).eq("rol", "Duena");
    if (!duenas?.length) return 0;
    const filas = duenas.map((d) => ({
      usuario_id: d.id,
      titulo: String(payload.title || "Clínica Dental").slice(0, 200),
      mensaje: String(payload.body || "").slice(0, 400) || null,
      url: payload.url || null,
    }));
    const { error } = await supabase.from("notificaciones").insert(filas);
    if (error) return 0;
    // Se conservan los últimos 60 días.
    await supabase.from("notificaciones").delete().lt("created_at", new Date(Date.now() - 60 * 86400000).toISOString());
    return filas.length;
  } catch {
    return 0;
  }
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
  await guardarNotificaciones(supabase, suscripciones, payload);
  return enviados;
}
