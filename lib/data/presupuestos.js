import { supabase } from "@/lib/supabaseClient";
import { calcularAnticipoSugerido, calcularTotalPrestaciones, redondear } from "@/lib/presupuestos";
import { fechaDeHoyISO } from "@/lib/agenda";
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

// Avisa en vivo (sin traer el presupuesto entero, para no depender de a
// quién se lo junta) cada vez que se carga un presupuesto nuevo — la
// pantalla que escucha esto se encarga de buscar los datos completos y
// mostrar el aviso grande. Devuelve una función para cortar la
// suscripción al desmontar la pantalla.
export function suscribirseANuevosPresupuestos(alCrearse) {
  const canal = supabase
    .channel("presupuestos_nuevos_en_vivo")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "presupuestos" }, alCrearse)
    .subscribe();
  return () => {
    supabase.removeChannel(canal);
  };
}

// Avisa en vivo cada vez que un presupuesto pasa a "Aceptado" — o sea,
// justo cuando se cierra una venta — para festejarlo en pantalla. Mismo
// patrón que suscribirseANuevosPresupuestos.
export function suscribirseAPresupuestosAceptados(alAceptarse) {
  const canal = supabase
    .channel("presupuestos_aceptados_en_vivo")
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "presupuestos", filter: "estado=eq.Aceptado" },
      alAceptarse
    )
    .subscribe();
  return () => {
    supabase.removeChannel(canal);
  };
}

export async function obtenerPresupuestoPorId(id) {
  const { data, error } = await supabase.from("presupuestos").select(SELECT_PRESUPUESTO).eq("id", id).single();
  if (error) throw error;
  return mapearFilaPresupuesto(data);
}

// Aviso de consistencia: presupuestos que siguen en "Pendiente" (nunca se
// tocó "Aceptar") pero el paciente ya tiene cobros cargados en Caja desde
// la fecha del presupuesto en adelante — señal de que el tratamiento ya
// arrancó y se está cobrando de a poco, sin que quede un Plan de
// Financiación armado ni el presupuesto reflejando la realidad.
export async function obtenerPresupuestosPendientesConPagos() {
  const { data: presupuestos, error } = await supabase
    .from("presupuestos")
    .select("id, numero, fecha, total, paciente_id, paciente:pacientes(apellido_y_nombre)")
    .eq("estado", "Pendiente");
  if (error) throw error;
  if (presupuestos.length === 0) return [];

  const pacienteIds = [...new Set(presupuestos.map((p) => p.paciente_id).filter(Boolean))];
  if (pacienteIds.length === 0) return [];

  const { data: cobros, error: errorCobros } = await supabase
    .from("caja_general")
    .select("paciente_id, fecha, pago")
    .in("paciente_id", pacienteIds);
  if (errorCobros) throw errorCobros;

  return presupuestos
    .map((p) => {
      const cobrosDelPaciente = cobros.filter((c) => c.paciente_id === p.paciente_id && c.fecha >= p.fecha);
      return {
        id: p.id,
        numero: p.numero,
        fecha: p.fecha,
        total: Number(p.total),
        paciente: p.paciente?.apellido_y_nombre ?? "—",
        cantidadCobros: cobrosDelPaciente.length,
        totalCobrado: cobrosDelPaciente.reduce((acc, c) => acc + Number(c.pago), 0),
      };
    })
    .filter((p) => p.cantidadCobros > 0)
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
}

// Para el puntito rojo del menú — reusa la misma función de arriba y solo
// devuelve cuántos quedan pendientes de revisar.
export async function obtenerCantidadPresupuestosPendientesConPagos() {
  const lista = await obtenerPresupuestosPendientesConPagos();
  return lista.length;
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
  const presupuesto = mapearFilaPresupuesto(data);

  // Avisa por notificación push a las Secretarias para que lo impriman y
  // lo lleven al consultorio — nunca frena ni rompe la carga del
  // presupuesto si esto falla (sin red, sin avisos activados, etc.).
  fetch("/api/avisos/enviar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      titulo: "📋 Nuevo presupuesto para imprimir",
      mensaje: `${presupuesto.paciente} — ${presupuesto.profesional} — $${Number(presupuesto.total).toLocaleString("es-AR")}`,
      url: `/presupuestos/${presupuesto.id}/imprimir`,
      roles: ["Secretaria"],
    }),
  }).catch(() => {});

  return presupuesto;
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

// Cuando el paciente no puede con el presupuesto completo pero sí acepta
// las prestaciones marcadas como prioridad (⭐): el presupuesto se recorta
// a solo esas (las demás quedan anotadas en observaciones, no se pierden),
// se recalcula el total/anticipo/saldo según esa plata nueva, y recién ahí
// se acepta y arma el plan — así el plan de financiación queda armado con
// lo que el paciente realmente se llevó, no con el presupuesto completo.
export async function aceptarPresupuestoConPrioridad(presupuesto, config) {
  const aceptadas = presupuesto.prestaciones.filter((p) => p.prioridad);
  const descartadas = presupuesto.prestaciones.filter((p) => !p.prioridad);
  if (aceptadas.length === 0) {
    throw new Error("Este presupuesto no tiene ninguna prestación marcada como prioridad.");
  }

  const nuevoTotal = calcularTotalPrestaciones(aceptadas);
  let nuevoAnticipo = presupuesto.anticipo;
  let nuevoSaldo = presupuesto.saldo;
  if (presupuesto.modalidadPago === "Contado") {
    nuevoAnticipo = nuevoTotal;
    nuevoSaldo = 0;
  } else if (presupuesto.modalidadPago === "Financiado") {
    nuevoAnticipo = calcularAnticipoSugerido(nuevoTotal, "Financiado", config);
    nuevoSaldo = redondear(nuevoTotal - nuevoAnticipo);
  }

  const [dia, mes, anio] = fechaDeHoyISO().split("-").reverse();
  const renglon = `[${dia}/${mes}/${anio}] El paciente aceptó solo las prestaciones prioritarias (⭐). Quedaron afuera: ${descartadas
    .map((d) => d.prestacion)
    .join(", ")} (presupuesto completo original: ${presupuesto.total.toLocaleString("es-AR")}).`;
  const observacionesNuevas = [presupuesto.observaciones, renglon].filter(Boolean).join("\n");

  const actualizado = await actualizarPresupuesto(presupuesto.id, {
    fecha: presupuesto.fecha,
    pacienteId: presupuesto.pacienteId,
    profesionalId: presupuesto.profesionalId,
    prestaciones: aceptadas,
    total: nuevoTotal,
    modalidadPago: presupuesto.modalidadPago,
    cantidadCuotas: presupuesto.cantidadCuotas,
    anticipo: nuevoAnticipo,
    saldo: nuevoSaldo,
    observaciones: observacionesNuevas,
  });

  await cambiarEstadoPresupuesto(actualizado, "Aceptado");
  return actualizado;
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
       fecha_ultimo_pago, medio_pago_ultimo_pago, observaciones,
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
    fechaUltimoPago: f.fecha_ultimo_pago,
    medioPagoUltimoPago: f.medio_pago_ultimo_pago,
    observaciones: f.observaciones,
  }));
}

// Para cuando se acuerda con el paciente un valor nuevo para el
// tratamiento (aumento o descuento) después de que el plan ya estaba
// aceptado — recalcula saldo, cuota y estado con la misma lógica que se
// usa cada vez que entra un pago, y deja un renglón en observaciones con
// la fecha y el motivo del cambio (nunca se pierde el valor anterior).
export async function actualizarTotalPlan(plan, nuevoTotal, motivo) {
  const { data: actual, error: errorActual } = await supabase
    .from("planes_financiacion")
    .select("*")
    .eq("id", plan.id)
    .single();
  if (errorActual) throw errorActual;

  const anticipoAcordado = Number(actual.anticipo_acordado) || 0;
  const cuotas = Number(actual.cantidad_cuotas) || 0;
  const saldoFinanciado = Math.max(nuevoTotal - anticipoAcordado, 0);
  const valorCuota = cuotas > 0 ? redondear(saldoFinanciado / cuotas) : 0;

  const pagado = Math.min(Number(actual.total_pagado) || 0, nuevoTotal);
  const saldoPendiente = Math.max(nuevoTotal - pagado, 0);
  const finalizado = saldoPendiente <= 0.009;

  let cuotasPagadas = 0;
  if (finalizado && cuotas > 0) {
    cuotasPagadas = cuotas;
  } else if (valorCuota > 0) {
    const pagadoParaCuotas = Math.max(pagado - anticipoAcordado, 0);
    cuotasPagadas = Math.floor((pagadoParaCuotas + 0.009) / valorCuota);
    if (cuotas > 0) cuotasPagadas = Math.min(cuotasPagadas, cuotas);
  }
  const proximaCuota = finalizado || cuotas <= 0 ? 0 : Math.min(cuotasPagadas + 1, cuotas);

  const [dia, mes, anio] = fechaDeHoyISO().split("-").reverse();
  const renglon = `[${dia}/${mes}/${anio}] Total actualizado de $${Number(actual.total_tratamiento).toLocaleString(
    "es-AR"
  )} a $${nuevoTotal.toLocaleString("es-AR")}${motivo ? ` — ${motivo}` : ""}.`;
  const observacionesNuevas = [actual.observaciones, renglon].filter(Boolean).join("\n");

  const { error } = await supabase
    .from("planes_financiacion")
    .update({
      total_tratamiento: nuevoTotal,
      saldo_financiado: saldoFinanciado,
      valor_cuota: valorCuota,
      saldo_pendiente: saldoPendiente,
      estado_plan: finalizado ? "Finalizado" : "Activo",
      cuotas_pagadas: cuotasPagadas,
      proxima_cuota: proximaCuota,
      observaciones: observacionesNuevas,
      updated_at: new Date().toISOString(),
    })
    .eq("id", plan.id);
  if (error) throw error;
}

// Junta en un solo historial, ordenado del más reciente al más viejo, los
// pagos reales cobrados en Caja para este plan y los pagos históricos
// cargados a mano (de antes de usar la app) — para ver de un vistazo
// cuándo fue cada pago, con qué medio y qué observación tenía, sin tener
// que ir a buscarlo a Caja aparte.
export async function obtenerHistorialPagosPlan(plan) {
  const [{ data: pagosCaja, error: e1 }, { data: pagosHistoricos, error: e2 }] = await Promise.all([
    supabase
      .from("caja_general")
      .select("id, fecha, pago, medio_pago, observaciones")
      .eq("id_documento", plan.numeroPlan)
      .eq("tipo_documento", "Plan de financiación"),
    supabase.from("planes_pagos_historicos").select("id, fecha, monto, observaciones").eq("plan_id", plan.id),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const deCaja = (pagosCaja || []).map((p) => ({
    id: `caja-${p.id}`,
    fecha: p.fecha,
    monto: Number(p.pago),
    medioPago: p.medio_pago,
    observaciones: p.observaciones,
    origen: "Caja",
  }));
  const historicos = (pagosHistoricos || []).map((p) => ({
    id: `historico-${p.id}`,
    fecha: p.fecha,
    monto: Number(p.monto),
    medioPago: null,
    observaciones: p.observaciones,
    origen: "Histórico",
    idOriginal: p.id,
  }));

  return [...deCaja, ...historicos].sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
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
