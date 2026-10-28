import { supabase } from "@/lib/supabaseClient";
import { fechaDeHoyISO } from "@/lib/agenda";
import { obtenerProduccionPorProfesional } from "@/lib/data/produccionProfesionales";
import { obtenerCierresTurnoDelDia } from "@/lib/data/cierresTurno";
import { obtenerCierresTurnoOrtodonciaDelDia } from "@/lib/data/cierresTurnoOrtodoncia";
import { obtenerCierreDelDia } from "@/lib/data/cierresDia";
import { obtenerDetalleDiarioMes, obtenerBalanceMensual } from "@/lib/data/balance";
import { obtenerCategoriasGasto, gastoSaleDeLaReserva } from "@/lib/data/gastos";
import { calcularMovimientosEfectivoDeCaja } from "@/lib/data/efectivoDeCaja";
import { obtenerLiquidacionesDeCobros, obtenerCobrosDePagos } from "@/lib/data/cobrosLiquidados";
import { obtenerOtrosIngresosParaBalance } from "@/lib/data/otrosIngresos";

// Detalle del día (solo dueñas): sigue la plata de punta a punta para una fecha.
//   visita → cobro → qué se hizo → honorarios del profesional → pago al profesional
//   cobros en caja → cierres de turno → cierre diario aprobado → balance mensual
// y marca todo lo que no coincide.

const VINO = ["En espera", "En consultorio", "Finalizado"];
const MEDIOS = ["Efectivo", "Transferencia", "Débito", "Crédito", "Mercado Pago", "QR"];
const CLAVE_MEDIO = { Efectivo: "efectivo", Transferencia: "transferencia", "Débito": "debito", "Crédito": "credito", "Mercado Pago": "mercado_pago", QR: "qr" };
const TOLERANCIA = 1; // pesos
// Los pagos a profesionales se redondean al cargarlos: una diferencia chica contra lo calculado es normal.
const TOLERANCIA_PAGO = 500;
const esCopago = (tipo) => /^copago/i.test(tipo || "");

const norm = (t) => (t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
const num = (n) => Number(n || 0);

function vacioPorMedio() {
  return { efectivo: 0, transferencia: 0, debito: 0, credito: 0, mercado_pago: 0, qr: 0 };
}

function sumarPorMedio(acum, medio, monto) {
  const k = CLAVE_MEDIO[medio];
  if (k) acum[k] += num(monto);
}

function partesDePago(c, campoMonto) {
  return c.desglose_pago?.length ? c.desglose_pago.map((p) => ({ medio: p.medio, monto: num(p.monto) })) : [{ medio: c.medio_pago, monto: num(c[campoMonto]) }];
}

async function conFallbackDesglose(armar) {
  let r = await armar(true);
  if (r.error?.message?.includes("desglose_pago")) r = await armar(false);
  if (r.error) throw r.error;
  return r.data || [];
}

function rangoDelMes(fecha) {
  const [a, m] = fecha.split("-").map(Number);
  const ultimo = new Date(a, m, 0).getDate();
  const mm = String(m).padStart(2, "0");
  return { inicio: `${a}-${mm}-01`, fin: `${a}-${mm}-${String(ultimo).padStart(2, "0")}` };
}

export async function obtenerDetalleDelDia(fecha) {
  const hoy = fechaDeHoyISO();
  const { inicio: mesInicio, fin: mesFin } = rangoDelMes(fecha);

  const [
    profesionales, turnosG, turnosO, cajaG, cajaO, realizadas, factOS, pagosTodos, produccion, justificadas,
    cierresTurnoG, cierresTurnoO, cierreDia, gastos, categorias, detalleMes, balanceMes, otrosIngresos, asor,
    efectivoMovG, efectivoMovO,
  ] = await Promise.all([
    supabase.from("profesionales").select("id, nombre, especialidad").then((r) => { if (r.error) throw r.error; return r.data; }),
    supabase
      .from("turnos_general")
      .select("id, hora_inicio, tipo_atencion, cobertura, estado, presencia, asistencia, paciente_id, profesional_de_turno_id, paciente:pacientes(apellido_y_nombre)")
      .eq("fecha", fecha)
      .eq("estado", "Agendado")
      .order("hora_inicio")
      .then((r) => { if (r.error) throw r.error; return r.data; }),
    supabase
      .from("turnos_ortodoncia")
      .select("id, hora_inicio, concepto, estado, presencia, asistencia, paciente_id, ortodoncista_id, paciente:pacientes_ortodoncia(nombre, es_ortopedia)")
      .eq("fecha", fecha)
      .eq("estado", "Agendado")
      .order("hora_inicio")
      .then((r) => { if (r.error) throw r.error; return r.data; }),
    conFallbackDesglose((conDesglose) =>
      supabase
        .from("caja_general")
        .select(`id, pago, medio_pago, ${conDesglose ? "desglose_pago, " : ""}tipo, cobertura, modalidad, numero_cuota, id_documento, prestaciones, importe_total, saldo_pendiente, precio_anterior, profesional_atencion_id, paciente_id, created_at, paciente:pacientes(apellido_y_nombre)`)
        .eq("fecha", fecha)
        .order("created_at")
    ),
    conFallbackDesglose((conDesglose) =>
      supabase
        .from("caja_ortodoncia")
        .select(`id, importe, medio_pago, ${conDesglose ? "desglose_pago, " : ""}concepto, ortodoncista_id, paciente_id, descuento_referido, descuento_fidelidad, created_at, paciente:pacientes_ortodoncia(nombre, es_ortopedia)`)
        .eq("fecha", fecha)
        .order("created_at")
    ),
    supabase
      .from("prestaciones_realizadas_agenda")
      .select("id, paciente_id, paciente_ortodoncia_id, prestacion, cantidad, cobrado, caja_general_id, caja_ortodoncia_id, profesional_id")
      .eq("fecha", fecha)
      .then((r) => { if (r.error) throw r.error; return r.data; }),
    supabase
      .from("facturacion_obras_sociales")
      .select("id, paciente_id, obra_social, prestacion, valor_os, profesional_id, sin_honorarios")
      .eq("fecha", fecha)
      .then((r) => { if (r.error) throw r.error; return r.data; }),
    supabase
      .from("pagos_profesionales")
      .select("id, monto, tipo, medio_pago, origen, desde_reserva, observaciones, profesional_id")
      .eq("fecha", fecha)
      .then((r) => { if (r.error) throw r.error; return r.data; }),
    obtenerProduccionPorProfesional(fecha, fecha),
    supabase
      .from("visitas_sin_cobro_justificadas")
      .select("turno_ortodoncia_id, turno_general_id, motivo, nota")
      .eq("fecha", fecha)
      .then((r) => (r.error ? [] : r.data)),
    obtenerCierresTurnoDelDia(fecha),
    obtenerCierresTurnoOrtodonciaDelDia(fecha),
    obtenerCierreDelDia(fecha),
    supabase.from("gastos").select("id, monto, categoria, descripcion, medio_pago, desde_reserva, especialidad").eq("fecha", fecha).then((r) => { if (r.error) throw r.error; return r.data; }),
    obtenerCategoriasGasto(),
    obtenerDetalleDiarioMes(mesInicio, mesFin),
    obtenerBalanceMensual(mesInicio, mesFin),
    obtenerOtrosIngresosParaBalance(fecha, fecha),
    supabase.from("pagos_asor").select("monto").eq("fecha", fecha).then((r) => (r.error ? [] : r.data)),
    calcularMovimientosEfectivoDeCaja(fecha, "General"),
    calcularMovimientosEfectivoDeCaja(fecha, "Ortodoncia"),
  ]);

  const nombreProf = Object.fromEntries(profesionales.map((p) => [p.id, p.nombre]));
  const justificadaPorTurno = Object.fromEntries(justificadas.map((j) => [j.turno_ortodoncia_id || j.turno_general_id, j]));
  const [liqG, liqO] = await Promise.all([
    obtenerLiquidacionesDeCobros("general", cajaG.map((c) => c.id)),
    obtenerLiquidacionesDeCobros("ortodoncia", cajaO.map((c) => c.id)),
  ]);

  // ---------- por paciente ----------
  const filas = new Map();
  function fila(sistema, pacienteId, nombre) {
    const k = `${sistema}:${pacienteId}`;
    if (!filas.has(k)) {
      filas.set(k, { clave: k, sistema, pacienteId, paciente: (nombre || "(sin nombre)").trim(), turnos: [], cobros: [], os: [], realizadas: [], alertas: [], info: [] });
    }
    return filas.get(k);
  }
  const etiquetaSistema = (esOrtopedia) => (esOrtopedia ? "Ortopedia" : "Ortodoncia");

  for (const t of turnosG) {
    const vino = VINO.includes(t.presencia) && t.asistencia !== "No asistió";
    const sinMarcar = !vino && t.asistencia !== "No asistió" && t.asistencia !== "Canceló" && fecha < hoy;
    if (!vino && !sinMarcar) continue;
    const f = fila("General", t.paciente_id, t.paciente?.apellido_y_nombre);
    f.turnos.push({ id: t.id, hora: (t.hora_inicio || "").slice(0, 5), concepto: t.tipo_atencion, cobertura: t.cobertura, profesional: nombreProf[t.profesional_de_turno_id] || null, vino, sinMarcar, tipo: "general", justificada: justificadaPorTurno[t.id] || null, pacienteId: t.paciente_id });
  }
  for (const t of turnosO) {
    const vino = VINO.includes(t.presencia) && t.asistencia !== "No asistió";
    const sinMarcar = !vino && t.asistencia !== "No asistió" && t.asistencia !== "Canceló" && fecha < hoy;
    if (!vino && !sinMarcar) continue;
    const f = fila(etiquetaSistema(t.paciente?.es_ortopedia), t.paciente_id, t.paciente?.nombre);
    f.turnos.push({ id: t.id, hora: (t.hora_inicio || "").slice(0, 5), concepto: t.concepto, profesional: nombreProf[t.ortodoncista_id] || null, vino, sinMarcar, tipo: "ortodoncia", justificada: justificadaPorTurno[t.id] || null, pacienteId: t.paciente_id });
  }
  for (const c of cajaG) {
    const f = fila("General", c.paciente_id, c.paciente?.apellido_y_nombre);
    const prestaciones = c.prestaciones || [];
    f.cobros.push({
      id: c.id, tipo: "general", monto: num(c.pago), partes: partesDePago(c, "pago"),
      detalle: c.modalidad === "Plan de financiación" ? `Plan ${c.id_documento || ""} · ${c.numero_cuota == null ? "pago" : c.numero_cuota === "Anticipo" ? "anticipo" : `cuota ${c.numero_cuota}`}` : prestaciones.map((p) => p.prestacion + (num(p.cantidad) > 1 ? ` x${p.cantidad}` : "")).join(", ") || "(sin prestaciones cargadas)",
      cobertura: c.cobertura || c.tipo, esPlan: c.modalidad === "Plan de financiación", importeTotal: num(c.importe_total), saldo: num(c.saldo_pendiente),
      valorPrestaciones: prestaciones.reduce((a, p) => a + num(p.valor) * num(p.cantidad || 1), 0), sinPrestaciones: prestaciones.length === 0, precioAnterior: Boolean(c.precio_anterior),
      profesionalId: c.profesional_atencion_id, profesional: nombreProf[c.profesional_atencion_id] || null, liquidado: liqG[c.id] || null,
    });
  }
  for (const c of cajaO) {
    const f = fila(etiquetaSistema(c.paciente?.es_ortopedia), c.paciente_id, c.paciente?.nombre);
    const descuentos = num(c.descuento_referido) + num(c.descuento_fidelidad);
    f.cobros.push({
      id: c.id, tipo: "ortodoncia", monto: num(c.importe), partes: partesDePago(c, "importe"), detalle: c.concepto + (descuentos > 0 ? ` (con descuento de $${Math.round(descuentos).toLocaleString("es-AR")})` : ""),
      cobertura: "Particular", descuentos, valorNormal: num(c.importe) + descuentos, profesionalId: c.ortodoncista_id, profesional: nombreProf[c.ortodoncista_id] || null, liquidado: liqO[c.id] || null,
    });
  }
  for (const r of realizadas) {
    const f = r.paciente_ortodoncia_id ? null : r.paciente_id ? fila("General", r.paciente_id, null) : null;
    if (r.paciente_ortodoncia_id) {
      const k = [...filas.values()].find((x) => x.pacienteId === r.paciente_ortodoncia_id && x.sistema !== "General");
      if (k) k.realizadas.push({ prestacion: r.prestacion + (num(r.cantidad) > 1 ? ` x${r.cantidad}` : ""), cobrado: Boolean(r.cobrado), profesional: nombreProf[r.profesional_id] || null });
      else {
        const nueva = fila("Ortodoncia", r.paciente_ortodoncia_id, null);
        nueva.realizadas.push({ prestacion: r.prestacion, cobrado: Boolean(r.cobrado), profesional: nombreProf[r.profesional_id] || null });
      }
    } else if (f) {
      f.realizadas.push({ prestacion: r.prestacion + (num(r.cantidad) > 1 ? ` x${r.cantidad}` : ""), cobrado: Boolean(r.cobrado), profesional: nombreProf[r.profesional_id] || null });
    }
  }
  for (const o of factOS) {
    const f = fila("General", o.paciente_id, null);
    f.os.push({ obraSocial: o.obra_social, prestacion: o.prestacion, valor: num(o.valor_os), profesional: nombreProf[o.profesional_id] || null, sinHonorarios: Boolean(o.sin_honorarios) });
  }

  // nombres que faltan (filas creadas solo por prestaciones u obra social)
  const sinNombre = [...filas.values()].filter((f) => f.paciente === "(sin nombre)");
  if (sinNombre.length) {
    const idsG = sinNombre.filter((f) => f.sistema === "General").map((f) => f.pacienteId);
    const idsO = sinNombre.filter((f) => f.sistema !== "General").map((f) => f.pacienteId);
    if (idsG.length) {
      const { data } = await supabase.from("pacientes").select("id, apellido_y_nombre").in("id", idsG);
      for (const p of data || []) for (const f of sinNombre) if (f.sistema === "General" && f.pacienteId === p.id) f.paciente = p.apellido_y_nombre.trim();
    }
    if (idsO.length) {
      const { data } = await supabase.from("pacientes_ortodoncia").select("id, nombre, es_ortopedia").in("id", idsO);
      for (const p of data || []) for (const f of sinNombre) if (f.sistema !== "General" && f.pacienteId === p.id) { f.paciente = p.nombre.trim(); f.sistema = etiquetaSistema(p.es_ortopedia); }
    }
  }

  // honorarios por paciente (de Producción y liquidación), cruzados por nombre
  const honorariosPorNombre = {};
  for (const prof of produccion) {
    for (const d of prof.detalle) {
      if (d.tipo === "Obra social (a cobrar del intermediario)") continue;
      const k = norm(d.paciente);
      const e = (honorariosPorNombre[k] ||= { base: 0, honorarios: 0, profesionales: new Set() });
      if (!d.sinHonorarios) e.base += d.monto;
      e.honorarios += d.montoHonorarios;
      e.profesionales.add(prof.nombre);
    }
  }

  const alertasGlobales = [];
  const pacientes = [...filas.values()].map((f) => {
    f.cobrado = f.cobros.reduce((a, c) => a + c.monto, 0);
    f.vino = f.turnos.some((t) => t.vino);
    f.hora = f.turnos.map((t) => t.hora).sort()[0] || null;
    const h = honorariosPorNombre[norm(f.paciente)];
    f.honorarios = h ? h.honorarios : 0;
    f.baseHonorarios = h ? h.base : 0;
    f.profesionalesHonorarios = h ? [...h.profesionales] : [];
    const quien = `${f.paciente} (${f.sistema})`;
    const push = (nivel, texto) => { f.alertas.push({ nivel, texto }); alertasGlobales.push({ nivel, texto: `${quien}: ${texto}`, clave: f.clave }); };

    const turnoJustificado = f.turnos.find((t) => t.justificada);
    if (f.turnos.some((t) => t.sinMarcar)) push("revisar", "el turno de hoy quedó sin marcar si vino o no");
    if (f.vino && f.cobros.length === 0 && f.os.length === 0) {
      if (turnoJustificado) f.info.push(`Visita sin cobro justificada: ${turnoJustificado.justificada.motivo}${turnoJustificado.justificada.nota ? ` (${turnoJustificado.justificada.nota})` : ""}`);
      else push("alerta", "vino y no tiene ningún cobro cargado");
    }
    if (!f.vino && f.cobros.length > 0 && !f.cobros.every((c) => c.esPlan)) f.info.push("Pagó pero no figura que haya venido hoy (puede ser un pago adelantado o de otra visita)");
    for (const c of f.cobros) {
      if (!c.profesionalId) push("alerta", `un cobro de $${Math.round(c.monto).toLocaleString("es-AR")} no tiene profesional asignado (no se le puede liquidar a nadie)`);
      if (c.tipo === "general" && !c.esPlan && c.sinPrestaciones) push("alerta", `un cobro de $${Math.round(c.monto).toLocaleString("es-AR")} no tiene prestaciones cargadas (no se pueden calcular honorarios)`);
      if (c.tipo === "general" && !c.esPlan && !c.sinPrestaciones && !c.precioAnterior && c.cobertura !== "Obra Social") {
        const esperado = c.valorPrestaciones;
        const dif = c.monto + c.saldo - esperado;
        if (c.saldo > TOLERANCIA) f.info.push(`Pagó $${Math.round(c.monto).toLocaleString("es-AR")} y dejó un saldo de $${Math.round(c.saldo).toLocaleString("es-AR")}`);
        else if (Math.abs(c.monto - esperado) > TOLERANCIA && esperado > 0) push("revisar", `cobró $${Math.round(c.monto).toLocaleString("es-AR")} y las prestaciones suman $${Math.round(esperado).toLocaleString("es-AR")} (${dif > 0 ? "de más" : "de menos"}: $${Math.abs(Math.round(dif)).toLocaleString("es-AR")})`);
      }
    }
    const sinCobrar = f.realizadas.filter((r) => !r.cobrado);
    if (sinCobrar.length && f.cobros.length === 0 && f.os.length === 0) push("revisar", `el profesional cargó ${sinCobrar.map((r) => r.prestacion).join(", ")} y todavía no está cobrado`);
    const pendientesLiq = f.cobros.filter((c) => !c.liquidado).length;
    f.pendientesLiquidar = pendientesLiq;
    return f;
  });
  pacientes.sort((a, b) => (a.hora || "99").localeCompare(b.hora || "99") || a.paciente.localeCompare(b.paciente, "es"));

  // ---------- por profesional ----------
  const pagosDelDia = pagosTodos.map((p) => ({ ...p, monto: num(p.monto), profesional: nombreProf[p.profesional_id] || "—" }));
  const cobrosPorProf = {};
  for (const f of pacientes) for (const c of f.cobros) {
    const k = c.profesionalId || "sin-asignar";
    const e = (cobrosPorProf[k] ||= { cobrado: 0, cobros: 0, liquidados: 0 });
    e.cobrado += c.monto; e.cobros += 1; if (c.liquidado) e.liquidados += 1;
  }
  const idsProfesionales = new Set([...produccion.map((p) => p.profesionalId), ...Object.keys(cobrosPorProf), ...pagosDelDia.map((p) => p.profesional_id)]);
  const cobrosDePagos = await obtenerCobrosDePagos(pagosDelDia.map((p) => p.id));
  const profesionalesFilas = [...idsProfesionales].filter(Boolean).map((id) => {
    const prod = produccion.find((p) => p.profesionalId === id);
    const cobrosProf = cobrosPorProf[id] || { cobrado: 0, cobros: 0, liquidados: 0 };
    const pagos = pagosDelDia.filter((p) => p.profesional_id === id).map((p) => {
      const cubre = cobrosDePagos[p.id] || [];
      const sumaCubierta = cubre.reduce((a, c) => a + c.monto, 0);
      const pct = sumaCubierta > 0 ? (p.monto / sumaCubierta) * 100 : null;
      return { ...p, cubre, sumaCubierta, porcentajeSobreCubierto: pct };
    });
    const pagadoCopago = pagos.filter((p) => esCopago(p.tipo)).reduce((a, p) => a + p.monto, 0);
    const pagadoOS = pagos.filter((p) => !esCopago(p.tipo)).reduce((a, p) => a + p.monto, 0);
    const honorarios = prod ? prod.honorariosCopago : 0;
    return {
      profesionalId: id,
      nombre: nombreProf[id] || "(sin asignar)",
      porcentaje: prod?.porcentajeCopago ?? null,
      cobrado: cobrosProf.cobrado, cobros: cobrosProf.cobros, cobrosLiquidados: cobrosProf.liquidados,
      baseHonorarios: prod ? prod.totalCopago : 0, honorarios, honorariosOSPendientes: prod ? prod.honorariosOS : 0,
      pagadoHoy: pagadoCopago, pagadoOS, pagos, diferencia: honorarios - pagadoCopago, cubierto: Math.abs(honorarios - pagadoCopago) <= TOLERANCIA_PAGO,
      detalle: prod ? prod.detalle : [],
    };
  }).sort((a, b) => b.honorarios - a.honorarios);
  for (const p of profesionalesFilas) {
    if (p.cobros > 0 && p.cobrosLiquidados < p.cobros && p.honorarios > 0 && !p.cubierto) alertasGlobales.push({ nivel: "info", texto: `${p.nombre}: ${p.cobros - p.cobrosLiquidados} de ${p.cobros} cobros de hoy todavía no están liquidados (honorarios $${Math.round(p.honorarios).toLocaleString("es-AR")})`, clave: `prof:${p.profesionalId}` });
    for (const pg of p.pagos) {
      if (esCopago(pg.tipo) && pg.cubre.length === 0 && !pg.desde_reserva && !p.cubierto) alertasGlobales.push({ nivel: "revisar", texto: `Pago a ${p.nombre} de $${Math.round(pg.monto).toLocaleString("es-AR")}: no tiene cobros marcados, no se puede verificar a qué corresponde`, clave: `pago:${pg.id}` });
      else if (pg.porcentajeSobreCubierto != null && p.porcentaje != null && Math.abs(pg.porcentajeSobreCubierto - p.porcentaje) > 3) alertasGlobales.push({ nivel: "revisar", texto: `Pago a ${p.nombre} de $${Math.round(pg.monto).toLocaleString("es-AR")}: equivale al ${pg.porcentajeSobreCubierto.toFixed(0)}% de lo cobrado en los cobros que cubre y su porcentaje es ${p.porcentaje}%`, clave: `pago:${pg.id}` });
    }
  }

  // ---------- recorrido de la plata ----------
  const cobrosPorMedio = vacioPorMedio();
  const cobrosPorMedioG = vacioPorMedio();
  const cobrosPorMedioO = vacioPorMedio();
  for (const c of cajaG) for (const p of partesDePago(c, "pago")) { sumarPorMedio(cobrosPorMedio, p.medio, p.monto); sumarPorMedio(cobrosPorMedioG, p.medio, p.monto); }
  for (const c of cajaO) for (const p of partesDePago(c, "importe")) { sumarPorMedio(cobrosPorMedio, p.medio, p.monto); sumarPorMedio(cobrosPorMedioO, p.medio, p.monto); }
  const totalCobros = Object.values(cobrosPorMedio).reduce((a, b) => a + b, 0);
  const totalG = Object.values(cobrosPorMedioG).reduce((a, b) => a + b, 0);
  const totalO = Object.values(cobrosPorMedioO).reduce((a, b) => a + b, 0);

  const suma = (filas, campo) => filas.reduce((a, c) => a + num(c[campo]), 0);
  const cierresTurno = { general: cierresTurnoG, ortodoncia: cierresTurnoO };
  const totalCierresG = suma(cierresTurnoG, "total_general");
  const totalCierresO = suma(cierresTurnoO, "total_general");
  const porMedioCierres = vacioPorMedio();
  for (const c of [...cierresTurnoG, ...cierresTurnoO]) for (const k of Object.keys(porMedioCierres)) porMedioCierres[k] += num(c[k]);

  const categoriasReserva = new Set(categorias.filter((c) => c.sale_de_reserva).map((c) => c.nombre));
  const gastosCierre = gastos.filter((g) => !gastoSaleDeLaReserva(g, categoriasReserva));
  const gastosBalance = gastos.filter((g) => !g.desde_reserva);
  const pagosSinReserva = pagosDelDia.filter((p) => !p.desde_reserva);
  const totalGastosCierre = suma(gastosCierre, "monto");
  const totalGastosBalance = suma(gastosBalance, "monto");
  const totalPagosProf = suma(pagosSinReserva, "monto");
  // Gastos que el Balance resta y el Cierre Diario no (salen de la reserva por su categoría pero no están marcados "desde la reserva").
  const idsCierre = new Set(gastosCierre.map((g) => g.id));
  const gastosQueDifieren = gastosBalance.filter((g) => !idsCierre.has(g.id));
  const egresosCierre = totalGastosCierre + totalPagosProf;
  const egresosBalance = totalGastosBalance + totalPagosProf;

  const diaBalance = detalleMes.find((d) => d.fecha === fecha) || null;
  const sumaDiasDelMes = detalleMes.reduce((a, d) => a + d.ingreso, 0);
  const ingresoBalanceMesCajas = balanceMes.ingresosGeneral + balanceMes.ingresosOrtodoncia;
  const detalleCierre = cierreDia?.detalle || null;
  const otrosDelDia = suma(otrosIngresos || [], "monto");
  const asorDelDia = suma(asor || [], "monto");

  const efectivoCaja = (cobrado, mov, cierres) => ({
    cobradoEfectivo: cobrado.efectivo,
    movimientos: mov.neto,
    esperado: cobrado.efectivo + mov.neto,
    contado: cierres.some((c) => c.efectivo_contado != null) ? suma(cierres, "efectivo_contado") : null,
    esperadoGuardado: cierres.some((c) => c.efectivo_esperado != null) ? suma(cierres, "efectivo_esperado") : null,
    ajuste: suma(cierres, "ajuste_efectivo"),
    hayCierre: cierres.length > 0,
  });
  const efectivo = { general: efectivoCaja(cobrosPorMedioG, efectivoMovG, cierresTurnoG), ortodoncia: efectivoCaja(cobrosPorMedioO, efectivoMovO, cierresTurnoO) };

  const hayCobros = cajaG.length + cajaO.length > 0;
  const cadena = [];
  const chequeo = (etiqueta, a, b, detalleOk, detalleMal) => {
    const diferencia = a - b;
    return { etiqueta, a, b, diferencia, ok: Math.abs(diferencia) <= TOLERANCIA, detalle: Math.abs(diferencia) <= TOLERANCIA ? detalleOk : detalleMal };
  };

  cadena.push({ paso: "1. Cobros cargados en Caja", valor: totalCobros, detalle: `General $${Math.round(totalG).toLocaleString("es-AR")} (${cajaG.length}) + Ortodoncia/Ortopedia $${Math.round(totalO).toLocaleString("es-AR")} (${cajaO.length})`, ok: true });
  if (hayCobros) {
    if (cierresTurnoG.length + cierresTurnoO.length === 0) cadena.push({ paso: "2. Cierres de turno de las secretarias", valor: null, detalle: "Nadie cerró el turno todavía", ok: fecha >= hoy, sinDato: true });
    else {
      const c = chequeo("Cierres de turno", totalCobros, totalCierresG + totalCierresO, "Lo cobrado coincide con lo que las secretarias cerraron.", "Lo cobrado en Caja no coincide con lo que cerraron las secretarias: se cargó, cambió o borró un cobro después del cierre.");
      cadena.push({ paso: "2. Cierres de turno de las secretarias", valor: totalCierresG + totalCierresO, ...c });
    }
    if (!detalleCierre) cadena.push({ paso: "3. Cierre diario aprobado por la dueña", valor: null, detalle: cierreDia ? "Aprobado, pero sin detalle guardado" : "Todavía sin aprobar", ok: fecha >= hoy, sinDato: true });
    else {
      const c = chequeo("Cierre diario", totalCobros, num(detalleCierre.totalCombinado), "Lo cobrado coincide con el cierre aprobado.", "Lo cobrado ahora no coincide con lo que se aprobó: hubo cambios después de aprobar el cierre.");
      cadena.push({ paso: "3. Cierre diario aprobado por la dueña", valor: num(detalleCierre.totalCombinado), ...c });
    }
    if (diaBalance) {
      const c = chequeo("Balance mensual", totalCobros, diaBalance.ingreso, diaBalance.cerrado ? "El balance del mes tiene este día igual a lo cobrado (día cerrado)." : "El balance del mes usa lo cobrado en vivo (el día no está aprobado).", "El balance del mes tiene un ingreso distinto a lo cobrado hoy: el día quedó congelado con otros números.");
      cadena.push({ paso: "4. Ingreso del día en el Balance mensual", valor: diaBalance.ingreso, ...c });
    }
  } else cadena.push({ paso: "2. Cierres, aprobación y balance", valor: null, detalle: "No hubo cobros este día.", ok: true, sinDato: true });

  // egresos y neto
  const cE = chequeo("Egresos", egresosCierre, egresosBalance, "Los gastos y pagos a profesionales del día suman lo mismo en el Cierre Diario y en el Balance.", "El Cierre Diario y el Balance restan distinto: hay gastos que uno cuenta y el otro no (por ejemplo sueldos o categorías que salen de la reserva).");
  cadena.push({ paso: "5. Egresos del día (pagos a profesionales + gastos)", valor: egresosCierre, ...cE, detalleExtra: `Pagos a profesionales $${Math.round(totalPagosProf).toLocaleString("es-AR")} · gastos para el cierre $${Math.round(totalGastosCierre).toLocaleString("es-AR")} · gastos para el balance $${Math.round(totalGastosBalance).toLocaleString("es-AR")}${gastosQueDifieren.length ? ` · el Balance resta y el Cierre no: ${gastosQueDifieren.map((g) => `${g.categoria} $${Math.round(num(g.monto)).toLocaleString("es-AR")}${g.descripcion ? ` (${g.descripcion})` : ""}`).join(", ")}` : ""}` });
  if (detalleCierre) {
    const c = chequeo("Egresos aprobados", egresosCierre, num(detalleCierre.totalEgresos), "Los egresos coinciden con el cierre aprobado.", "Los egresos de hoy no coinciden con los del cierre aprobado.");
    cadena.push({ paso: "6. Egresos vs cierre aprobado", valor: num(detalleCierre.totalEgresos), ...c });
  }
  if (diaBalance) {
    const netoEnVivo = totalCobros - egresosBalance;
    const c = chequeo("Neto del balance", netoEnVivo, diaBalance.neto, "El neto del día en el Balance coincide con lo cobrado menos lo pagado.", "El neto del día en el Balance no coincide con lo cobrado menos lo pagado.");
    cadena.push({ paso: "7. Neto del día (cobrado − egresos)", valor: diaBalance.neto, ...c });
  }
  const cMes = chequeo("Mes", sumaDiasDelMes, ingresoBalanceMesCajas, "La suma de los días del mes coincide con el ingreso del Balance mensual (sin ASOR ni otros ingresos).", "La suma de los días del mes no coincide con el ingreso del Balance mensual: hay días congelados con otros números.");
  cadena.push({ paso: "8. Todo el mes: suma de los días vs Balance mensual", valor: ingresoBalanceMesCajas, ...cMes, esDelMes: true });

  for (const [caja, e] of Object.entries(efectivo)) {
    if (!e.hayCierre || e.contado == null) continue;
    const c = chequeo(`Efectivo ${caja}`, e.esperado + e.ajuste, e.contado, `Efectivo ${caja}: lo contado coincide con lo esperado.`, `Efectivo ${caja}: el efectivo contado no coincide con cobrado en efectivo − pagos y gastos en efectivo.`);
    cadena.push({ paso: `Efectivo en caja ${caja === "general" ? "General" : "Ortodoncia"} (esperado vs contado)`, valor: e.contado, ...c, detalleExtra: `Cobrado en efectivo $${Math.round(e.cobradoEfectivo).toLocaleString("es-AR")} · movimientos $${Math.round(e.movimientos).toLocaleString("es-AR")}${e.ajuste ? ` · ajuste $${Math.round(e.ajuste).toLocaleString("es-AR")}` : ""}` });
  }

  for (const c of cadena) if (c.ok === false) alertasGlobales.push({ nivel: c.sinDato ? "revisar" : "alerta", texto: `${c.paso}: ${c.detalle}${c.diferencia != null ? ` (diferencia $${Math.round(Math.abs(c.diferencia)).toLocaleString("es-AR")})` : ""}${c.detalleExtra && /Balance resta/.test(c.detalleExtra) ? ` — ${c.detalleExtra.slice(c.detalleExtra.indexOf("el Balance resta"))}` : ""}`, clave: `cadena:${c.paso}` });

  const orden = { alerta: 0, revisar: 1, info: 2 };
  alertasGlobales.sort((a, b) => orden[a.nivel] - orden[b.nivel]);

  const vinieron = pacientes.filter((p) => p.vino);
  return {
    fecha, hoy, pacientes, profesionales: profesionalesFilas, pagos: pagosDelDia, cadena, alertas: alertasGlobales,
    resumen: {
      pacientesQueVinieron: vinieron.length,
      conCobro: vinieron.filter((p) => p.cobros.length > 0 || p.os.length > 0).length,
      sinCobro: vinieron.filter((p) => p.cobros.length === 0 && p.os.length === 0 && !p.turnos.some((t) => t.justificada)).length,
      sinCobroJustificadas: vinieron.filter((p) => p.cobros.length === 0 && p.os.length === 0 && p.turnos.some((t) => t.justificada)).length,
      totalCobros, cobrosPorMedio, honorarios: profesionalesFilas.reduce((a, p) => a + p.honorarios, 0), pagadoAProfesionales: profesionalesFilas.reduce((a, p) => a + p.pagadoHoy, 0),
      egresosCierre, otrosIngresosDelDia: otrosDelDia, asorDelDia,
      cierreAprobado: Boolean(cierreDia), cierresTurno: cierresTurnoG.length + cierresTurnoO.length,
    },
    medios: MEDIOS,
  };
}
