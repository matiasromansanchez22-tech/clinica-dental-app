import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { usuarioValido } from "@/lib/server/verificarSesion";

export async function POST(request) {
  try {
    if (!(await usuarioValido(request))) {
      return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
    }

    const { titulo, mensaje, url, roles } = await request.json();

    const clavePublica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const clavePrivada = process.env.VAPID_PRIVATE_KEY;
    if (!clavePublica || !clavePrivada) {
      return Response.json({ ok: false, error: "Faltan las claves VAPID." }, { status: 200 });
    }
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:soporte@example.com", clavePublica, clavePrivada);

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    // Si viene "roles" (ej. ["Secretaria"]), el aviso solo se manda a los
    // dispositivos de usuarios con ese rol — si no viene, se manda a todos
    // los que lo tengan activado (comportamiento de siempre, para los
    // avisos de error).
    let query = supabase.from("push_subscriptions").select("*, usuario:perfiles(rol)");
    const { data: suscripcionesCrudas, error } = await query;
    if (error) throw error;
    const suscripciones = roles?.length
      ? (suscripcionesCrudas || []).filter((s) => roles.includes(s.usuario?.rol))
      : suscripcionesCrudas;
    if (!suscripciones || suscripciones.length === 0) {
      return Response.json({ ok: true, enviados: 0 });
    }

    const payload = JSON.stringify({
      title: titulo || "Clínica Dental",
      body: mensaje ? String(mensaje).slice(0, 150) : "",
      url: url || "/",
    });

    let enviados = 0;
    await Promise.all(
      suscripciones.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } }, payload);
          enviados++;
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", s.id);
          }
        }
      })
    );

    return Response.json({ ok: true, enviados });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 200 });
  }
}
