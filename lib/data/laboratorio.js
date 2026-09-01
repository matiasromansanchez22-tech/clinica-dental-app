import { supabase } from "@/lib/supabaseClient";
import { fechaDeHoyISO } from "@/lib/agenda";
import { moverAPapelera } from "@/lib/data/papelera";

export const ESTADOS_LABORATORIO = [
  "Pendiente de envío",
  "Enviado al mecánico",
  "Recibido del mecánico",
  "Prueba con el paciente",
  "Ajuste pendiente",
  "Entregado",
];

export const TIPOS_EVENTO = [
  "Enviado al mecánico",
  "Recibido del mecánico",
  "Prueba con el paciente",
  "Ajuste - reenviado",
  "Alta / Entregado",
];

function mapearTrabajo(f) {
  return {
    id: f.id,
    tipoPaciente: f.tipo_paciente,
    pacienteId: f.paciente_id,
    pacienteNombre: f.paciente_nombre,
    profesionalId: f.profesional_id,
    profesional: f.profesional?.nombre ?? "—",
    tipoTrabajo: f.tipo_trabajo,
    pieza: f.pieza,
    laboratorio: f.laboratorio,
    estado: f.estado,
    fechaInicio: f.fecha_inicio,
    fechaUltimoEvento: f.fecha_ultimo_evento,
    fechaAlta: f.fecha_alta,
    observaciones: f.observaciones,
    valor: f.valor === null ? null : Number(f.valor),
  };
}

const SELECT_TRABAJO = `id, tipo_paciente, paciente_id, paciente_nombre, profesional_id, tipo_trabajo, pieza,
  laboratorio, estado, fecha_inicio, fecha_ultimo_evento, fecha_alta, observaciones, valor,
  profesional:profesionales(nombre)`;

export async function obtenerTrabajosLaboratorio({ soloActivos = false } = {}) {
  let query = supabase.from("laboratorio_trabajos").select(SELECT_TRABAJO).order("fecha_ultimo_evento");
  if (soloActivos) query = query.neq("estado", "Entregado");
  const { data, error } = await query;
  if (error) throw error;
  return data.map(mapearTrabajo);
}

// Al cargar un trabajo queda "Pendiente de envío" — todavía no se marcó
// como mandado al mecánico. Eso se hace después, a mano, con
// marcarTrabajoEnviado (o agregando el evento "Enviado al mecánico" desde
// el detalle), justo cuando realmente se envía.
export async function crearTrabajoLaboratorio(datos) {
  const hoy = fechaDeHoyISO();
  const { data, error } = await supabase
    .from("laboratorio_trabajos")
    .insert({
      tipo_paciente: datos.tipoPaciente,
      paciente_id: datos.pacienteId,
      paciente_nombre: datos.pacienteNombre,
      profesional_id: datos.profesionalId || null,
      tipo_trabajo: datos.tipoTrabajo,
      pieza: datos.pieza || null,
      laboratorio: datos.laboratorio || null,
      estado: "Pendiente de envío",
      fecha_inicio: datos.fechaInicio || hoy,
      fecha_ultimo_evento: datos.fechaInicio || hoy,
      observaciones: datos.observaciones || null,
      valor: datos.valor === "" || datos.valor === null || datos.valor === undefined ? null : Number(datos.valor),
    })
    .select(SELECT_TRABAJO)
    .single();
  if (error) throw error;

  return mapearTrabajo(data);
}

export async function marcarTrabajoEnviado(trabajoId, fecha) {
  await agregarEventoTrabajo(trabajoId, { fecha, tipoEvento: "Enviado al mecánico", observaciones: "" });
}

export async function obtenerEventosTrabajo(trabajoId) {
  const { data, error } = await supabase
    .from("laboratorio_eventos")
    .select("id, fecha, tipo_evento, observaciones")
    .eq("trabajo_id", trabajoId)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((e) => ({ id: e.id, fecha: e.fecha, tipoEvento: e.tipo_evento, observaciones: e.observaciones }));
}

// Fecha real de envío de cada trabajo (la primera vez que se marcó
// "Enviado al mecánico"), para agrupar "Cuentas por mecánico" por cuándo
// se mandó de verdad y no por cuándo se cargó el trabajo en el sistema.
export async function obtenerFechasEnvioPorTrabajo() {
  const { data, error } = await supabase
    .from("laboratorio_eventos")
    .select("trabajo_id, fecha")
    .eq("tipo_evento", "Enviado al mecánico")
    .order("fecha", { ascending: true });
  if (error) throw error;
  const mapa = {};
  for (const e of data) {
    if (!mapa[e.trabajo_id]) mapa[e.trabajo_id] = e.fecha;
  }
  return mapa;
}

// Cada evento nuevo actualiza el estado y la fecha "de referencia" del
// trabajo (para el semáforo de demora). Si el evento es la entrega final,
// también cierra el trabajo con fecha_alta.
export async function agregarEventoTrabajo(trabajoId, { fecha, tipoEvento, observaciones }) {
  const { error: errorEvento } = await supabase.from("laboratorio_eventos").insert({
    trabajo_id: trabajoId,
    fecha,
    tipo_evento: tipoEvento,
    observaciones: observaciones || null,
  });
  if (errorEvento) throw errorEvento;

  const nuevoEstado = tipoEvento === "Alta / Entregado" ? "Entregado" : tipoEvento === "Ajuste - reenviado" ? "Ajuste pendiente" : tipoEvento;
  const cambios = {
    estado: nuevoEstado,
    fecha_ultimo_evento: fecha,
    updated_at: new Date().toISOString(),
  };
  if (tipoEvento === "Alta / Entregado") cambios.fecha_alta = fecha;

  const { error: errorUpdate } = await supabase.from("laboratorio_trabajos").update(cambios).eq("id", trabajoId);
  if (errorUpdate) throw errorUpdate;
}

export async function eliminarTrabajoLaboratorio(id) {
  await moverAPapelera("laboratorio_trabajos", id);
}

export async function actualizarValorTrabajo(id, valor) {
  const { error } = await supabase
    .from("laboratorio_trabajos")
    .update({ valor: valor === "" || valor === null ? null : Number(valor), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function obtenerConfiguracionLaboratorio() {
  const { data, error } = await supabase.from("configuracion_laboratorio").select("*");
  if (error) throw error;
  const mapa = {};
  data.forEach((f) => (mapa[f.clave] = Number(f.valor)));
  return mapa;
}

// Semáforo de demora: días desde el último evento, comparado con la
// configuración (por defecto 5 días amarillo, 10 días rojo).
export function calcularEstadoDemora(fechaUltimoEventoISO, estado, config = {}) {
  if (estado === "Entregado") return { emoji: "✅", texto: "Entregado", color: "text-emerald-600" };
  const diasAlerta = config.dias_alerta_demora ?? 5;
  const diasUrgente = config.dias_urgente_demora ?? 10;
  const hoy = new Date(fechaDeHoyISO() + "T12:00:00");
  const inicio = new Date(fechaUltimoEventoISO + "T12:00:00");
  const dias = Math.round((hoy - inicio) / (1000 * 60 * 60 * 24));
  if (dias >= diasUrgente) return { emoji: "🔴", texto: `${dias} días sin novedades`, color: "text-red-600", dias };
  if (dias >= diasAlerta) return { emoji: "🟡", texto: `${dias} días sin novedades`, color: "text-amber-600", dias };
  return { emoji: "🟢", texto: `${dias} día${dias === 1 ? "" : "s"}`, color: "text-emerald-600", dias };
}
