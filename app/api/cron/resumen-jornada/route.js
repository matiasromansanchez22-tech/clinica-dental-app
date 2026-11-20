import { createClient } from "@supabase/supabase-js";
import { horaYFechaEnArgentina } from "@/lib/pendientesPorProfesional";
import { calcularResumenJornada, esDestinatarioDelResumen, JORNADAS, textoDeFecha } from "@/lib/resumenJornada";
import { calcularRutinaDelDia, textoAvisoRutina } from "@/lib/rutinaEquipo";
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
    // Esta ruta manda un aviso al celular, así que SIEMPRE exige la clave del cron (CRON_SECRET): sin ella no hace nada. Vercel la manda
    // sola en cada ejecución programada cuando la variable está cargada en el proyecto.
    if (!process.env.CRON_SECRET) return Response.json({ ok: false, error: "Falta configurar CRON_SECRET en Vercel: no se envía nada." }, { status: 200 });
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });

    const parametros = new URL(request.url).searchParams;
    const simular = parametros.get("simular") === "1";
    const forzar = parametros.get("forzar") === "1";

    const { hoy, ahora } = horaYFechaEnArgentina();
    const diaSemana = new Date(`${hoy}T12:00:00Z`).getUTCDay();
    if (diaSemana === 0 && !forzar) return Response.json({ ok: true, hoy, omitido: "Los domingos no hay jornada." });
    const jornada = ["manana", "tarde"].includes(parametros.get("jornada")) ? parametros.get("jornada") : ahora < "16:00" ? "manana" : "tarde";

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    if (!simular && !prepararWebPush()) return Response.json({ ok: false, error: "Faltan las claves VAPID." });

    const r = await calcularResumenJornada(supabase, { fecha: hoy, jornada, hoy, ahora });
    const j = JORNADAS[jornada];
    const t = r.total;

    // La rutina del equipo (hojas tildadas) se evalúa en el mismo aviso. Si todavía no se corrió la migración 207, simplemente no hay aviso.
    let avisoRutina = null;
    let rutinaCalculada = null;
    try {
      rutinaCalculada = await calcularRutinaDelDia(supabase, { fecha: hoy, hoy, ahora });
      avisoRutina = textoAvisoRutina(rutinaCalculada, jornada);
    } catch {
      avisoRutina = null;
    }

    // Si en esa jornada no hubo ningún turno (por ejemplo, las tardes de sábado), no se manda el resumen de pacientes (la rutina sí).
    const sinTurnos = t.agendados === 0 && !forzar;
    if (sinTurnos && !avisoRutina) return Response.json({ ok: true, hoy, jornada, omitido: "No hubo turnos en esta jornada." });

    // --- Para Dueñas y Recepción: el resumen de todos ---
    const quienes = r.porProfesional.filter((p) => p.pacientes.length > 0).map((p) => `${primerNombre(p.nombre)}${p.area === "Ortodoncia" ? " (orto)" : ""} ${p.pacientes.length}`);
    const general = {
      titulo: `📋 ${j.titulo} · ${textoDeFecha(hoy)}`,
      mensaje:
        t.pacientesPendientes === 0
          ? `Vinieron ${t.vinieron} de ${t.agendados}. ✅ Todo cargado: qué se hizo y qué sigue.`
          : `Vinieron ${t.vinieron} de ${t.agendados}. Sin cargar la visita (qué se hizo/qué sigue) ${t.pacientesPendientes}: ${quienes.join(" · ")}`,
    };
    // Fichas de autorización de obra social cargadas hoy (quién las cargó) y cuántas siguen para autorizar.
    try {
      const desdeHoy = `${hoy}T03:00:00Z`;
      const { data: fichas } = await supabase.from("autorizaciones_obra_social").select("estado, created_at, creador:perfiles!creado_por(nombre)");
      if (fichas) {
        const deHoy = fichas.filter((f) => f.created_at >= desdeHoy);
        const por = {};
        for (const f of deHoy) por[f.creador?.nombre?.split(" ")[0] || "?"] = (por[f.creador?.nombre?.split(" ")[0] || "?"] || 0) + 1;
        const quien = Object.entries(por).map(([n, c]) => `${n} ${c}`).join(" · ");
        const paraAut = fichas.filter((f) => f.estado === "Para autorizar").length;
        general.mensaje += ` 📋 Fichas hoy: ${deHoy.length}${quien ? ` (${quien})` : ""} · ${paraAut} para autorizar.`;
      }
    } catch {
      // si no se puede leer, el aviso sale igual sin esta línea
    }
    // El historial clínico es otra carga: va como línea aparte.
    if (t.vinieron > 0 && t.historialDisponible) {
      const sinHist = r.porProfesional.filter((p) => p.sinHistorial.length > 0).map((p) => `${primerNombre(p.nombre)}${p.area === "Ortodoncia" ? " (orto)" : ""} ${p.sinHistorial.length}`);
      general.mensaje += t.sinHistorial === 0 ? " 📝 Historial clínico al día." : ` 📝 Sin historial clínico ${t.sinHistorial}: ${sinHist.join(" · ")}.`;
    }

    if (simular) return Response.json({ ok: true, hoy, ahora, jornada, simulado: true, general: sinTurnos ? null : general, rutina: avisoRutina, total: t,
      // Solo en la simulación (pide el secreto): lo que comprobó el sistema en cada tarea, para revisarlo.
      comprobaciones: rutinaCalculada?.personas.map((p) => ({ nombre: p.nombre, libre: p.libre, tareas: p.tareas.filter((x) => x.sistema).map((x) => `${x.estado} · ${x.sistema.detalle}`) })) });

    const { data: subs, error } = await supabase.from("push_subscriptions").select("*, usuario:perfiles(rol, nombre)");
    if (error) throw error;
    const suyas = (subs || []).filter((s) => esDestinatarioDelResumen(s.usuario));
    // Si Matías todavía no activó los avisos en su celular, no hay a quién mandarlo: se avisa en la respuesta.
    let enviados = 0;
    if (suyas.length) {
      if (!sinTurnos) enviados += await enviarPushASuscripciones(supabase, suyas, { title: general.titulo, body: general.mensaje, url: "/resumen-jornada" });
      if (avisoRutina) enviados += await enviarPushASuscripciones(supabase, suyas, { title: avisoRutina.titulo, body: avisoRutina.mensaje, url: "/gerencial/rutina-equipo" });
    }
    return Response.json({ ok: true, hoy, jornada, enviado: true, enviados, sinAvisosActivados: suyas.length === 0, total: t, rutina: Boolean(avisoRutina) });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 200 });
  }
}
