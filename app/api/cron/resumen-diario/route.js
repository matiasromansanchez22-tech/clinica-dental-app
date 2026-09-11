import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const CLAVE_POR_MEDIO = {
  Efectivo: "efectivo",
  Transferencia: "transferencia",
  "Débito": "debito",
  "Crédito": "credito",
  "Mercado Pago": "mercado_pago",
  QR: "qr",
};

// La fecha de "hoy" en horario de Argentina (UTC-3), sin importar en qué
// huso horario corra el servidor — un cron de Vercel corre en UTC.
function hoyEnArgentina() {
  const ahora = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return ahora.toISOString().slice(0, 10);
}

function sumarPorMedioPago(filas, campoMonto, campoDesglose) {
  const totales = { efectivo: 0, transferencia: 0, debito: 0, credito: 0, mercado_pago: 0, qr: 0 };
  for (const fila of filas) {
    const desglose = campoDesglose ? fila[campoDesglose] : null;
    const partes = desglose?.length ? desglose : [{ medio: fila.medio_pago, monto: fila[campoMonto] }];
    for (const parte of partes) {
      const clave = CLAVE_POR_MEDIO[parte.medio];
      if (clave) totales[clave] += Number(parte.monto);
    }
  }
  const totalGeneral = Object.values(totales).reduce((a, b) => a + b, 0);
  return { ...totales, totalGeneral, cantidadCobros: filas.length };
}

export async function GET(request) {
  try {
    // Si está configurado el secreto de cron, exigirlo — así nadie más
    // puede disparar este aviso desde afuera. Si todavía no se configuró,
    // igual funciona (para no bloquear el primer uso).
    if (process.env.CRON_SECRET) {
      const auth = request.headers.get("authorization");
      if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
        return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });
      }
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const fecha = hoyEnArgentina();

    const [
      { data: cobrosGeneral, error: e1 },
      { data: cobrosOrto, error: e2 },
      { data: gastos, error: e3 },
      { data: categoriasGasto, error: e4 },
      { data: pagosProfesionales, error: e5 },
      { data: cierresTurnoGeneral, error: e6 },
      { data: cierresTurnoOrto, error: e7 },
    ] = await Promise.all([
      supabase.from("caja_general").select("pago, medio_pago, desglose_pago").eq("fecha", fecha),
      supabase.from("caja_ortodoncia").select("importe, medio_pago").eq("fecha", fecha),
      supabase.from("gastos").select("categoria, monto, medio_pago").eq("fecha", fecha),
      supabase.from("categorias_gasto").select("nombre, sale_de_reserva"),
      supabase.from("pagos_profesionales").select("monto, medio_pago").eq("fecha", fecha),
      supabase.from("cierres_turno").select("id").eq("fecha", fecha),
      supabase.from("cierres_turno_ortodoncia").select("id").eq("fecha", fecha),
    ]);
    for (const e of [e1, e2, e3, e4, e5, e6, e7]) if (e) throw e;

    const totalesGeneral = sumarPorMedioPago(cobrosGeneral, "pago", "desglose_pago");
    const totalesOrto = sumarPorMedioPago(cobrosOrto, "importe");
    const totalCombinado = totalesGeneral.totalGeneral + totalesOrto.totalGeneral;

    const categoriasReserva = new Set(categoriasGasto.filter((c) => c.sale_de_reserva).map((c) => c.nombre));
    const gastosDelDia = gastos.filter((g) => g.categoria !== "Sueldos" && !categoriasReserva.has(g.categoria));
    const totalEgresos =
      gastosDelDia.reduce((a, g) => a + Number(g.monto), 0) + pagosProfesionales.reduce((a, p) => a + Number(p.monto), 0);
    const totalNeto = totalCombinado - totalEgresos;

    // Un día sin ninguna actividad (la clínica no abrió) no amerita aviso.
    if (totalCombinado === 0 && totalEgresos === 0) {
      return Response.json({ ok: true, enviado: false, motivo: "Sin actividad ese día." });
    }

    const faltantes = [];
    if (totalesGeneral.cantidadCobros > 0 && cierresTurnoGeneral.length === 0) faltantes.push("General");
    if (totalesOrto.cantidadCobros > 0 && cierresTurnoOrto.length === 0) faltantes.push("Ortodoncia");

    const [anio, mes, dia] = fecha.split("-");
    const tituloFecha = `${dia}/${mes}`;
    const formatoPesos = (n) => `$${Math.round(n).toLocaleString("es-AR")}`;

    let mensaje;
    if (faltantes.length > 0) {
      mensaje = `⚠️ Falta cerrar el turno de ${faltantes.join(" y ")}. Ingresos ${formatoPesos(totalCombinado)} · Neto ${formatoPesos(totalNeto)}`;
    } else {
      mensaje = `Ingresos ${formatoPesos(totalCombinado)} (Gral ${formatoPesos(totalesGeneral.totalGeneral)} + Orto ${formatoPesos(totalesOrto.totalGeneral)}) · Egresos ${formatoPesos(totalEgresos)} · Neto ${formatoPesos(totalNeto)}`;
    }

    const clavePublica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const clavePrivada = process.env.VAPID_PRIVATE_KEY;
    if (!clavePublica || !clavePrivada) {
      return Response.json({ ok: false, error: "Faltan las claves VAPID." }, { status: 200 });
    }
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:soporte@example.com", clavePublica, clavePrivada);

    const { data: suscripciones, error: errorSuscripciones } = await supabase.from("push_subscriptions").select("*");
    if (errorSuscripciones) throw errorSuscripciones;

    const payload = JSON.stringify({
      title: `📊 Cierre del día — ${tituloFecha}`,
      body: mensaje.slice(0, 150),
      url: "/gerencial/cierre-diario",
    });

    let enviados = 0;
    await Promise.all(
      (suscripciones || []).map(async (s) => {
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

    return Response.json({ ok: true, enviado: true, enviados, mensaje });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 200 });
  }
}
