import { createClient } from "@supabase/supabase-js";
import { horaYFechaEnArgentina } from "@/lib/pendientesPorProfesional";
import { calcularResumenJornada, esDestinatarioDelResumen, JORNADAS, textoDeFecha } from "@/lib/resumenJornada";
import { enviarPushASuscripciones, prepararWebPush } from "@/lib/server/push";

// Aviso de fin de jornada: lo dispara un cron (ver vercel.json) un rato antes de que termine la mañana y la tarde. Manda:
// Manda el resumen de todos (cuántos vinieron, cuántos quedaron sin cargar "qué se hizo" y "qué sigue") SOLO a Matías: no le llega a
// Recepción, a los profesionales ni a la otra Dueña.
// Parámetros (piden el secreto del cron): ?jornada=manana|tarde · ?simular=1 devuelve lo que mandaría sin enviar nada ·
// ?forzar=1 lo corre aunque hoy sea domingo.
export const dynamic = "force-dynamic";

const primerNombre = (n) => String(n || "").split(" ")[0];

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

    const { hoy, ahora } = horaYFechaEnArgentina();
    const diaSemana = new Date(`${hoy}T12:00:00Z`).getUTCDay();
    if (diaSemana === 0 && !forzar) return Response.json({ ok: true, hoy, omitido: "Los domingos no hay jornada." });
    const jornada = ["manana", "tarde"].includes(parametros.get("jornada")) ? parametros.get("jornada") : ahora < "16:00" ? "manana" : "tarde";

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    if (!simular && !prepararWebPush()) return Response.json({ ok: false, error: "Faltan las claves VAPID." });

    const r = await calcularResumenJornada(supabase, { fecha: hoy, jornada, hoy, ahora });
    const j = JORNADAS[jornada];
    const t = r.total;

    // --- Para Dueñas y Recepción: el resumen de todos ---
    const quienes = r.porProfesional.filter((p) => p.pacientes.length > 0).map((p) => `${primerNombre(p.nombre)}${p.area === "Ortodoncia" ? " (orto)" : ""} ${p.pacientes.length}`);
    const general = {
      titulo: `📋 ${j.titulo} · ${textoDeFecha(hoy)}`,
      mensaje:
        t.pacientesPendientes === 0
          ? `Vinieron ${t.vinieron} de ${t.agendados}. ✅ Todo cargado: qué se hizo y qué sigue.`
          : `Vinieron ${t.vinieron} de ${t.agendados}. Sin cargar ${t.pacientesPendientes}: ${quienes.join(" · ")}`,
    };

    if (simular) return Response.json({ ok: true, hoy, ahora, jornada, simulado: true, general, total: t });

    const { data: subs, error } = await supabase.from("push_subscriptions").select("*, usuario:perfiles(rol, nombre)");
    if (error) throw error;
    const suyas = (subs || []).filter((s) => esDestinatarioDelResumen(s.usuario));
    // Si Matías todavía no activó los avisos en su celular, no hay a quién mandarlo: se avisa en la respuesta.
    const enviados = suyas.length ? await enviarPushASuscripciones(supabase, suyas, { title: general.titulo, body: general.mensaje, url: "/resumen-jornada" }) : 0;
    return Response.json({ ok: true, hoy, jornada, enviado: true, enviados, sinAvisosActivados: suyas.length === 0, total: t });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 200 });
  }
}
