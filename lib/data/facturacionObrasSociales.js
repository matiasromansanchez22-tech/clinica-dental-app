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

// Fichas "Entregadas" que todavía no se conciliaron contra ningún pago de
// ASOR — la bolsa de la que se elige qué corresponde a una transferencia.
export async function obtenerFichasPendientesDeConciliar() {
  const { data, error } = await supabase
    .from("facturacion_obras_sociales")
    .select(SELECT_FICHA)
    .eq("estado_ficha", "Entregada")
    .is("pago_asor_id", null)
    .order("obra_social")
    .order("fecha");
  if (error) throw error;
  return data.map(mapearFila);
}

function mapearPagoAsor(f) {
  return {
    id: f.id,
    fecha: f.fecha,
    monto: Number(f.monto),
    observaciones: f.observaciones,
  };
}

export async function obtenerPagosAsor(fechaInicio, fechaFin) {
  const { data, error } = await supabase
    .from("pagos_asor")
    .select("*")
    .gte("fecha", fechaInicio)
    .lte("fecha", fechaFin)
    .order("fecha", { ascending: false });
  if (error) throw error;
  return data.map(mapearPagoAsor);
}

export async function crearPagoAsor({ fecha, monto, observaciones }) {
  const { data, error } = await supabase
    .from("pagos_asor")
    .insert({ fecha, monto: Number(monto), observaciones: observaciones || null })
    .select()
    .single();
  if (error) throw error;
  return mapearPagoAsor(data);
}

export async function eliminarPagoAsor(id) {
  // Las fichas que estaban vinculadas vuelven a quedar disponibles para
  // conciliar contra otro pago (no se borra su facturación).
  const { error: errorDesvincular } = await supabase
    .from("facturacion_obras_sociales")
    .update({ pago_asor_id: null, estado_ficha: "Entregada" })
    .eq("pago_asor_id", id);
  if (errorDesvincular) throw errorDesvincular;

  const { error } = await supabase.from("pagos_asor").delete().eq("id", id);
  if (error) throw error;
}

export async function obtenerFichasVinculadasAPago(pagoAsorId) {
  const { data, error } = await supabase
    .from("facturacion_obras_sociales")
    .select(SELECT_FICHA)
    .eq("pago_asor_id", pagoAsorId)
    .order("obra_social")
    .order("fecha");
  if (error) throw error;
  return data.map(mapearFila);
}

// Marca las fichas elegidas como cubiertas por este pago y las pasa a
// "Liquidada" — el paso final de la conciliación.
export async function vincularFichasAPago(fichaIds, pagoAsorId) {
  const { error } = await supabase
    .from("facturacion_obras_sociales")
    .update({ pago_asor_id: pagoAsorId, estado_ficha: "Liquidada" })
    .in("id", fichaIds);
  if (error) throw error;
}

export async function desvincularFichaDePago(fichaId) {
  const { error } = await supabase
    .from("facturacion_obras_sociales")
    .update({ pago_asor_id: null, estado_ficha: "Entregada" })
    .eq("id", fichaId);
  if (error) throw error;
}

function mapearRemito(f) {
  return {
    id: f.id,
    obraSocial: f.obra_social,
    plan: f.plan,
    periodo: f.periodo,
    numeroRemito: f.numero_remito,
    totalPresupuestado: Number(f.total_presupuestado),
    totalPrestaciones: Number(f.total_prestaciones),
    descuentos: Number(f.descuentos),
    pendienteLiquidar: Number(f.pendiente_liquidar),
  };
}

export async function obtenerRemitosAsor() {
  const { data, error } = await supabase
    .from("remitos_asor")
    .select("*")
    .order("obra_social")
    .order("periodo", { ascending: false });
  if (error) throw error;
  return data.map(mapearRemito);
}

export async function crearRemitoAsor(datos) {
  const { error } = await supabase.from("remitos_asor").insert({
    obra_social: datos.obraSocial,
    plan: datos.plan || null,
    periodo: datos.periodo,
    numero_remito: datos.numeroRemito,
    total_presupuestado: datos.totalPresupuestado,
    total_prestaciones: datos.totalPrestaciones,
    descuentos: datos.descuentos,
    pendiente_liquidar: datos.pendienteLiquidar,
  });
  if (error) throw error;
}

export async function eliminarRemitoAsor(id) {
  const { error } = await supabase.from("remitos_asor").delete().eq("id", id);
  if (error) throw error;
}

function mapearFacturacionAsorPaciente(f) {
  return {
    id: f.id,
    obraSocial: f.obra_social,
    nroPresupuesto: f.nro_presupuesto,
    paciente: f.paciente,
    nroDoc: f.nro_doc,
    codigoPrestacion: f.codigo_prestacion,
    concepto: f.concepto,
    totalPrestacion: Number(f.total_prestacion),
    pendienteLiquidar: Number(f.pendiente_liquidar),
  };
}

export async function obtenerFacturacionAsorPacientes() {
  const { data, error } = await supabase
    .from("facturacion_asor_pacientes")
    .select("*")
    .order("obra_social")
    .order("paciente");
  if (error) throw error;
  return data.map(mapearFacturacionAsorPaciente);
}

export async function eliminarFacturacionAsorPaciente(id) {
  const { error } = await supabase.from("facturacion_asor_pacientes").delete().eq("id", id);
  if (error) throw error;
}
