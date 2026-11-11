import Anthropic from "@anthropic-ai/sdk";
import { clienteServidor, contarDeLaUltimaHora, hashDeConexion } from "@/lib/server/consultasOnline";
import { armarInstrucciones, WHATSAPP_VISIBLE } from "@/lib/server/asistenteOrtodoncia";

// Asistente de la página pública de ortodoncia. Ruta abierta (sin iniciar sesión), por eso: limita cuántos mensajes puede mandar una
// conexión por hora y cuántos se atienden por día en total (para que nunca se dispare el costo), recorta el largo de lo que entra y
// guarda cada pregunta y respuesta de forma anónima para que las dueñas vean qué dudas tiene la gente.
export const dynamic = "force-dynamic";

const MODELO = "claude-haiku-5-5";
const MAX_MENSAJES_POR_HORA = 20;
const MAX_POR_DIA_EN_TOTAL = 800;
const MAX_LARGO_MENSAJE = 600;
const MAX_HISTORIAL = 8;

const respuestaDeCorte = (texto) => Response.json({ ok: true, respuesta: texto, corte: true });

export async function POST(request) {
  try {
    const cuerpo = await request.json().catch(() => ({}));
    // Solo mensajes de texto de la persona y del asistente; el primero tiene que ser de la persona y el último también.
    let mensajes = (Array.isArray(cuerpo.mensajes) ? cuerpo.mensajes : [])
      .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
      .map((m) => ({ role: m.role, content: m.content.trim().slice(0, MAX_LARGO_MENSAJE) }))
      .slice(-MAX_HISTORIAL);
    while (mensajes.length && mensajes[0].role !== "user") mensajes.shift();
    if (mensajes.length === 0 || mensajes[mensajes.length - 1].role !== "user") return Response.json({ ok: false, error: "Escribí tu consulta." }, { status: 400 });

    const supabase = clienteServidor();
    const ipHash = hashDeConexion(request);
    if ((await contarDeLaUltimaHora(supabase, "chat_publico_log", ipHash)) >= MAX_MENSAJES_POR_HORA) {
      return respuestaDeCorte(`Ya charlamos bastante por acá 😊 Para seguir, escribinos por WhatsApp al ${WHATSAPP_VISIBLE} y te atendemos personalmente.`);
    }
    const { count: delDia } = await supabase.from("chat_publico_log").select("id", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString());
    if ((delDia || 0) >= MAX_POR_DIA_EN_TOTAL) {
      return respuestaDeCorte(`El asistente está descansando por hoy. Escribinos por WhatsApp al ${WHATSAPP_VISIBLE} y te respondemos enseguida.`);
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return respuestaDeCorte(`Ahora no puedo responder. Escribinos por WhatsApp al ${WHATSAPP_VISIBLE}.`);

    const instrucciones = await armarInstrucciones(supabase);
    const anthropic = new Anthropic({ apiKey });
    const r = await anthropic.messages.create({ model: MODELO, max_tokens: 450, system: instrucciones, messages: mensajes });
    const respuesta = r.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
    if (!respuesta) return respuestaDeCorte(`No pude armar la respuesta. Escribinos por WhatsApp al ${WHATSAPP_VISIBLE}.`);

    await supabase.from("chat_publico_log").insert({ ip_hash: ipHash, pregunta: mensajes[mensajes.length - 1].content, respuesta: respuesta.slice(0, 2000) });
    return Response.json({ ok: true, respuesta });
  } catch (e) {
    return Response.json(
      { ok: true, respuesta: `Ahora no puedo responder. Escribinos por WhatsApp al ${WHATSAPP_VISIBLE} y te atendemos enseguida.`, corte: true, ...(process.env.NODE_ENV !== "production" ? { detalle: String(e?.message || e) } : {}) },
      { status: 200 }
    );
  }
}
