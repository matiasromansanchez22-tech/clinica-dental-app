import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";
import { calcularCuentasDelMes, nombreDeMes } from "@/lib/cuentasDelMes";

// El día 1 de cada mes (9 de la mañana en Argentina) les avisa a las Dueñas cuánta plata hace falta para cubrir las cuentas del
// mes —sueldos y gastos fijos— y si lo que hay en la reserva alcanza. Lo dispara el cron de Vercel (ver vercel.json).
//   ?simular=1 → devuelve lo que mandaría, sin enviar nada   ·   ?forzar=1 → lo envía aunque no sea día 1
// Las dos opciones piden el secreto del cron; sin él, esta ruta solo manda el aviso el día 1.

function hoyEnArgentina() {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const pesos = (n) => `$${Math.round(Math.abs(Number(n) || 0)).toLocaleString("es-AR")}`;

export async function GET(request) {
  try {
    const auth = request.headers.get("authorization");
    const hayClave = Boolean(process.env.CRON_SECRET);
    const autorizado = hayClave && auth === `Bearer ${process.env.CRON_SECRET}`;
    if (hayClave && !autorizado) return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });

    const parametros = new URL(request.url).searchParams;
    const simular = parametros.get("simular") === "1";
    const forzar = parametros.get("forzar") === "1";
    if ((simular || forzar) && !autorizado) return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });

    const hoy = hoyEnArgentina();
    if (!simular && !forzar && hoy.slice(8) !== "01") return Response.json({ ok: true, enviado: false, motivo: "Hoy no es día 1." });

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const c = await calcularCuentasDelMes(supabase, hoy);

    const titulo = `🧮 Cuentas de ${nombreDeMes(c.mesActual.mes)}: necesitás ${pesos(c.falta)}`;
    const mensaje = `Sueldos ${pesos(c.faltaSueldos)} + gastos fijos ${pesos(c.faltaFijos)}. En la reserva tenés ${pesos(c.reserva.total)}: ${
      c.diferencia >= 0 ? "te sobran" : "te faltan"
    } ${pesos(c.diferencia)}.`;

    if (simular) {
      return Response.json({
        ok: true,
        simulado: true,
        titulo,
        mensaje,
        sueldos: c.sueldos.map((s) => `${s.nombre}: ${s.horas} h × ${s.valorHora} = ${s.monto}${s.pagado ? " (ya pagado)" : ""}`),
        fijos: c.fijos.map((f) => `${f.nombre}: ${f.monto}${f.pagado ? " (ya pagado)" : ""}`),
        reserva: c.reserva,
      });
    }

    const clavePublica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const clavePrivada = process.env.VAPID_PRIVATE_KEY;
    if (!clavePublica || !clavePrivada) return Response.json({ ok: false, error: "Faltan las claves VAPID." });
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:soporte@example.com", clavePublica, clavePrivada);

    const { data: suscripciones, error } = await supabase.from("push_subscriptions").select("*, usuario:perfiles(rol)");
    if (error) throw error;
    const duenas = (suscripciones || []).filter((s) => s.usuario?.rol === "Duena");
    const payload = JSON.stringify({ title: titulo, body: mensaje.slice(0, 150), url: "/gerencial/planificar-pagos" });
    let enviados = 0;
    await Promise.all(
      duenas.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } }, payload);
          enviados++;
        } catch (err) {
          if (err.statusCode === 404 || err.statusCode === 410) await supabase.from("push_subscriptions").delete().eq("id", s.id);
        }
      })
    );
    return Response.json({ ok: true, enviado: true, enviados, titulo, mensaje });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 200 });
  }
}
