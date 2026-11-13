import { supabase } from "@/lib/supabaseClient";
import { diaSemanaDeFecha } from "@/lib/agenda";

// Registro de ingreso de los profesionales: Recepción marca a qué hora llega cada uno (mañana y tarde) y las Dueñas controlan si
// respetan llegar con 15 minutos de anticipación al comienzo de su horario.

export const MARGEN_MIN = 15; // cuántos minutos antes de su horario tienen que llegar
export const TURNOS = ["Mañana", "Tarde"];
const SEPARACION_MIN_ENTRE_TURNOS = 1; // dos bloques separados por algún hueco (ej. 13:00 y 13:30) cuentan como mañana y tarde

const ZONA = "America/Argentina/Buenos_Aires";
const formatoHora = new Intl.DateTimeFormat("en-GB", { timeZone: ZONA, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

// La hora de ahora en Argentina, "HH:MM", sin importar cómo tenga el reloj la computadora.
export function horaAhora() {
  return formatoHora.format(new Date());
}

export const aMinutos = (hhmm) => {
  const [h, m] = String(hhmm).slice(0, 5).split(":").map(Number);
  return h * 60 + m;
};

export const aHora = (minutos) => `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;

// A qué hora tendría que llegar alguien que empieza a `horaProgramada` (15 minutos antes).
export const horaLimite = (horaProgramada, margen = MARGEN_MIN) => aHora(Math.max(0, aMinutos(horaProgramada) - margen));

// Cómo le fue en un ingreso: a tiempo (llegó con el margen pedido), justo (llegó antes de su hora pero con menos margen),
// tarde (llegó después de su hora) o no vino.
export function clasificarIngreso({ estado, horaProgramada, horaLlegada, margen = MARGEN_MIN }) {
  if (estado === "No vino") return { clave: "no-vino", texto: "No vino", minutos: null };
  const antes = aMinutos(horaProgramada) - aMinutos(horaLlegada); // positivo = llegó antes
  if (antes >= margen) return { clave: "a-tiempo", texto: `${antes} min antes`, minutos: antes };
  if (antes >= 0) return { clave: "justo", texto: antes === 0 ? "justo a la hora" : `${antes} min antes`, minutos: antes };
  return { clave: "tarde", texto: `${-antes} min tarde`, minutos: antes };
}

// Los turnos (mañana / tarde) que tiene cada profesional un día, según la disponibilidad cargada en la Agenda. Los bloques que se
// pisan o se tocan (ej. 8-14 y 12-18) forman un solo turno; si queda un hueco entre uno y otro, el primero es la mañana y el
// segundo la tarde. Devuelve [{ profesionalId, nombre, especialidad, turno, horaProgramada, horaFin }].
export function turnosEsperadosDeFecha(profesionales, fecha) {
  const dia = diaSemanaDeFecha(fecha);
  const salida = [];
  for (const p of profesionales) {
    if (p.activo === false) continue;
    const bloques = (p.disponibilidad_profesional || [])
      .filter((b) => b.activo !== false && b.dia_semana === dia)
      .map((b) => ({ desde: aMinutos(b.hora_inicio), hasta: aMinutos(b.hora_fin) }))
      .sort((a, b) => a.desde - b.desde);
    const fusionados = [];
    for (const b of bloques) {
      const ultimo = fusionados[fusionados.length - 1];
      if (ultimo && b.desde < ultimo.hasta + SEPARACION_MIN_ENTRE_TURNOS) ultimo.hasta = Math.max(ultimo.hasta, b.hasta);
      else fusionados.push({ ...b });
    }
    fusionados.forEach((b, i) => {
      // Con un solo turno, se llama mañana si arranca antes de las 13 y tarde si no; con dos o más, el primero es la mañana.
      const turno = fusionados.length === 1 ? (b.desde < 13 * 60 ? "Mañana" : "Tarde") : i === 0 ? "Mañana" : "Tarde";
      if (i > 1) return; // más de dos bloques en un día no es lo habitual: se ignoran los extra
      salida.push({ profesionalId: p.id, nombre: p.nombre, especialidad: p.especialidad, turno, horaProgramada: aHora(b.desde), horaFin: aHora(b.hasta) });
    });
  }
  return salida.sort((a, b) => a.horaProgramada.localeCompare(b.horaProgramada) || a.nombre.localeCompare(b.nombre));
}

export async function obtenerProfesionalesConHorario() {
  const { data, error } = await supabase
    .from("profesionales")
    .select("id, nombre, especialidad, activo, disponibilidad_profesional(dia_semana, hora_inicio, hora_fin, consultorio, activo)")
    .order("nombre");
  if (error) throw error;
  return data;
}

function mapear(f) {
  return {
    id: f.id,
    fecha: f.fecha,
    profesionalId: f.profesional_id,
    profesional: f.profesional?.nombre || "—",
    turno: f.turno,
    horaProgramada: String(f.hora_programada).slice(0, 5),
    estado: f.estado,
    horaLlegada: f.hora_llegada ? String(f.hora_llegada).slice(0, 5) : null,
    margen: f.margen_min,
    manual: f.manual,
    nota: f.nota,
    marcadoPor: f.marcador?.nombre || "—",
    marcadoPorId: f.marcado_por,
    creadoEn: f.created_at,
  };
}

const SELECT = "id, fecha, profesional_id, turno, hora_programada, estado, hora_llegada, margen_min, manual, nota, marcado_por, created_at, profesional:profesionales!profesional_id(nombre), marcador:perfiles!marcado_por(nombre)";

export async function obtenerIngresosPorRango(desde, hasta) {
  const { data, error } = await supabase.from("ingresos_profesionales").select(SELECT).gte("fecha", desde).lte("fecha", hasta).order("fecha", { ascending: false }).order("hora_programada");
  if (error) {
    if (/relation|does not exist|schema cache/i.test(error.message || "")) throw new Error("Falta correr la migración 204 en Supabase.");
    throw error;
  }
  return data.map(mapear);
}

// Marca la llegada (o la ausencia) de un profesional. Si no se pasa la hora, toma la de ahora. Un mismo profesional y turno solo se
// puede marcar una vez por día: si otra persona ya lo marcó, avisa.
export async function marcarIngreso({ fecha, profesionalId, turno, horaProgramada, estado = "Llegó", horaLlegada = null, manual = false, nota = null }) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Tenés que iniciar sesión.");
  const llegada = estado === "No vino" ? null : horaLlegada || horaAhora();
  const { data, error } = await supabase
    .from("ingresos_profesionales")
    .insert({
      fecha,
      profesional_id: profesionalId,
      turno,
      hora_programada: horaProgramada,
      estado,
      hora_llegada: llegada,
      margen_min: MARGEN_MIN,
      manual: Boolean(manual),
      nota: nota ? String(nota).trim() || null : null,
      marcado_por: user.id,
    })
    .select(SELECT)
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("Ese ingreso ya estaba marcado. Se actualiza la pantalla.");
    if (/relation|does not exist|schema cache/i.test(error.message || "")) throw new Error("Falta correr la migración 204 en Supabase.");
    throw error;
  }
  return mapear(data);
}

export async function deshacerIngreso(id) {
  const { data, error } = await supabase.from("ingresos_profesionales").delete().eq("id", id).select("id");
  if (error) throw error;
  if (!data?.length) throw new Error("Ya pasaron más de 15 minutos desde que se marcó: lo puede corregir una Dueña.");
}

// Resumen por profesional de una lista de ingresos ya cargados: cuántas veces llegó a tiempo, justo, tarde o no vino, el promedio de
// minutos de anticipación (solo cuando llegó) y el porcentaje de cumplimiento sobre los ingresos marcados.
export function resumenPorProfesional(ingresos) {
  const porProfesional = new Map();
  for (const i of ingresos) {
    const r = porProfesional.get(i.profesionalId) || { profesionalId: i.profesionalId, nombre: i.profesional, total: 0, aTiempo: 0, justo: 0, tarde: 0, noVino: 0, sumaAntes: 0, llegadas: 0 };
    const c = clasificarIngreso(i);
    r.total++;
    if (c.clave === "a-tiempo") r.aTiempo++;
    else if (c.clave === "justo") r.justo++;
    else if (c.clave === "tarde") r.tarde++;
    else r.noVino++;
    if (c.minutos !== null) {
      r.sumaAntes += c.minutos;
      r.llegadas++;
    }
    porProfesional.set(i.profesionalId, r);
  }
  return [...porProfesional.values()]
    .map((r) => ({ ...r, promedioAntes: r.llegadas ? Math.round(r.sumaAntes / r.llegadas) : null, cumplimiento: r.total ? Math.round((r.aTiempo / r.total) * 100) : null }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}
