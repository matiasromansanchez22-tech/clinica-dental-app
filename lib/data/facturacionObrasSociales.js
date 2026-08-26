import { supabase } from "@/lib/supabaseClient";

export const ESTADOS_FICHA = ["Pendiente", "Entregada", "Rechazada", "Liquidada"];

const SELECT_FICHA = `id, fecha, dni, obra_social, numero_afiliado, prestacion, codigo, cantidad, valor_os,
  estado_ficha, observaciones,
  paciente:pacientes(apellido_y_nombre),
  profesional:profesionales(nombre)`;

function mapearFila(f) {
  return {
    id: f.id,
    fecha: f.fecha,
    dni: f.dni,
    obraSocial: f.obra_social,
    numeroAfiliado: f.numero_afiliado,
    prestacion: f.prestacion,
    codigo: f.codigo,
    cantidad: f.cantidad,
    valorOS: Number(f.valor_os),
    estadoFicha: f.estado_ficha,
    observaciones: f.observaciones,
    paciente: f.paciente?.apellido_y_nombre ?? "—",
    profesional: f.profesional?.nombre ?? "—",
  };
}

export async function obtenerFacturacionObrasSociales(fechaInicio, fechaFin) {
  const { data, error } = await supabase
    .from("facturacion_obras_sociales")
    .select(SELECT_FICHA)
    .gte("fecha", fechaInicio)
    .lte("fecha", fechaFin)
    .order("obra_social")
    .order("fecha");
  if (error) throw error;
  return data.map(mapearFila);
}

export async function actualizarEstadoFicha(id, estadoFicha) {
  const { error } = await supabase.from("facturacion_obras_sociales").update({ estado_ficha: estadoFicha }).eq("id", id);
  if (error) throw error;
}

export async function actualizarEstadoFichaMasivo(ids, estadoFicha) {
  const { error } = await supabase.from("facturacion_obras_sociales").update({ estado_ficha: estadoFicha }).in("id", ids);
  if (error) throw error;
}
