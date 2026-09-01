import { supabase } from "@/lib/supabaseClient";
import { moverAPapelera } from "@/lib/data/papelera";

export async function obtenerPlanActivoPaciente(pacienteId) {
  const { data, error } = await supabase
    .from("planes_financiacion")
    .select("*")
    .eq("paciente_id", pacienteId)
    .eq("estado_plan", "Activo")
    .gt("saldo_pendiente", 0)
    .order("fecha", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function calcularSugerenciaPago(plan) {
  const anticipoPendiente = Math.max(Number(plan.anticipo_acordado) - Number(plan.anticipo_cobrado), 0);
  const debeCobrarAnticipo = anticipoPendiente > 0.009;
  const pagoSugerido = debeCobrarAnticipo
    ? Math.min(anticipoPendiente, plan.saldo_pendiente)
    : Math.min(plan.valor_cuota, plan.saldo_pendiente);
  return {
    pagoSugerido,
    numeroCuota: debeCobrarAnticipo ? "Anticipo" : plan.proxima_cuota || "",
  };
}

export async function obtenerPrestacionesParticular() {
  const { data, error } = await supabase
    .from("catalogo_prestaciones")
    .select("id, prestacion, valor_lista, valor_efectivo")
    .eq("estado", "Activo")
    .eq("particular", true)
    .order("prestacion");
  if (error) throw error;
  return data;
}

export async function obtenerPrestacionesObraSocial(obraSocial) {
  const { data, error } = await supabase
    .from("nomenclador")
    .select("id, codigo, prestacion_os, prestacion_interna, id_catalogo, copago_oficial, valor_os")
    .ilike("obra_social", obraSocial)
    .order("prestacion_os");
  if (error) throw error;
  return data;
}

export async function obtenerCobrosPorFecha(fecha) {
  const { data, error } = await supabase
    .from("caja_general")
    .select(
      `id, fecha, tipo, cobertura, modalidad, numero_cuota, prestaciones, importe_total, pago, medio_pago,
       estado_cobro, observaciones, id_documento, usuario_id, cerrado, created_at, precio_anterior,
       profesional_atencion_id, profesional_responsable_id,
       paciente:pacientes(apellido_y_nombre),
       profesional_atencion:profesionales!profesional_atencion_id(nombre),
       profesional_responsable:profesionales!profesional_responsable_id(nombre)`
    )
    .eq("fecha", fecha)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((f) => ({
    id: f.id,
    fecha: f.fecha,
    tipo: f.tipo,
    cobertura: f.cobertura,
    modalidad: f.modalidad,
    numeroCuota: f.numero_cuota,
    prestaciones: f.prestaciones || [],
    importeTotal: f.importe_total,
    pago: f.pago,
    medioPago: f.medio_pago,
    estadoCobro: f.estado_cobro,
    observaciones: f.observaciones,
    idDocumento: f.id_documento,
    usuarioId: f.usuario_id,
    cerrado: f.cerrado,
    createdAt: f.created_at,
    precioAnterior: f.precio_anterior,
    paciente: f.paciente?.apellido_y_nombre ?? "—",
    profesionalAtencionId: f.profesional_atencion_id,
    profesionalAtencion: f.profesional_atencion?.nombre ?? "—",
    profesionalResponsableId: f.profesional_responsable_id,
    profesionalResponsable: f.profesional_responsable?.nombre ?? null,
  }));
}

export async function crearCobro(datos) {
  const { data: caja, error } = await supabase
    .from("caja_general")
    .insert({
      fecha: datos.fecha,
      tipo: datos.tipo,
      cobertura: datos.cobertura,
      paciente_id: datos.pacienteId,
      profesional_responsable_id: datos.profesionalResponsableId || null,
      profesional_atencion_id: datos.profesionalAtencionId || null,
      modalidad: datos.modalidad,
      numero_cuota: datos.numeroCuota || null,
      prestaciones: datos.prestaciones || [],
      importe_total: datos.importeTotal,
      pago: datos.pago,
      medio_pago: datos.medioPago,
      saldo_pendiente: datos.saldoPendiente ?? null,
      observaciones: datos.observaciones || null,
      id_documento: datos.idDocumento || null,
      tipo_documento: datos.tipoDocumento || null,
      precio_anterior: Boolean(datos.precioAnterior),
    })
    .select()
    .single();
  if (error) throw error;

  // Regla del doc 3.6: al cobrar una prestación de obra social, se registra
  // automáticamente en Facturación a Obras Sociales (con el Valor OS, no el copago).
  if (datos.tipo === "Obra Social" && datos.prestaciones?.length) {
    const filas = datos.prestaciones.map((p) => ({
      fecha: datos.fecha,
      paciente_id: datos.pacienteId,
      dni: datos.dni || null,
      obra_social: datos.cobertura,
      numero_afiliado: datos.numeroAfiliado || null,
      profesional_id: datos.profesionalAtencionId || null,
      prestacion: p.prestacion,
      codigo: p.codigo || null,
      cantidad: p.cantidad,
      valor_os: p.valorOS || 0,
      sin_honorarios: Boolean(p.sinHonorarios),
      caja_id: caja.id,
    }));
    const { error: errorFactura } = await supabase.from("facturacion_obras_sociales").insert(filas);
    if (errorFactura) throw errorFactura;
  }

  if (datos.modalidad === "Plan de financiación" && datos.idDocumento) {
    await actualizarPlanDesdeCaja(datos.idDocumento);
  }

  return caja;
}

// Regla del doc 3.5/3.6: cada cobro registrado contra un plan actualiza el
// total pagado, el saldo, las cuotas pagadas y el estado del plan.
export async function actualizarPlanDesdeCaja(numeroPlan) {
  const { data: pagos, error: errorPagos } = await supabase
    .from("caja_general")
    .select("pago, fecha, medio_pago")
    .eq("id_documento", numeroPlan)
    .eq("tipo_documento", "Plan de financiación");
  if (errorPagos) throw errorPagos;

  const { data: plan, error: errorPlan } = await supabase
    .from("planes_financiacion")
    .select("*")
    .eq("numero_plan", numeroPlan)
    .single();
  if (errorPlan) throw errorPlan;

  const { data: pagosHistoricos, error: errorHistoricos } = await supabase
    .from("planes_pagos_historicos")
    .select("monto, fecha")
    .eq("plan_id", plan.id);
  if (errorHistoricos) throw errorHistoricos;

  const totalPagado =
    pagos.reduce((acc, p) => acc + Number(p.pago), 0) +
    pagosHistoricos.reduce((acc, p) => acc + Number(p.monto), 0);
  const pagado = Math.min(totalPagado, plan.total_tratamiento);
  const saldoPendiente = Math.max(plan.total_tratamiento - pagado, 0);
  const finalizado = saldoPendiente <= 0.009;

  let cuotasPagadas = 0;
  if (finalizado && plan.cantidad_cuotas > 0) {
    cuotasPagadas = plan.cantidad_cuotas;
  } else if (plan.valor_cuota > 0) {
    const pagadoParaCuotas = Math.max(pagado - plan.anticipo_acordado, 0);
    cuotasPagadas = Math.floor((pagadoParaCuotas + 0.009) / plan.valor_cuota);
    if (plan.cantidad_cuotas > 0) cuotasPagadas = Math.min(cuotasPagadas, plan.cantidad_cuotas);
  }

  const anticipoCobrado = Math.min(pagado, plan.anticipo_acordado);
  const proximaCuota =
    finalizado || plan.cantidad_cuotas <= 0 ? 0 : Math.min(cuotasPagadas + 1, plan.cantidad_cuotas);

  const ultimoPago = [...pagos].sort((a, b) => (a.fecha < b.fecha ? 1 : -1))[0];

  const { error } = await supabase
    .from("planes_financiacion")
    .update({
      total_pagado: pagado,
      anticipo_cobrado: anticipoCobrado,
      saldo_pendiente: saldoPendiente,
      estado_plan: finalizado ? "Finalizado" : "Activo",
      cuotas_pagadas: cuotasPagadas,
      proxima_cuota: proximaCuota,
      fecha_ultimo_pago: ultimoPago?.fecha || null,
      medio_pago_ultimo_pago: ultimoPago?.medio_pago || null,
      updated_at: new Date().toISOString(),
    })
    .eq("numero_plan", numeroPlan);
  if (error) throw error;
}

// Edición acotada a lo que se puede corregir sin riesgo de desincronizar
// facturación de obra social o el plan de financiación: fecha, monto,
// medio de pago y observaciones. El profesional que atendió queda afuera
// a propósito — se corrige borrando y cargando de nuevo, para que el
// equipo preste atención al cargarlo bien la primera vez. Para cambiar
// paciente/prestaciones/modalidad también hay que borrar y cargar de nuevo.
export async function actualizarCobro(cobro, datos) {
  const { error } = await supabase
    .from("caja_general")
    .update({
      fecha: datos.fecha,
      pago: datos.pago,
      medio_pago: datos.medioPago,
      observaciones: datos.observaciones || null,
      precio_anterior: Boolean(datos.precioAnterior),
    })
    .eq("id", cobro.id);
  if (error) throw error;

  // Si generó una fila en Facturación a Obras Sociales, mantenerla en
  // sincro con la fecha corregida.
  if (cobro.tipo === "Obra Social") {
    const { error: errorFactura } = await supabase
      .from("facturacion_obras_sociales")
      .update({ fecha: datos.fecha })
      .eq("caja_id", cobro.id);
    if (errorFactura) throw errorFactura;
  }

  if (cobro.modalidad === "Plan de financiación" && cobro.idDocumento) {
    await actualizarPlanDesdeCaja(cobro.idDocumento);
  }
}

// Para borrar un cobro mal cargado: si generó una fila en Facturación a
// Obras Sociales hay que borrarla primero (si no, la restricción de la
// base no deja borrar el cobro), y si era un pago de un plan de
// financiación hay que recalcular el plan sin ese pago.
export async function eliminarCobro(cobro) {
  await moverAPapelera("facturacion_obras_sociales", { caja_id: cobro.id });
  await moverAPapelera("caja_general", cobro.id);

  if (cobro.modalidad === "Plan de financiación" && cobro.idDocumento) {
    await actualizarPlanDesdeCaja(cobro.idDocumento);
  }
}
