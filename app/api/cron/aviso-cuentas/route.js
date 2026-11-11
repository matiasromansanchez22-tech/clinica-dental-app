import { createClient } from "@supabase/supabase-js";
import { calcularCuentasDelMes, nombreDeMes } from "@/lib/cuentasDelMes";
import { calcularCumplimientoRegistro, horaYFechaEnArgentina, sumarDiasISO, textoFechaCorta } from "@/lib/pendientesPorProfesional";
import { enviarPushASuscripciones, prepararWebPush } from "@/lib/server/push";

// Tarea diaria de las 9 de la mañana (Argentina), la dispara el cron de Vercel (ver vercel.json). Hace hasta tres cosas según el día:
//   1) Día 1 de cada mes → avisa a las Dueñas cuánta plata hace falta para cubrir las cuentas del mes (sueldos y gastos fijos).
//   2) De lunes a sábado → avisa a cada odontólogo cuántos pacientes suyos siguen sin "qué se hizo" cargado en la Agenda.
//   3) Los lunes → le manda a las Dueñas el resumen de cumplimiento de la semana que pasó.
// Parámetros (piden el secreto del cron): ?tarea=cuentas|registro|semanal para correr solo una · ?simular=1 devuelve lo que
// mandaría sin enviar nada · ?forzar=1 la corre aunque hoy no corresponda.

const pesos = (n) => `$${Math.round(Math.abs(Number(n) || 0)).toLocaleString("es-AR")}`;

function diaDeLaSemana(hoyISO) {
  return new Date(`${hoyISO}T12:00:00Z`).getUTCDay(); // 0 = domingo
}

async function suscripcionesCon(supabase, filtro) {
  const { data, error } = await supabase.from("push_subscriptions").select("*, usuario:perfiles(rol, profesional_id)");
  if (error) throw error;
  return (data || []).filter(filtro);
}

// ---------- 1) Cuentas del mes ----------
async function tareaCuentas(supabase, hoy, simular) {
  const c = await calcularCuentasDelMes(supabase, hoy);
  const titulo = `🧮 Cuentas de ${nombreDeMes(c.mesActual.mes)}: necesitás ${pesos(c.falta)}`;
  const mensaje = `Sueldos ${pesos(c.faltaSueldos)} + gastos fijos ${pesos(c.faltaFijos)}. En la reserva tenés ${pesos(c.reserva.total)}: ${
    c.diferencia >= 0 ? "te sobran" : "te faltan"
  } ${pesos(c.diferencia)}.`;
  if (simular) {
    return {
      simulado: true,
      titulo,
      mensaje,
      sueldos: c.sueldos.map((s) => `${s.nombre}: ${s.horas} h × ${s.valorHora} = ${s.monto}${s.pagado ? " (ya pagado)" : ""}`),
      fijos: c.fijos.map((f) => `${f.nombre}: ${f.monto}${f.pagado ? " (ya pagado)" : ""}`),
      reserva: c.reserva,
    };
  }
  const duenas = await suscripcionesCon(supabase, (s) => s.usuario?.rol === "Duena");
  const enviados = await enviarPushASuscripciones(supabase, duenas, { title: titulo, body: mensaje, url: "/gerencial/planificar-pagos" });
  return { enviado: true, enviados, titulo, mensaje };
}

// ---------- 2) Pacientes sin cargar, a cada odontólogo ----------
async function tareaRegistro(supabase, simular) {
  const { hoy, ahora } = horaYFechaEnArgentina();
  const r = await calcularCumplimientoRegistro(supabase, { desde: sumarDiasISO(hoy, -30), hasta: hoy, hoy, ahora });
  const porProfesional = {};
  for (const p of r.pendientes) (porProfesional[p.profesionalId] ||= []).push(p);

  const avisos = Object.entries(porProfesional).map(([profesionalId, lista]) => {
    const masViejos = lista.slice(0, 3).map((p) => `${textoFechaCorta(p.fecha)} ${p.paciente}`).join(" · ");
    return {
      profesionalId,
      nombre: lista[0].profesional,
      cantidad: lista.length,
      titulo: `📝 Tenés ${lista.length} paciente${lista.length === 1 ? "" : "s"} sin cargar`,
      mensaje: `Falta marcar qué se hizo y qué sigue. ${masViejos}${lista.length > 3 ? " …" : ""}`,
    };
  });
  if (simular) return { simulado: true, avisos };

  const suscripciones = await suscripcionesCon(supabase, (s) => s.usuario?.rol === "Odontologo" && s.usuario?.profesional_id);
  let enviados = 0;
  for (const a of avisos) {
    const suyas = suscripciones.filter((s) => s.usuario.profesional_id === a.profesionalId);
    if (suyas.length === 0) continue;
    enviados += await enviarPushASuscripciones(supabase, suyas, { title: a.titulo, body: a.mensaje, url: "/pendientes-de-registro" });
  }
  return {
    enviado: true,
    enviados,
    profesionalesConPendientes: avisos.length,
    sinAvisosActivados: avisos.filter((a) => !suscripciones.some((s) => s.usuario.profesional_id === a.profesionalId)).map((a) => a.nombre),
  };
}

// ---------- 3) Resumen de la semana, a las Dueñas ----------
async function tareaSemanal(supabase, simular) {
  const { hoy, ahora } = horaYFechaEnArgentina();
  const r = await calcularCumplimientoRegistro(supabase, { desde: sumarDiasISO(hoy, -7), hasta: sumarDiasISO(hoy, -1), hoy, ahora });
  const titulo = `📊 Carga de la semana: ${r.porcentaje}% al día`;
  const detalle = r.porProfesional
    .filter((p) => p.sinCargar > 0)
    .map((p) => `${p.nombre.split(" ")[0]} ${p.sinCargar}`)
    .join(" · ");
  const mensaje = r.sinCargar === 0 ? `Los ${r.vinieron} turnos de la semana están cargados. ¡Todo al día!` : `Sin cargar ${r.sinCargar} de ${r.vinieron}: ${detalle}`;
  if (simular) return { simulado: true, titulo, mensaje, porProfesional: r.porProfesional };
  const duenas = await suscripcionesCon(supabase, (s) => s.usuario?.rol === "Duena");
  const enviados = await enviarPushASuscripciones(supabase, duenas, { title: titulo, body: mensaje, url: "/pendientes-de-registro" });
  return { enviado: true, enviados, titulo, mensaje };
}

export async function GET(request) {
  try {
    const auth = request.headers.get("authorization");
    const hayClave = Boolean(process.env.CRON_SECRET);
    const autorizado = hayClave && auth === `Bearer ${process.env.CRON_SECRET}`;
    if (hayClave && !autorizado) return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });

    const parametros = new URL(request.url).searchParams;
    const simular = parametros.get("simular") === "1";
    const forzar = parametros.get("forzar") === "1";
    const tarea = parametros.get("tarea");
    if ((simular || forzar || tarea) && !autorizado) return Response.json({ ok: false, error: "No autorizado." }, { status: 401 });

    const { hoy } = horaYFechaEnArgentina();
    const dia = diaDeLaSemana(hoy);
    const toca = (nombre, hoyCorresponde) => (tarea ? tarea === nombre : forzar || hoyCorresponde);

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    if (!simular && !prepararWebPush()) return Response.json({ ok: false, error: "Faltan las claves VAPID." });

    const resultado = {};
    if (toca("cuentas", hoy.slice(8) === "01")) resultado.cuentas = await tareaCuentas(supabase, hoy, simular);
    if (toca("registro", dia !== 0)) resultado.registro = await tareaRegistro(supabase, simular);
    if (toca("semanal", dia === 1)) resultado.semanal = await tareaSemanal(supabase, simular);
    return Response.json({ ok: true, hoy, ...resultado });
  } catch (err) {
    return Response.json({ ok: false, error: err.message }, { status: 200 });
  }
}
