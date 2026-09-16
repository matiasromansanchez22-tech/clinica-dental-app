import { supabase } from "@/lib/supabaseClient";
import { moverAPapelera } from "@/lib/data/papelera";

export const ESTADOS_FICHA = ["Pendiente", "Entregada", "Rechazada", "Liquidada"];
export const CATEGORIAS_FICHA = ["Común", "Prótesis"];

// Solo Catalina está habilitada para estas tres — se factura y entrega en
// Entre Ríos, no por ASOR acá en el consultorio. Por eso viven aparte de
// "Control de Obras Sociales" (que sí es circuito ASOR local): quedan
// excluidas de ahí y de la conciliación de Pagos ASOR.
export const OBRAS_SOCIALES_ENTRE_RIOS = ["Swiss Medical", "Osde", "Sancor Salud"];
const FILTRO_EXCLUIR_ENTRE_RIOS = `(${OBRAS_SOCIALES_ENTRE_RIOS.map((o) => `"${o}"`).join(",")})`;

const SELECT_FICHA = `id, fecha, dni, obra_social, numero_afiliado, prestacion, codigo, cantidad, valor_os,
  estado_ficha, observaciones, sin_honorarios, paciente_id, categoria, caja_id,
  paciente:pacientes(apellido_y_nombre),
  profesional:profesionales(id, nombre, porcentaje_honorarios_os)`;

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
    sinHonorarios: Boolean(f.sin_honorarios),
    pacienteId: f.paciente_id,
    categoria: f.categoria || "Común",
    // Si no vino de un cobro de Caja (caja_id null), es una ficha cargada a
    // mano — se puede borrar directo desde acá. Si vino de Caja, para
    // borrarla hay que borrar el cobro (así no queda desincronizado).
    cargadaAMano: f.caja_id === null,
    paciente: f.paciente?.apellido_y_nombre ?? "—",
    profesionalId: f.profesional?.id ?? null,
    profesional: f.profesional?.nombre ?? "—",
    porcentajeHonorariosOS: Number(f.profesional?.porcentaje_honorarios_os ?? 20),
  };
}

// Resumen "de un pantallazo": por cada mes y profesional, cuántos
// pacientes distintos de obra social atendió y cuánto le corresponde
// cobrar de honorarios (mismo % que usa Producción y liquidación). Recibe
// las fichas ya cargadas (obtenerFacturacionObrasSociales) para no
// consultar la base dos veces.
export function agruparBalanceObrasSocialesPorProfesional(fichas) {
  const mapa = {};
  for (const f of fichas) {
    const mes = f.fecha.slice(0, 7);
    const profesionalId = f.profesionalId ?? "sin-asignar";
    const clave = `${mes}|${profesionalId}`;
    if (!mapa[clave]) {
      mapa[clave] = {
        mes,
        profesionalId,
        profesional: f.profesional,
        pacientesIds: new Set(),
        totalFacturado: 0,
        honorarios: 0,
      };
    }
    const entrada = mapa[clave];
    entrada.pacientesIds.add(f.pacienteId);
    entrada.totalFacturado += f.valorOS;
    if (!f.sinHonorarios) entrada.honorarios += f.valorOS * (f.porcentajeHonorariosOS / 100);
  }

  return Object.values(mapa)
    .map((e) => ({
      mes: e.mes,
      profesionalId: e.profesionalId,
      profesional: e.profesional,
      cantidadPacientes: e.pacientesIds.size,
      totalFacturado: e.totalFacturado,
      honorarios: e.honorarios,
    }))
    .sort((a, b) => (a.mes !== b.mes ? (a.mes < b.mes ? 1 : -1) : a.profesional.localeCompare(b.profesional)));
}

export async function obtenerFacturacionObrasSociales(fechaInicio, fechaFin) {
  const { data, error } = await supabase
    .from("facturacion_obras_sociales")
    .select(SELECT_FICHA)
    .gte("fecha", fechaInicio)
    .lte("fecha", fechaFin)
    .not("obra_social", "in", FILTRO_EXCLUIR_ENTRE_RIOS)
    .order("obra_social")
    .order("fecha");
  if (error) throw error;
  return data.map(mapearFila);
}

// Las fichas de Swiss Medical / Osde / Sancor Salud, aparte de las
// demás — Catalina se las lleva a facturar y entregar en Entre Ríos.
export async function obtenerFichasEntreRios(fechaInicio, fechaFin) {
  const { data, error } = await supabase
    .from("facturacion_obras_sociales")
    .select(SELECT_FICHA)
    .gte("fecha", fechaInicio)
    .lte("fecha", fechaFin)
    .in("obra_social", OBRAS_SOCIALES_ENTRE_RIOS)
    .order("obra_social")
    .order("fecha");
  if (error) throw error;
  return data.map(mapearFila);
}

// Carga manual de una ficha que no vino de un cobro de Caja (ej. una
// atención vieja que ya se cobró el coseguro pero nunca quedó cargada acá).
export async function crearFichaEntreRiosManual(datos) {
  const { error } = await supabase.from("facturacion_obras_sociales").insert({
    fecha: datos.fecha,
    paciente_id: datos.pacienteId,
    dni: datos.dni || null,
    obra_social: datos.obraSocial,
    numero_afiliado: datos.numeroAfiliado || null,
    profesional_id: datos.profesionalId || null,
    prestacion: datos.prestacion,
    codigo: datos.codigo || null,
    cantidad: datos.cantidad || 1,
    valor_os: datos.valorOS || 0,
    sin_honorarios: Boolean(datos.sinHonorarios),
    categoria: datos.categoria || "Común",
    observaciones: datos.observaciones || null,
  });
  if (error) throw error;
}

export async function eliminarFichaManual(id) {
  await moverAPapelera("facturacion_obras_sociales", id);
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
    .not("obra_social", "in", FILTRO_EXCLUIR_ENTRE_RIOS)
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

  await moverAPapelera("pagos_asor", id);
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
  await moverAPapelera("remitos_asor", id);
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
  await moverAPapelera("facturacion_asor_pacientes", id);
}

// Carga masiva desde el importador de PDF: cada línea trae
// {nroPresupuesto, paciente, nroDoc, codigoPrestacion, concepto, total, pendiente}.
export async function crearFacturacionAsorPacientesMasivo(obraSocial, lineas) {
  const registros = lineas.map((l) => ({
    obra_social: obraSocial,
    nro_presupuesto: l.nroPresupuesto,
    paciente: l.paciente,
    nro_doc: l.nroDoc || null,
    codigo_prestacion: l.codigoPrestacion || null,
    concepto: l.concepto || null,
    total_prestacion: l.total,
    pendiente_liquidar: l.pendiente,
  }));
  const { error } = await supabase.from("facturacion_asor_pacientes").insert(registros);
  if (error) throw error;
}
