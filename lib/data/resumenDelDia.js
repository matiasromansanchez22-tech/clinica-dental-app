import { supabase } from "@/lib/supabaseClient";
import { fechaDeHoyISO } from "@/lib/agenda";
import { obtenerDetalleDelDia } from "@/lib/data/detalleDelDia";
import { obtenerCobrosConEstadoDeLiquidacion } from "@/lib/data/estadoLiquidaciones";
import { obtenerEventosPorTrabajo, obtenerTrabajosLaboratorio } from "@/lib/data/laboratorio";
import { calcularCircuito } from "@/lib/circuitoLaboratorio";
import { obtenerDeudaDePacientes } from "@/lib/data/deudaPacientes";

// Resumen del día por sector: cuántos pacientes vinieron, cuántos cobros, qué se liquidó, cómo está el laboratorio, etc.,
// con un control en cada sector («ok» si coincide, «revisar» si hay algo para mirar). Todo se calcula en el momento.
//
// Cada sector: { id, titulo, estado: "ok" | "revisar" | "info", lineas: [{ texto, estado?, detalles?: [texto] }] }

const VINO = ["En espera", "En consultorio", "Finalizado"];
const pesos = (n) => `$${Math.round(Number(n) || 0).toLocaleString("es-AR")}`;
const num = (n) => Number(n) || 0;
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

async function seguro(promesa, porDefecto) {
  try {
    return await promesa;
  } catch {
    return porDefecto;
  }
}

function resumenAgenda(turnos, fecha, hoy, nombre) {
  const agendados = turnos.filter((t) => t.estado === "Agendado");
  const vino = (t) => VINO.includes(t.presencia) && t.asistencia !== "No asistió";
  const asistieron = agendados.filter(vino);
  const noAsistieron = agendados.filter((t) => t.asistencia === "No asistió");
  const sinMarcar = agendados.filter((t) => !vino(t) && t.asistencia !== "No asistió" && t.asistencia !== "Canceló" && fecha < hoy);
  const porVenir = agendados.filter((t) => !vino(t) && t.asistencia !== "No asistió" && fecha >= hoy);
  const cancelados = turnos.filter((t) => t.estado === "Cancelado" || t.estado === "Reprogramado" || t.asistencia === "Canceló");
  const lineas = [
    { texto: `${plural(agendados.length, "turno agendado", "turnos agendados")}` },
    { texto: `Vinieron ${asistieron.length}`, estado: "ok" },
  ];
  if (noAsistieron.length) lineas.push({ texto: `No asistieron ${noAsistieron.length}`, detalles: noAsistieron.map((t) => nombre(t)) });
  if (cancelados.length) lineas.push({ texto: `Cancelados o reprogramados: ${cancelados.length}` });
  if (porVenir.length) lineas.push({ texto: `Todavía por venir: ${porVenir.length}` });
  if (sinMarcar.length)
    lineas.push({
      texto: `${plural(sinMarcar.length, "turno sin marcar", "turnos sin marcar")} (no se sabe si vinieron)`,
      estado: "revisar",
      detalles: sinMarcar.map((t) => nombre(t)),
    });
  return { lineas, asistieron, sinMarcar, estado: sinMarcar.length ? "revisar" : "ok" };
}

function partesDePago(c, campoMonto) {
  if (c.desglose_pago?.length) return c.desglose_pago.map((p) => ({ medio: p.medio, monto: num(p.monto) }));
  return [{ medio: c.medio_pago || "—", monto: num(c[campoMonto]) }];
}

function textoPorMedio(cobros, campoMonto) {
  const por = {};
  for (const c of cobros) for (const p of partesDePago(c, campoMonto)) por[p.medio] = (por[p.medio] || 0) + p.monto;
  return Object.entries(por)
    .filter(([, m]) => m > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([m, v]) => `${m} ${pesos(v)}`)
    .join(" · ");
}

export async function obtenerResumenDelDia(fecha) {
  const hoy = fechaDeHoyISO();
  const [detalle, turnosG, turnosO, cajaG, cajaO, gastos, pagosDelDia, movs, cobrosEstado] = await Promise.all([
    obtenerDetalleDelDia(fecha),
    supabase
      .from("turnos_general")
      .select("id, estado, presencia, asistencia, tipo_atencion, paciente:pacientes(apellido_y_nombre)")
      .eq("fecha", fecha)
      .then((r) => (r.error ? [] : r.data)),
    supabase
      .from("turnos_ortodoncia")
      .select("id, estado, presencia, asistencia, concepto, paciente:pacientes_ortodoncia(nombre, es_ortopedia)")
      .eq("fecha", fecha)
      .then((r) => (r.error ? [] : r.data)),
    supabase
      .from("caja_general")
      .select("id, pago, medio_pago, desglose_pago, tipo, prestaciones, saldo_pendiente")
      .eq("fecha", fecha)
      .then((r) => (r.error ? [] : r.data)),
    supabase
      .from("caja_ortodoncia")
      .select("id, importe, medio_pago, desglose_pago, concepto, descuento_referido, descuento_fidelidad")
      .eq("fecha", fecha)
      .then((r) => (r.error ? [] : r.data)),
    supabase
      .from("gastos")
      .select("id, monto, categoria, desde_reserva")
      .eq("fecha", fecha)
      .then((r) => (r.error ? [] : r.data)),
    supabase
      .from("pagos_profesionales")
      .select("id, monto, desde_reserva, origen, profesional:profesionales(nombre)")
      .eq("fecha", fecha)
      .then((r) => (r.error ? [] : r.data)),
    supabase
      .from("movimientos_personales")
      .select("pago_profesional_id")
      .not("pago_profesional_id", "is", null)
      .then((r) => (r.error ? [] : r.data)),
    seguro(obtenerCobrosConEstadoDeLiquidacion(fecha, fecha), []),
  ]);

  const sectores = [];

  // ---------- Agenda General ----------
  const nombreG = (t) => t.paciente?.apellido_y_nombre?.trim() || "(sin nombre)";
  const agG = resumenAgenda(turnosG, fecha, hoy, nombreG);
  const nuevosG = agG.asistieron.filter((t) => t.tipo_atencion === "Primera consulta").length;
  if (nuevosG) agG.lineas.splice(2, 0, { texto: `De ellos, ${plural(nuevosG, "paciente nuevo (primera consulta)", "pacientes nuevos (primera consulta)")}` });
  sectores.push({ id: "agenda-general", titulo: "Agenda · Odontología General", estado: agG.estado, lineas: agG.lineas });

  // ---------- Agenda Ortodoncia / Ortopedia ----------
  const nombreO = (t) => `${t.paciente?.nombre?.trim() || "(sin nombre)"}${t.paciente?.es_ortopedia ? " (ortopedia)" : ""}`;
  const agO = resumenAgenda(turnosO, fecha, hoy, nombreO);
  const ortopedia = agO.asistieron.filter((t) => t.paciente?.es_ortopedia).length;
  if (ortopedia) agO.lineas.splice(2, 0, { texto: `De ellos, ${ortopedia} de ortopedia y ${agO.asistieron.length - ortopedia} de ortodoncia` });
  sectores.push({ id: "agenda-ortodoncia", titulo: "Agenda · Ortodoncia y Ortopedia", estado: agO.estado, lineas: agO.lineas });

  // ---------- Caja General ----------
  const sinCobro = (sistema) => detalle.pacientes.filter((p) => sistema.includes(p.sistema) && p.vino && p.cobros.length === 0 && p.os.length === 0 && !p.turnos.some((t) => t.justificada));
  const sinCobroG = sinCobro(["General"]);
  const totalG = cajaG.reduce((a, c) => a + num(c.pago), 0);
  const estampillas = cajaG.filter((c) => (c.prestaciones || []).some((p) => /estampilla/i.test(p.prestacion || "")));
  const montoEstampillas = estampillas.reduce(
    (a, c) => a + (c.prestaciones || []).filter((p) => /estampilla/i.test(p.prestacion || "")).reduce((x, p) => x + num(p.valor) * num(p.cantidad || 1), 0),
    0
  );
  const deObraSocial = cajaG.filter((c) => c.tipo === "Obra Social").length;
  const conSaldo = cajaG.filter((c) => num(c.saldo_pendiente) > 0);
  const lineasCajaG = [
    { texto: `${plural(cajaG.length, "cobro registrado", "cobros registrados")} por ${pesos(totalG)}`, estado: "ok" },
  ];
  if (cajaG.length) {
    lineasCajaG.push({ texto: `Por medio de pago: ${textoPorMedio(cajaG, "pago")}` });
    lineasCajaG.push({ texto: `${deObraSocial} de obra social y ${cajaG.length - deObraSocial} particulares` });
  }
  if (estampillas.length) lineasCajaG.push({ texto: `Estampilla cobrada a ${plural(estampillas.length, "paciente", "pacientes")} (${pesos(montoEstampillas)})` });
  if (conSaldo.length) lineasCajaG.push({ texto: `${plural(conSaldo.length, "cobro con saldo pendiente", "cobros con saldo pendiente")} (${pesos(conSaldo.reduce((a, c) => a + num(c.saldo_pendiente), 0))})` });
  if (agG.asistieron.length || cajaG.length)
    lineasCajaG.push({
      texto: sinCobroG.length
        ? `${plural(sinCobroG.length, "paciente vino y no tiene cobro", "pacientes vinieron y no tienen cobro")}`
        : "Todos los pacientes que vinieron tienen su cobro (o el motivo cargado)",
      estado: sinCobroG.length ? "revisar" : "ok",
      detalles: sinCobroG.map((p) => p.paciente),
    });
  sectores.push({ id: "caja-general", titulo: "Caja General", estado: sinCobroG.length ? "revisar" : "ok", lineas: lineasCajaG });

  // ---------- Caja Ortodoncia ----------
  const sinCobroO = sinCobro(["Ortodoncia", "Ortopedia"]);
  const totalO = cajaO.reduce((a, c) => a + num(c.importe), 0);
  const porConcepto = {};
  for (const c of cajaO) porConcepto[c.concepto || "Otro"] = (porConcepto[c.concepto || "Otro"] || 0) + 1;
  const conDescuento = cajaO.filter((c) => num(c.descuento_referido) + num(c.descuento_fidelidad) > 0);
  const lineasCajaO = [{ texto: `${plural(cajaO.length, "cobro registrado", "cobros registrados")} por ${pesos(totalO)}`, estado: "ok" }];
  if (cajaO.length) {
    lineasCajaO.push({ texto: `Por medio de pago: ${textoPorMedio(cajaO, "importe")}` });
    lineasCajaO.push({
      texto: Object.entries(porConcepto)
        .sort((a, b) => b[1] - a[1])
        .map(([c, n]) => `${n} ${c}`)
        .join(" · "),
    });
  }
  if (conDescuento.length)
    lineasCajaO.push({
      texto: `${plural(conDescuento.length, "cobro con descuento", "cobros con descuento")} por referidos o tarjeta de fidelidad (${pesos(
        conDescuento.reduce((a, c) => a + num(c.descuento_referido) + num(c.descuento_fidelidad), 0)
      )})`,
    });
  if (agO.asistieron.length || cajaO.length)
    lineasCajaO.push({
      texto: sinCobroO.length
        ? `${plural(sinCobroO.length, "paciente vino y no tiene cobro", "pacientes vinieron y no tienen cobro")}`
        : "Todos los pacientes que vinieron tienen su cobro (o el motivo cargado)",
      estado: sinCobroO.length ? "revisar" : "ok",
      detalles: sinCobroO.map((p) => `${p.paciente}${p.sistema === "Ortopedia" ? " (ortopedia)" : ""}`),
    });
  sectores.push({ id: "caja-ortodoncia", titulo: "Caja Ortodoncia y Ortopedia", estado: sinCobroO.length ? "revisar" : "ok", lineas: lineasCajaO });

  // ---------- Cierres ----------
  const r = detalle.resumen;
  const cadenaMal = detalle.cadena.filter((c) => c.ok === false && !c.esDelMes);
  const lineasCierres = [
    {
      texto: r.cierresTurno ? `${plural(r.cierresTurno, "cierre de turno cargado", "cierres de turno cargados")} por Secretaría` : "Secretaría todavía no cerró el turno",
      estado: r.cierresTurno || (!cajaG.length && !cajaO.length) || fecha >= hoy ? "ok" : "revisar",
    },
    { texto: r.cierreAprobado ? "Cierre Diario aprobado" : "Cierre Diario sin aprobar", estado: r.cierreAprobado || fecha >= hoy || (!cajaG.length && !cajaO.length) ? "ok" : "revisar" },
  ];
  for (const c of detalle.cadena.filter((x) => /^Efectivo en caja/.test(x.paso))) {
    lineasCierres.push({ texto: `${c.paso}: ${c.ok ? "coincide ✓" : `no coincide (${pesos(Math.abs(c.diferencia || 0))})`}`, estado: c.ok ? "ok" : "revisar" });
  }
  for (const c of cadenaMal.filter((x) => !/^Efectivo en caja/.test(x.paso) && !x.sinDato))
    lineasCierres.push({ texto: `${c.paso}: ${c.detalle}`, estado: "revisar" });
  sectores.push({
    id: "cierres",
    titulo: "Cierres del día",
    estado: lineasCierres.some((l) => l.estado === "revisar") ? "revisar" : "ok",
    lineas: lineasCierres,
  });

  // ---------- Profesionales ----------
  const conMovimiento = new Set(movs.map((m) => m.pago_profesional_id));
  const reservaSinDescuento = pagosDelDia.filter((p) => p.desde_reserva && !conMovimiento.has(p.id));
  const totalPagos = pagosDelDia.reduce((a, p) => a + num(p.monto), 0);
  const deReserva = pagosDelDia.filter((p) => p.desde_reserva).reduce((a, p) => a + num(p.monto), 0);
  const cuenta = (e) => cobrosEstado.filter((c) => c.estado === e).length;
  const faltan = cobrosEstado.filter((c) => c.estado !== "liquidado");
  const lineasProf = [
    pagosDelDia.length
      ? { texto: `${plural(pagosDelDia.length, "pago a profesional", "pagos a profesionales")} por ${pesos(totalPagos)}${deReserva ? ` (${pesos(deReserva)} con la reserva)` : ""}`, estado: "ok" }
      : { texto: "No se registraron pagos a profesionales" },
  ];
  if (cobrosEstado.length)
    lineasProf.push({
      texto: `De los ${cobrosEstado.length} cobros del día con honorarios: ${cuenta("liquidado")} liquidados · ${cuenta("parcial")} parciales · ${cuenta("pendiente")} faltan liquidar`,
      estado: faltan.length ? "info" : "ok",
      detalles: faltan.map((c) => `${c.paciente} → ${c.profesional}${c.estado === "parcial" ? ` (parcial, falta ${pesos(c.falta)})` : ` (${pesos(c.falta)})`}`),
    });
  for (const a of detalle.alertas.filter((x) => /^(prof|pago):/.test(x.clave || "") && x.nivel !== "info"))
    lineasProf.push({ texto: a.texto, estado: "revisar" });
  if (reservaSinDescuento.length)
    lineasProf.push({
      texto: `${plural(reservaSinDescuento.length, "pago con la reserva sin su descuento en Consultorio", "pagos con la reserva sin su descuento en Consultorio")}: quedaron cargados a medias`,
      estado: "revisar",
      detalles: reservaSinDescuento.map((p) => `${p.profesional?.nombre || "—"} ${pesos(p.monto)}`),
    });
  sectores.push({
    id: "profesionales",
    titulo: "Pagos y liquidación a profesionales",
    estado: lineasProf.some((l) => l.estado === "revisar") ? "revisar" : "ok",
    lineas: lineasProf,
  });

  // ---------- Gastos ----------
  const totalGastos = gastos.reduce((a, g) => a + num(g.monto), 0);
  const gastosReserva = gastos.filter((g) => g.desde_reserva);
  const lineasGastos = [{ texto: gastos.length ? `${plural(gastos.length, "gasto registrado", "gastos registrados")} por ${pesos(totalGastos)}` : "No se registraron gastos" }];
  if (gastosReserva.length)
    lineasGastos.push({ texto: `${gastosReserva.length} con la reserva (${pesos(gastosReserva.reduce((a, g) => a + num(g.monto), 0))})` });
  const porCategoria = {};
  for (const g of gastos) porCategoria[g.categoria] = (porCategoria[g.categoria] || 0) + num(g.monto);
  if (gastos.length)
    lineasGastos.push({
      texto: Object.entries(porCategoria)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([c, m]) => `${c} ${pesos(m)}`)
        .join(" · "),
    });
  sectores.push({ id: "gastos", titulo: "Gastos", estado: "ok", lineas: lineasGastos });

  // ---------- Otros ingresos ----------
  if (r.asorDelDia || r.otrosIngresosDelDia)
    sectores.push({
      id: "otros",
      titulo: "Otros ingresos",
      estado: "ok",
      lineas: [
        ...(r.asorDelDia ? [{ texto: `Pago de ASOR: ${pesos(r.asorDelDia)}` }] : []),
        ...(r.otrosIngresosDelDia ? [{ texto: `Otros ingresos (scanner, etc.): ${pesos(r.otrosIngresosDelDia)}` }] : []),
      ],
    });

  // ---------- Laboratorio (la situación de hoy, no del día elegido) ----------
  const lab = await seguro(resumenLaboratorio(fecha), null);
  if (lab) sectores.push(lab);

  const revisar = sectores.filter((s) => s.estado === "revisar").length;
  return {
    fecha,
    hoy,
    sectores,
    revisar,
    pacientesQueVinieron: r.pacientesQueVinieron,
    totalCobros: r.totalCobros,
  };
}

async function resumenLaboratorio(fecha) {
  const [trabajos, eventos] = await Promise.all([obtenerTrabajosLaboratorio(), obtenerEventosPorTrabajo()]);
  const activos = trabajos.filter((t) => t.estado !== "Entregado");
  const conEtapa = activos.map((t) => ({ t, etapa: calcularCircuito(t, eventos[t.id] || []).etapa }));
  const deuda = await seguro(
    obtenerDeudaDePacientes(conEtapa.filter((x) => x.t.tipoPaciente !== "Ortodoncia").map((x) => x.t.pacienteId)),
    {}
  );
  const de = (etapa) => conEtapa.filter((x) => x.etapa === etapa);
  const debe = (x) => x.t.tipoPaciente !== "Ortodoncia" && deuda[x.t.pacienteId]?.total > 0;
  const enClinica = conEtapa.filter((x) => ["en_clinica", "probado", "listo"].includes(x.etapa));
  const listos = de("listo");
  const listosConDeuda = listos.filter(debe);
  const conDeudaEnClinica = enClinica.filter(debe);
  const entregadosHoy = trabajos.filter((t) => t.estado === "Entregado" && t.fechaAlta === fecha).length;
  const lineas = [
    { texto: `${plural(activos.length, "trabajo en curso", "trabajos en curso")}: ${de("pendiente_envio").length} por enviar · ${de("en_mecanico").length} en el mecánico · ${enClinica.length} en la clínica` },
    { texto: `Para probar: ${de("en_clinica").length + de("probado").length} · Listos para entregar: ${listos.length}` },
  ];
  if (entregadosHoy) lineas.push({ texto: `Entregados este día: ${entregadosHoy}`, estado: "ok" });
  if (listos.length)
    lineas.push({
      texto: listosConDeuda.length
        ? `${plural(listosConDeuda.length, "trabajo listo con el paciente debiendo", "trabajos listos con el paciente debiendo")}: no se entregan hasta que paguen`
        : "Los trabajos listos no tienen deuda: se pueden entregar",
      estado: listosConDeuda.length ? "revisar" : "ok",
      detalles: listosConDeuda.map((x) => `${x.t.pacienteNombre} debe ${pesos(deuda[x.t.pacienteId].total)}`),
    });
  const otrosConDeuda = conDeudaEnClinica.filter((x) => x.etapa !== "listo");
  if (otrosConDeuda.length)
    lineas.push({
      texto: `${plural(otrosConDeuda.length, "paciente con trabajo en la clínica debe", "pacientes con trabajo en la clínica deben")} (para tener presente antes de entregar)`,
      estado: "info",
      detalles: otrosConDeuda.map((x) => `${x.t.pacienteNombre} debe ${pesos(deuda[x.t.pacienteId].total)}`),
    });
  return { id: "laboratorio", titulo: "Laboratorio · hoy", estado: listosConDeuda.length ? "revisar" : "ok", lineas };
}
