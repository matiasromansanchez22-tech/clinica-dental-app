import { createClient } from "@supabase/supabase-js";

// Registra un escaneo del QR de los planes. Es una ruta pública (la página del plan se abre sin iniciar sesión), por eso:
//   - solo guarda datos anónimos (fecha, lugar, código anónimo del celular y tipo de dispositivo),
//   - ignora robots y vistas previas de links,
//   - cuenta una sola vez a la misma persona en el mismo lugar durante 30 minutos (si refresca no suma).
const ES_ROBOT = /bot|crawl|spider|preview|facebookexternalhit|whatsapp|slackbot|telegram|twitter|embedly|headless/i;
const VENTANA_MINUTOS = 30;

function tipoDeDispositivo(ua) {
  if (/ipad|tablet/i.test(ua)) return "Tablet";
  if (/mobi|android|iphone|ipod/i.test(ua)) return "Celular";
  return "Computadora";
}

export async function POST(request) {
  try {
    const ua = request.headers.get("user-agent") || "";
    if (ES_ROBOT.test(ua)) return Response.json({ ok: true, contado: false });

    const { visitante, lugar, destino: destinoPedido } = await request.json();
    // Qué página se abrió: el plan de referidos (la de siempre) o la de consultas de ortodoncia.
    const destino = destinoPedido === "ortodoncia" ? "ortodoncia" : "referidos";
    if (typeof visitante !== "string" || !/^[a-zA-Z0-9-]{8,64}$/.test(visitante)) {
      return Response.json({ ok: false, error: "Visitante inválido." }, { status: 400 });
    }

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

    // Si el lugar no existe (link mal escrito), se cuenta como cartel sin lugar.
    let lugarFinal = "general";
    if (typeof lugar === "string" && /^[a-z0-9-]{1,40}$/.test(lugar)) {
      const { data } = await supabase.from("qr_lugares").select("clave").eq("clave", lugar).maybeSingle();
      if (data) lugarFinal = data.clave;
    }

    const desde = new Date(Date.now() - VENTANA_MINUTOS * 60 * 1000).toISOString();
    // La columna "destino" la agrega la migración 198; mientras no esté, todo se cuenta como plan de referidos (como siempre).
    const consultaRepetido = (conDestino) => {
      let c = supabase.from("qr_escaneos").select("id", { count: "exact", head: true }).eq("visitante", visitante).eq("lugar", lugarFinal).gte("created_at", desde);
      if (conDestino) c = c.eq("destino", destino);
      return c;
    };
    let repetido = await consultaRepetido(true);
    const conColumnaDestino = !repetido.error;
    if (!conColumnaDestino) repetido = await consultaRepetido(false);
    if (repetido.count > 0) return Response.json({ ok: true, contado: false });

    const fila = { lugar: lugarFinal, visitante, dispositivo: tipoDeDispositivo(ua), ...(conColumnaDestino ? { destino } : {}) };
    const { error } = await supabase.from("qr_escaneos").insert(fila);
    if (error) throw error;
    return Response.json({ ok: true, contado: true });
  } catch (e) {
    // Nunca debe romper ni demorar la página que ve el paciente. El detalle del error solo se muestra al desarrollar.
    return Response.json({ ok: false, ...(process.env.NODE_ENV !== "production" ? { detalle: String(e?.message || e) } : {}) }, { status: 200 });
  }
}
