import { supabase } from "@/lib/supabaseClient";
import { fechaDeHoyISO } from "@/lib/agenda";

function mapearFila(f) {
  return {
    id: f.id,
    usuarioId: f.usuario_id,
    fecha: f.fecha,
    // Postgres devuelve "time" con segundos (14:52:00) — se recorta a
    // "HH:MM" para que se vea prolijo en toda la app.
    horaEntrada: f.hora_entrada ? f.hora_entrada.slice(0, 5) : null,
    horaSalida: f.hora_salida ? f.hora_salida.slice(0, 5) : null,
    observaciones: f.observaciones,
  };
}

// Horas trabajadas de un registro (null si todavía no marcó salida).
export function horasTrabajadas({ horaEntrada, horaSalida }) {
  if (!horaEntrada || !horaSalida) return null;
  const [he, me] = horaEntrada.split(":").map(Number);
  const [hs, ms] = horaSalida.split(":").map(Number);
  const minutos = hs * 60 + ms - (he * 60 + me);
  return minutos > 0 ? minutos / 60 : 0;
}

export function formatoHoras(horas) {
  if (horas === null || horas === undefined) return "—";
  const h = Math.floor(horas);
  const m = Math.round((horas - h) * 60);
  return `${h}h ${m}m`;
}

// El registro de HOY del usuario logueado (para el widget de marcar
// entrada/salida) — null si todavía no marcó nada hoy.
export async function obtenerRegistroDeHoy() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from("registros_horario")
    .select("*")
    .eq("usuario_id", user.id)
    .eq("fecha", fechaDeHoyISO())
    .maybeSingle();
  if (error) throw error;
  return data ? mapearFila(data) : null;
}

export async function marcarEntrada() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const ahora = new Date().toTimeString().slice(0, 5);
  const { data, error } = await supabase
    .from("registros_horario")
    .insert({ usuario_id: user.id, fecha: fechaDeHoyISO(), hora_entrada: ahora })
    .select()
    .single();
  if (error) throw error;
  return mapearFila(data);
}

export async function marcarSalida(id) {
  const ahora = new Date().toTimeString().slice(0, 5);
  const { data, error } = await supabase
    .from("registros_horario")
    .update({ hora_salida: ahora, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return mapearFila(data);
}

export async function obtenerMisRegistros({ fechaInicio, fechaFin }) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("registros_horario")
    .select("*")
    .eq("usuario_id", user.id)
    .gte("fecha", fechaInicio)
    .lte("fecha", fechaFin)
    .order("fecha", { ascending: false });
  if (error) throw error;
  return data.map(mapearFila);
}

// Para la Dueña: todos los registros del período, con nombre/rol/valor
// hora de cada persona.
export async function obtenerTodosLosRegistros({ fechaInicio, fechaFin }) {
  const { data, error } = await supabase
    .from("registros_horario")
    .select("*, usuario:perfiles(nombre, rol, valor_hora)")
    .gte("fecha", fechaInicio)
    .lte("fecha", fechaFin)
    .order("fecha", { ascending: false });
  if (error) throw error;
  return data.map((f) => ({
    ...mapearFila(f),
    nombre: f.usuario?.nombre ?? "—",
    rol: f.usuario?.rol ?? "—",
    valorHora: f.usuario?.valor_hora === null ? null : Number(f.usuario?.valor_hora),
  }));
}

export async function actualizarRegistro(id, { horaEntrada, horaSalida, observaciones }) {
  const { data, error } = await supabase
    .from("registros_horario")
    .update({
      hora_entrada: horaEntrada || null,
      hora_salida: horaSalida || null,
      observaciones: observaciones || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return mapearFila(data);
}

export async function crearRegistroManual({ usuarioId, fecha, horaEntrada, horaSalida, observaciones }) {
  const { data, error } = await supabase
    .from("registros_horario")
    .insert({
      usuario_id: usuarioId,
      fecha,
      hora_entrada: horaEntrada || null,
      hora_salida: horaSalida || null,
      observaciones: observaciones || null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapearFila(data);
}

export async function eliminarRegistro(id) {
  const { error } = await supabase.from("registros_horario").delete().eq("id", id);
  if (error) throw error;
}

// Solo la Dueña puede escribir en perfiles (RLS ya existente).
export async function actualizarValorHora(usuarioId, valorHora) {
  const { error } = await supabase
    .from("perfiles")
    .update({ valor_hora: valorHora === "" || valorHora === null ? null : Number(valorHora) })
    .eq("id", usuarioId);
  if (error) throw error;
}

export async function obtenerPersonalConHorario() {
  const { data, error } = await supabase.from("perfiles").select("id, nombre, rol, valor_hora").order("nombre");
  if (error) throw error;
  return data.map((f) => ({ id: f.id, nombre: f.nombre, rol: f.rol, valorHora: f.valor_hora === null ? null : Number(f.valor_hora) }));
}
