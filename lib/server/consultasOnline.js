import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";
import { diaSemanaDeFecha, generarBloquesHorarios, hayConflictoDeHorario, minutosDesdeHora, seMuestraEnGrilla, sumarDias } from "@/lib/agenda";
import { CLAVE_PROMO_CONSULTA, promoConsultaHasta } from "@/lib/promoConsulta";

// Lógica del servidor para la página pública de consultas de Ortodoncia: horarios libres para la primera consulta, protección
// contra abusos y utilidades. Todo corre con la clave de servicio (la página pública no inicia sesión), por eso cada función
// valida y limita lo que entra y lo que sale.

export const DIAS_ADELANTE = 21; // cuántos días hacia adelante se ofrecen turnos
const PASO_MIN = 30; // cada cuántos minutos arranca un turno ofrecido
const ANTICIPACION_MIN = 180; // los turnos de hoy se ofrecen hasta 3 horas antes
const DURACION_POR_DEFECTO = 30;

export function clienteServidor() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function ahoraArgentina() {
  const iso = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  return { hoy: iso.slice(0, 10), minutos: Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16)) };
}

// Código anónimo de la conexión de quien llama: sirve para limitar abusos sin guardar la dirección real.
export function hashDeConexion(request) {
  const ip = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || request.headers.get("x-real-ip") || "sin-ip";
  const sal = (process.env.SUPABASE_SERVICE_ROLE_KEY || "").slice(-16);
  return createHash("sha256").update(`${ip}|${sal}`).digest("hex").slice(0, 32);
}

// Deja el número listo para WhatsApp (solo dígitos, con 549 adelante para celulares argentinos). Devuelve null si no parece un número.
export function normalizarWhatsApp(texto) {
  let d = String(texto || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("549")) return d.length >= 12 && d.length <= 13 ? d : null;
  if (d.startsWith("54")) d = d.slice(2);
  d = d.replace(/^0+/, "");
  // 0341 15 555 1234 → quita el "15" que va después del código de área
  const conQuince = d.match(/^(\d{2,4})15(\d{6,8})$/);
  if (conQuince && conQuince[1].length + conQuince[2].length === 10) d = conQuince[1] + conQuince[2];
  if (d.length !== 10) return null;
  return `549${d}`;
}

const NOMBRES_DIA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
export function textoDeDia(fechaISO) {
  const [a, m, d] = fechaISO.split("-");
  return `${NOMBRES_DIA[diaSemanaDeFecha(fechaISO)]} ${d}/${m}`;
}

// Hasta qué día la consulta está bonificada ("2026-11-30"), o null si no hay promoción vigente hoy.
export async function obtenerPromoConsulta(supabase) {
  const { data } = await supabase.from("configuracion_ortodoncia").select("valor").eq("clave", CLAVE_PROMO_CONSULTA).maybeSingle();
  const hasta = promoConsultaHasta(data?.valor);
  return hasta && hasta >= ahoraArgentina().hoy ? hasta : null;
}

async function duracionDeConsulta(supabase) {
  const { data } = await supabase.from("configuracion_duracion_ortodoncia").select("duracion_min").eq("concepto", "Consulta de ortodoncia").maybeSingle();
  return Number(data?.duracion_min) || DURACION_POR_DEFECTO;
}

// Todo lo que ya ocupa lugar en esos días: turnos de las dos agendas (cualquier consultorio) y pedidos pendientes de la página.
async function turnosOcupados(supabase, desde, hasta) {
  const mapear = (f, profesionalCol) => ({
    id: f.id,
    fecha: f.fecha,
    horaInicio: String(f.hora_inicio).slice(0, 5),
    duracionMin: Number(f.duracion_min) || DURACION_POR_DEFECTO,
    consultorio: f.consultorio,
    profesionalDeTurnoId: f[profesionalCol],
    estado: f.estado,
    confirmacion: f.confirmacion,
    presencia: f.presencia,
    sobreturno: Boolean(f.sobreturno),
  });
  const [orto, general, pendientes] = await Promise.all([
    supabase.from("turnos_ortodoncia").select("id, fecha, hora_inicio, duracion_min, consultorio, ortodoncista_id, estado, confirmacion, presencia, sobreturno").gte("fecha", desde).lte("fecha", hasta),
    supabase.from("turnos_general").select("id, fecha, hora_inicio, duracion_min, consultorio, profesional_de_turno_id, estado, confirmacion, presencia").gte("fecha", desde).lte("fecha", hasta),
    supabase.from("solicitudes_turno_ortodoncia").select("id, fecha, hora_inicio, duracion_min, consultorio, profesional_id").eq("estado", "Pendiente").gte("fecha", desde).lte("fecha", hasta),
  ]);
  if (orto.error) throw orto.error;
  if (general.error) throw general.error;
  const filas = [
    ...orto.data.map((f) => mapear(f, "ortodoncista_id")),
    ...general.data.map((f) => mapear(f, "profesional_de_turno_id")),
    ...(pendientes.error ? [] : pendientes.data.map((f) => ({ ...mapear({ ...f, estado: "Pendiente" }, "profesional_id") }))),
  ];
  return filas.filter(seMuestraEnGrilla);
}

// Horarios libres para una primera consulta. Cada día trae sus horas (sin repetir) y, por dentro, quién atiende y en qué consultorio
// (eso no se le muestra al paciente: al reservar se vuelve a calcular en el servidor).
//   devuelve { configurado, duracionMin, dias: [{ fecha, slots: [{ hora, profesionalId, consultorio }] }] }
export async function calcularHorariosLibres(supabase, { dias = DIAS_ADELANTE, soloFecha = null } = {}) {
  const duracionMin = await duracionDeConsulta(supabase);
  const { data: bloques, error } = await supabase.from("consulta_publica_horarios").select("profesional_id, dia_semana, hora_inicio, hora_fin, consultorio").eq("activo", true);
  // Si la tabla todavía no existe (falta la migración 199) o no hay horarios cargados, la página simplemente no ofrece turnos.
  if (error || !bloques?.length) return { configurado: false, duracionMin, dias: [] };

  const { hoy, minutos } = ahoraArgentina();
  const desde = soloFecha || hoy;
  const hasta = soloFecha || sumarDias(hoy, dias - 1);
  const ocupados = await turnosOcupados(supabase, desde, hasta);
  const porFecha = new Map();
  for (const t of ocupados) (porFecha.get(t.fecha) || porFecha.set(t.fecha, []).get(t.fecha)).push(t);

  const resultado = [];
  const cantidad = soloFecha ? 1 : dias;
  for (let i = 0; i < cantidad; i++) {
    const fecha = soloFecha || sumarDias(hoy, i);
    if (fecha < hoy) continue;
    const delDia = bloques.filter((b) => b.dia_semana === diaSemanaDeFecha(fecha));
    if (delDia.length === 0) continue;
    const visibles = porFecha.get(fecha) || [];
    const vistas = new Set();
    const slots = [];
    for (const b of delDia) {
      const desdeHora = String(b.hora_inicio).slice(0, 5);
      const hastaHora = String(b.hora_fin).slice(0, 5);
      for (const hora of generarBloquesHorarios(desdeHora, hastaHora, PASO_MIN)) {
        const inicio = minutosDesdeHora(hora);
        if (inicio + duracionMin > minutosDesdeHora(hastaHora)) continue;
        if (fecha === hoy && inicio < minutos + ANTICIPACION_MIN) continue;
        if (vistas.has(hora)) continue;
        const conflicto = hayConflictoDeHorario({ turnosVisibles: visibles, consultorio: b.consultorio, profesionalDeTurnoId: b.profesional_id, horaInicio: hora, duracionMin });
        if (conflicto) continue;
        vistas.add(hora);
        slots.push({ hora, profesionalId: b.profesional_id, consultorio: b.consultorio });
      }
    }
    if (slots.length) resultado.push({ fecha, slots: slots.sort((a, b) => a.hora.localeCompare(b.hora)) });
  }
  return { configurado: true, duracionMin, dias: resultado };
}

// Cuántas filas de una tabla tiene esta conexión en la última hora (para limitar pedidos y mensajes).
export async function contarDeLaUltimaHora(supabase, tabla, ipHash) {
  const desde = new Date(Date.now() - 3600 * 1000).toISOString();
  const { count } = await supabase.from(tabla).select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", desde);
  return count || 0;
}

// ---------------------------------------------------------------------------------------------------------------------------
// Odontología General: turnos según el motivo de la consulta
// ---------------------------------------------------------------------------------------------------------------------------

export async function obtenerMotivosGeneral(supabase, { soloActivos = true } = {}) {
  let q = supabase.from("motivos_turno_general").select("id, clave, nombre, descripcion, duracion_min, profesionales_ids, accion, mensaje, orden, activo").order("orden").order("nombre");
  if (soloActivos) q = q.eq("activo", true);
  const { data, error } = await q;
  if (error) return [];
  return data;
}

// Horarios libres para un motivo de General. Junta, de los profesionales que atienden ese motivo, su horario semanal y sus días
// puntuales, y descuenta todo lo que ya ocupa lugar (turnos de las dos agendas y pedidos pendientes de la página).
//   devuelve { duracionMin, dias: [{ fecha, slots: [{ hora, opciones: [{ profesionalId, nombre, consultorio }] }], carga: { [profesionalId]: turnosEseDia } }] }
export async function calcularHorariosLibresGeneral(supabase, motivo, { dias = DIAS_ADELANTE, soloFecha = null } = {}) {
  const duracionMin = Number(motivo.duracion_min) || DURACION_POR_DEFECTO;
  const ids = motivo.profesionales_ids || [];
  if (ids.length === 0) return { duracionMin, dias: [] };

  const { hoy, minutos } = ahoraArgentina();
  const desde = soloFecha || hoy;
  const hasta = soloFecha || sumarDias(hoy, dias - 1);

  const [{ data: profs }, { data: semanales }, puntuales] = await Promise.all([
    supabase.from("profesionales").select("id, nombre, activo").in("id", ids),
    supabase.from("disponibilidad_profesional").select("profesional_id, dia_semana, hora_inicio, hora_fin, consultorio, activo").in("profesional_id", ids).eq("activo", true),
    supabase.from("disponibilidad_fechas").select("profesional_id, fecha, hora_inicio, hora_fin, consultorio, activo").in("profesional_id", ids).eq("activo", true).gte("fecha", desde).lte("fecha", hasta),
  ]);
  const nombres = Object.fromEntries((profs || []).filter((p) => p.activo !== false).map((p) => [p.id, String(p.nombre).split(" ")[0]]));
  const bloquesPuntuales = puntuales.error ? [] : puntuales.data || [];
  const ocupados = await turnosOcupados(supabase, desde, hasta);
  const porFecha = new Map();
  for (const t of ocupados) (porFecha.get(t.fecha) || porFecha.set(t.fecha, []).get(t.fecha)).push(t);

  const resultado = [];
  const cantidad = soloFecha ? 1 : dias;
  for (let i = 0; i < cantidad; i++) {
    const fecha = soloFecha || sumarDias(hoy, i);
    if (fecha < hoy) continue;
    const dow = diaSemanaDeFecha(fecha);
    const bloques = [
      ...(semanales || []).filter((b) => b.dia_semana === dow),
      ...bloquesPuntuales.filter((b) => b.fecha === fecha),
    ].filter((b) => nombres[b.profesional_id]);
    if (bloques.length === 0) continue;
    const visibles = porFecha.get(fecha) || [];
    const carga = {};
    for (const t of visibles) if (t.profesionalDeTurnoId) carga[t.profesionalDeTurnoId] = (carga[t.profesionalDeTurnoId] || 0) + 1;
    const porHora = new Map();
    for (const b of bloques) {
      const desdeHora = String(b.hora_inicio).slice(0, 5);
      const hastaHora = String(b.hora_fin).slice(0, 5);
      for (const hora of generarBloquesHorarios(desdeHora, hastaHora, PASO_MIN)) {
        const inicio = minutosDesdeHora(hora);
        if (inicio + duracionMin > minutosDesdeHora(hastaHora)) continue;
        if (fecha === hoy && inicio < minutos + ANTICIPACION_MIN) continue;
        const conflicto = hayConflictoDeHorario({ turnosVisibles: visibles, consultorio: b.consultorio, profesionalDeTurnoId: b.profesional_id, horaInicio: hora, duracionMin });
        if (conflicto) continue;
        const lista = porHora.get(hora) || porHora.set(hora, []).get(hora);
        if (!lista.some((o) => o.profesionalId === b.profesional_id)) lista.push({ profesionalId: b.profesional_id, nombre: nombres[b.profesional_id], consultorio: b.consultorio });
      }
    }
    const slots = [...porHora.entries()].sort((a, c) => a[0].localeCompare(c[0])).map(([hora, opciones]) => ({ hora, opciones }));
    if (slots.length) resultado.push({ fecha, slots, carga });
  }
  return { duracionMin, dias: resultado };
}

// Entre los profesionales libres a esa hora, se elige el que menos turnos tiene ese día (así se reparte); si empatan, el primero de la lista.
export function elegirOpcion(slot, carga = {}) {
  return [...slot.opciones].sort((a, b) => (carga[a.profesionalId] || 0) - (carga[b.profesionalId] || 0))[0];
}

// Obras sociales de la clínica (para el selector de la página).
export async function obtenerObrasSociales(supabase) {
  const { data } = await supabase.from("obras_sociales").select("nombre").order("nombre");
  return (data || []).map((o) => o.nombre);
}

// Precio de la consulta inicial particular (el que se muestra en la página).
export async function obtenerPrecioConsultaInicial(supabase) {
  const { data } = await supabase.from("catalogo_prestaciones").select("valor_efectivo, valor_lista").eq("id", "OG-0054").maybeSingle();
  return Number(data?.valor_efectivo) || Number(data?.valor_lista) || null;
}
