import { supabase } from "@/lib/supabaseClient";
import { redondear } from "@/lib/presupuestos";
import { actualizarPlanDesdeCaja } from "@/lib/data/caja";
import { moverAPapelera } from "@/lib/data/papelera";

const SELECT_PRESUPUESTO = `id, numero, fecha, estado, prestaciones, total, modalidad_pago,
  cantidad_cuotas, anticipo, saldo, fecha_aceptacion, observaciones, paciente_id, profesional_id,
  paciente:pacientes(apellido_y_nombre, tipo_paciente, dni, celular),
  profesional:profesionales(nombre)`;

function mapearFilaPresupuesto(f) {
  return {
    id: f.id,
    numero: f.numero,
    fecha: f.fecha,
    estado: f.estado,
    prestaciones: f.prestaciones || [],
    total: f.total,
    modalidadPago: f.modalidad_pago,
    cantidadCuotas: f.cantidad_cuotas,
    anticipo: f.anticipo,
    saldo: f.saldo,
    fechaAceptacion: f.fecha_aceptacion,
    observaciones: f.observaciones,
    pacienteId: f.paciente_id,
    paciente: f.paciente?.apellido_y_nombre ?? "—",
    pacienteDni: f.paciente?.dni ?? "",
    pacienteCelular: f.paciente?.celular ?? "",
    tipoPaciente: f.paciente?.tipo_paciente,
    profesionalId: f.profesional_id,
    profesional: f.profesional?.nombre ?? "—",
  };
}

export async function obtenerPresupuestos() {
  const { data, error } = await supabase
    .from("presupuestos")
    .select(SELECT_PRESUPUESTO)
    .order("numero", { ascending: false });
  if (error) throw error;
  return data.map(mapearFilaPresupuesto);
}

export async function obtenerPresupuestoPorId(id) {
  const { data, error } = await supabase.from("presupuestos").select(SELECT_PRESUPUESTO).eq("id", id).single();
  if (error) throw error;
  return mapearFilaPresupuesto(data);
}

async function generarNumeroPresupuesto() {
  const anio = new Date().getFullYear();
  const { data, error } = await supabase.from("presupuestos").select("numero").ilike("numero", `P-${anio}-%`);
  if (error) throw error;
  let mayor = 0;
  data.forEach((f) => {
    const match = f.numero.match(/^P-(\d{4})-(\d{6})$/);
    if (match && Number(match[2]) > mayor) mayor = Number(match[2]);
  });
  return `P-${anio}-${String(mayor + 1).padStart(6, "0")}`;
}

async function generarNumeroPlan() {
  const anio = new Date().getFullYear();
  const { data, error } = await supabase.from("planes_financiacion").select("numero_plan").ilike("numero_plan", `PF-${anio}-%`);
  if (error) throw error;
  let mayor = 0;
  data.forEach((f) => {
    const match = f.numero_plan.match(/^PF-(\d{4})-(\d{6})$/);
    if (match && Number(match[2]) > mayor) mayor = Number(match[2]);
  });
  return `PF-${anio}-${String(mayor + 1).padStart(6, "0")}`;
}

export async function crearPresupuesto(datos) {
  const numero = await generarNumeroPresupuesto();
  const { data, error } = await supabase
    .from("presupuestos")
    .insert({
      numero,
      fecha: datos.fecha,
      paciente_id: datos.pacienteId,
      profesional_id: datos.profesionalId || null,
      prestaciones: datos.prestaciones,
      total: datos.total,
      modalidad_pago: datos.modalidadPago || null,
      cantidad_cuotas: datos.cantidadCuotas || null,
      anticipo: datos.anticipo ?? null,
      saldo: datos.saldo ?? null,
      observaciones: datos.observaciones || null,
    })
    .select(SELECT_PRESUPUESTO)
    .single();
  if (error) throw error;
  return mapearFilaPresupuesto(data);
}

export async function actualizarPresupuesto(id, datos) {
  const { data, error } = await supabase
    .from("presupuestos")
    .update({
      fecha: datos.fecha,
      paciente_id: datos.pacienteId,
      profesional_id: datos.profesionalId || null,
      prestaciones: datos.prestaciones,
      total: datos.total,
      modalidad_pago: datos.modalidadPago || null,
      cantidad_cuotas: datos.cantidadCuotas || null,
      anticipo: datos.anticipo ?? null,
      saldo: datos.saldo ?? null,
      observaciones: datos.observaciones || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(SELECT_PRESUPUESTO)
    .single();
  if (error) throw error;
  return mapearFilaPresupuesto(data);
}

// Regla crítica (doc 3.4): al pasar a "Aceptado" se crea o reactiva el Plan de
// Financiación asociado. Al pasar a "Anulado", el plan se cancela pero conserva
// su historial de pagos — nunca se borra información.
export async function cambiarEstadoPresupuesto(presupuesto, nuevoEstado) {
  const cambios = { estado: nuevoEstado, updated_at: new Date().toISOString() };
  if (nuevoEstado === "Aceptado" && !presupuesto.fechaAceptacion) {
    cambios.fecha_aceptacion = new Date().toISOString().slice(0, 10);
  }

  const { error } = await supabase.from("presupuestos").update(cambios).eq("id", presupuesto.id);
  if (error) throw error;

  if (nuevoEstado === "Aceptado") {
    await crearOActualizarPlan(presupuesto);
  } else if (nuevoEstado === "Anulado") {
    await supabase
      .from("planes_financiacion")
      .update({ estado_plan: "Cancelado", updated_at: new Date().toISOString() })
      .eq("numero_presupuesto", presupuesto.numero);
  }
}

async function crearOActualizarPlan(presupuesto) {
  const cuotas = presupuesto.modalidadPago === "Contado" ? 1 : Number(presupuesto.cantidadCuotas) || 0;
  const anticipo = Number(presupuesto.anticipo) || 0;
  const saldo = Number(presupuesto.saldo) || 0;
  const valorCuota = cuotas > 0 ? redondear(saldo / cuotas) : 0;

  const { data: existente } = await supabase
    .from("planes_financiacion")
    .select("id, numero_plan, estado_plan")
    .eq("numero_presupuesto", presupuesto.numero)
    .maybeSingle();

  if (existente) {
    const { error } = await supabase
      .from("planes_financiacion")
      .update({
        total_tratamiento: presupuesto.total,
        anticipo_acordado: anticipo,
        saldo_financiado: saldo,
        cantidad_cuotas: cuotas,
        valor_cuota: valorCuota,
        saldo_pendiente: saldo,
        estado_plan: presupuesto.total <= 0 ? "Finalizado" : "Activo",
        updated_at: new Date().toISOString(),
      })
      .eq("id", existente.id);
    if (error) throw error;
    return;
  }

  const numeroPlan = await generarNumeroPlan();
  const { error } = await supabase.from("planes_financiacion").insert({
    numero_plan: numeroPlan,
    presupuesto_id: presupuesto.id,
    numero_presupuesto: presupuesto.numero,
    fecha: presupuesto.fechaAceptacion || presupuesto.fecha,
    paciente_id: presupuesto.pacienteId,
    profesional_id: presupuesto.profesionalId || null,
    total_tratamiento: presupuesto.total,
    anticipo_acordado: anticipo,
    anticipo_cobrado: 0,
    saldo_financiado: saldo,
    cantidad_cuotas: cuotas,
    valor_cuota: valorCuota,
    total_pagado: 0,
    saldo_pendiente: presupuesto.total,
    cuotas_pagadas: 0,
    proxima_cuota: cuotas > 0 ? 1 : 0,
    estado_plan: presupuesto.total <= 0 ? "Finalizado" : "Activo",
  });
  if (error) throw error;
}

export async function obtenerPlanesFinanciacion() {
  const { data, error } = await supabase
    .from("planes_financiacion")
    .select(
      `id, numero_plan, numero_presupuesto, fecha, total_tratamiento, anticipo_acordado, anticipo_cobrado,
       saldo_financiado, cantidad_cuotas, valor_cuota, total_pagado, saldo_pendiente, cuotas_pagadas,
       proxima_cuota, proximo_vencimiento, estado_plan, estado_cobranza, dias_atraso,
       paciente:pacientes(apellido_y_nombre), profesional:profesionales(nombre)`
    )
    .order("numero_plan", { ascending: false });
  if (error) throw error;
  return data.map((f) => ({
    id: f.id,
    numeroPlan: f.numero_plan,
    numeroPresupuesto: f.numero_presupuesto,
    fecha: f.fecha,
    paciente: f.paciente?.apellido_y_nombre ?? "—",
    profesional: f.profesional?.nombre ?? "—",
    totalTratamiento: f.total_tratamiento,
    anticipoAcordado: f.anticipo_acordado,
    anticipoCobrado: f.anticipo_cobrado,
    saldoFinanciado: f.saldo_financiado,
    cantidadCuotas: f.cantidad_cuotas,
    valorCuota: f.valor_cuota,
    totalPagado: f.total_pagado,
    saldoPendiente: f.saldo_pendiente,
    cuotasPagadas: f.cuotas_pagadas,
    proximaCuota: f.proxima_cuota,
    proximoVencimiento: f.proximo_vencimiento,
    estadoPlan: f.estado_plan,
    estadoCobranza: f.estado_cobranza,
    diasAtraso: f.dias_atraso,
  }));
}

// Pagos hechos antes de usar la app (u por fuera de Caja): descuentan del
// saldo del plan igual que un cobro, pero sin generar ningún movimiento en
// Caja, Balance ni Cierre Diario.
export async function obtenerPagosHistoricosPlan(planId) {
  const { data, error } = await supabase
    .from("planes_pagos_historicos")
    .select("*")
    .eq("plan_id", planId)
    .order("fecha", { ascending: false });
  if (error) throw error;
  return data;
}

export async function registrarPagoHistoricoPlan({ planId, fecha, monto, observaciones }) {
  const { data: plan, error: errorPlan } = await supabase
    .from("planes_financiacion")
    .select("numero_plan")
    .eq("id", planId)
    .single();
  if (errorPlan) throw errorPlan;

  const { error } = await supabase
    .from("planes_pagos_historicos")
    .insert({ plan_id: planId, fecha, monto: Number(monto), observaciones: observaciones || null });
  if (error) throw error;

  await actualizarPlanDesdeCaja(plan.numero_plan);
}

export async function eliminarPagoHistoricoPlan(pago) {
  const { data: plan, error: errorPlan } = await supabase
    .from("planes_financiacion")
    .select("numero_plan")
    .eq("id", pago.plan_id)
    .single();
  if (errorPlan) throw errorPlan;

  await moverAPapelera("planes_pagos_historicos", pago.id);

  await actualizarPlanDesdeCaja(plan.numero_plan);
}
