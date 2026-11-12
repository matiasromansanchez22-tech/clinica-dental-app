import { supabase } from "@/lib/supabaseClient";

export const ZONA_HORARIA = "America/Argentina/Buenos_Aires";

const formateadorPartes = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_HORARIA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});

// Fecha (AAAA-MM-DD), hora (0-23) y día de la semana (0 = domingo) de un escaneo, en horario de Argentina.
export function partesLocales(creadoEn) {
  const p = Object.fromEntries(formateadorPartes.formatToParts(new Date(creadoEn)).map((x) => [x.type, x.value]));
  const fecha = `${p.year}-${p.month}-${p.day}`;
  return { fecha, hora: Number(p.hour), diaSemana: new Date(`${fecha}T12:00:00`).getDay() };
}

// Todos los escaneos desde una fecha (AAAA-MM-DD, horario de Argentina), de a tandas porque la base devuelve hasta 1000 filas por vez.
export async function obtenerEscaneosDesde(fechaDesde) {
  const filas = [];
  // "destino" (a qué página llevó el QR) existe desde la migración 198; si todavía no se corrió, todo cuenta como plan de referidos.
  let columnas = "created_at, lugar, visitante, dispositivo, destino";
  for (let desde = 0; desde < 50000; desde += 1000) {
    const pedir = () => {
      let consulta = supabase.from("qr_escaneos").select(columnas).order("created_at", { ascending: false }).range(desde, desde + 999);
      if (fechaDesde) consulta = consulta.gte("created_at", `${fechaDesde}T00:00:00-03:00`);
      return consulta;
    };
    let { data, error } = await pedir();
    if (error && columnas.includes("destino")) {
      columnas = "created_at, lugar, visitante, dispositivo";
      ({ data, error } = await pedir());
    }
    if (error) throw error;
    filas.push(...data.map((f) => ({ destino: "referidos", ...f })));
    if (data.length < 1000) break;
  }
  return filas;
}

// Turnos de Odontología General y de Ortodoncia por día (entre dos fechas AAAA-MM-DD): cuántos había agendados y cuántos vinieron.
// No cuentan los cancelados, los reprogramados ni los sobreturnos.
export async function obtenerTurnosPorDia(fechaDesde, fechaHasta) {
  const leer = async (tabla, campos) => {
    const filas = [];
    for (let desde = 0; desde < 20000; desde += 1000) {
      const { data, error } = await supabase
        .from(tabla)
        .select(campos)
        .gte("fecha", fechaDesde)
        .lte("fecha", fechaHasta)
        .order("id")
        .range(desde, desde + 999);
      if (error) throw error;
      filas.push(...data);
      if (data.length < 1000) break;
    }
    return filas;
  };
  const [general, ortodoncia] = await Promise.all([
    leer("turnos_general", "id, fecha, estado, confirmacion, presencia, asistencia"),
    leer("turnos_ortodoncia", "id, fecha, estado, confirmacion, presencia, asistencia, sobreturno"),
  ]);
  const vigente = (t) => t.estado !== "Cancelado" && t.estado !== "Reprogramado" && t.confirmacion !== "Reprogramar" && !t.sobreturno;
  const vino = (t) => ["En espera", "En consultorio", "Finalizado"].includes(t.presencia) || t.asistencia === "Asistió";
  const porDia = {};
  const dia = (fecha) => (porDia[fecha] ||= { general: 0, generalVino: 0, ortodoncia: 0, ortodonciaVino: 0 });
  for (const t of general.filter(vigente)) {
    dia(t.fecha).general++;
    if (vino(t)) dia(t.fecha).generalVino++;
  }
  for (const t of ortodoncia.filter(vigente)) {
    dia(t.fecha).ortodoncia++;
    if (vino(t)) dia(t.fecha).ortodonciaVino++;
  }
  return porDia;
}

export async function obtenerLugaresQr() {
  const { data, error } = await supabase.from("qr_lugares").select("*").order("orden").order("nombre");
  if (error) throw error;
  return data;
}

function aClave(nombre) {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export async function crearLugarQr(nombre) {
  const clave = aClave(nombre);
  if (!clave) throw new Error("Poné un nombre para el lugar.");
  const { data: max } = await supabase.from("qr_lugares").select("orden").order("orden", { ascending: false }).limit(1);
  const { data, error } = await supabase
    .from("qr_lugares")
    .insert({ clave, nombre: nombre.trim(), orden: (max?.[0]?.orden || 0) + 1 })
    .select()
    .single();
  if (error) throw error.code === "23505" ? new Error("Ya hay un lugar con ese nombre.") : error;
  return data;
}

export async function cambiarActivoLugarQr(id, activo) {
  const { error } = await supabase.from("qr_lugares").update({ activo }).eq("id", id);
  if (error) throw error;
}

// Cuántas personas quedaron anotadas como referidas (en recepción) desde una fecha: sirve para comparar con los escaneos.
export async function contarReferidosDesde(fechaDesde) {
  let consulta = supabase.from("referidos_ortodoncia").select("id", { count: "exact", head: true });
  if (fechaDesde) consulta = consulta.gte("fecha_registro", fechaDesde);
  const { count, error } = await consulta;
  if (error) throw error;
  return count || 0;
}
