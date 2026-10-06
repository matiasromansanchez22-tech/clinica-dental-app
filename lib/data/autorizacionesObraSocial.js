import { supabase } from "@/lib/supabaseClient";

export const ESTADOS_AUTORIZACION = ["Para autorizar", "Autorizada"];

function mapearFila(f) {
  return {
    id: f.id,
    pacienteId: f.paciente_id,
    pacienteNombre: f.paciente?.apellido_y_nombre || "(paciente borrado)",
    obraSocial: f.obra_social,
    numeroAfiliado: f.numero_afiliado,
    prestacion: f.prestacion,
    estado: f.estado,
    fechaPedido: f.fecha_pedido,
    fechaAutorizacion: f.fecha_autorizacion,
    numeroAutorizacion: f.numero_autorizacion,
    observaciones: f.observaciones,
  };
}

const SELECT = "*, paciente:pacientes(apellido_y_nombre)";

export async function obtenerAutorizaciones() {
  const { data, error } = await supabase
    .from("autorizaciones_obra_social")
    .select(SELECT)
    .order("fecha_pedido", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(mapearFila);
}

export async function obtenerCantidadParaAutorizar() {
  const { count, error } = await supabase
    .from("autorizaciones_obra_social")
    .select("id", { count: "exact", head: true })
    .eq("estado", "Para autorizar");
  if (error) throw error;
  return count || 0;
}

function aFila(datos) {
  return {
    paciente_id: datos.pacienteId,
    obra_social: datos.obraSocial.trim(),
    numero_afiliado: datos.numeroAfiliado?.trim() || null,
    prestacion: datos.prestacion.trim(),
    estado: datos.estado,
    fecha_pedido: datos.fechaPedido,
    fecha_autorizacion: datos.estado === "Autorizada" ? datos.fechaAutorizacion || null : null,
    numero_autorizacion: datos.numeroAutorizacion?.trim() || null,
    observaciones: datos.observaciones?.trim() || null,
  };
}

export async function crearAutorizacion(datos) {
  const { error } = await supabase.from("autorizaciones_obra_social").insert(aFila(datos));
  if (error) throw error;
}

export async function actualizarAutorizacion(id, datos) {
  const { error } = await supabase
    .from("autorizaciones_obra_social")
    .update({ ...aFila(datos), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function eliminarAutorizacion(id) {
  const { error } = await supabase.from("autorizaciones_obra_social").delete().eq("id", id);
  if (error) throw error;
}
