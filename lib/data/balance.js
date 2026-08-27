import { supabase } from "@/lib/supabaseClient";
import { obtenerCierresDelMes } from "./cierresDia";

function agruparYSumar(items, claveFn, montoFn) {
  const mapa = {};
  for (const item of items) {
    const clave = claveFn(item) || "—";
    mapa[clave] = (mapa[clave] || 0) + montoFn(item);
  }
  return Object.entries(mapa)
    .map(([clave, monto]) => ({ clave, monto }))
    .sort((a, b) => b.monto - a.monto);
}

export async function obtenerBalanceMensual(fechaInicio, fechaFin) {
  const [
    { data: cobrosGeneral, error: errorGeneral },
    { data: cobrosOrto, error: errorOrto },
    { data: gastos, error: errorGastos },
    { data: pagosProfesionales, error: errorPagos },
  ] = await Promise.all([
    supabase.from("caja_general").select("fecha, pago, medio_pago, tipo").gte("fecha", fechaInicio).lte("fecha", fechaFin),
    supabase.from("caja_ortodoncia").select("fecha, importe, medio_pago").gte("fecha", fechaInicio).lte("fecha", fechaFin),
    supabase.from("gastos").select("fecha, monto, categoria, especialidad, medio_pago").gte("fecha", fechaInicio).lte("fecha", fechaFin),
    supabase
      .from("pagos_profesionales")
      .select("fecha, monto, medio_pago, profesional:profesionales(especialidad)")
      .gte("fecha", fechaInicio)
      .lte("fecha", fechaFin),
  ]);
  if (errorGeneral) throw errorGeneral;
  if (errorOrto) throw errorOrto;
  if (errorGastos) throw errorGastos;
  if (errorPagos) throw errorPagos;

  const ingresosGeneral = (cobrosGeneral || []).reduce((acc, c) => acc + Number(c.pago), 0);
  const ingresosOrtodoncia = (cobrosOrto || []).reduce((acc, c) => acc + Number(c.importe), 0);
  const ingresosTotal = ingresosGeneral + ingresosOrtodoncia;
  const totalGastos = (gastos || []).reduce((acc, g) => acc + Number(g.monto), 0);
  const totalPagosProfesionales = (pagosProfesionales || []).reduce((acc, p) => acc + Number(p.monto), 0);
  const egresosTotal = totalGastos + totalPagosProfesionales;
  const balance = ingresosTotal - egresosTotal;

  const ingresosPorEspecialidad = [
    { clave: "Odontología General", monto: ingresosGeneral },
    { clave: "Ortodoncia", monto: ingresosOrtodoncia },
  ].filter((f) => f.monto > 0);

  const todosLosIngresos = [
    ...(cobrosGeneral || []).map((c) => ({ medio_pago: c.medio_pago, monto: Number(c.pago) })),
    ...(cobrosOrto || []).map((c) => ({ medio_pago: c.medio_pago, monto: Number(c.importe) })),
  ];
  const ingresosPorMedioPago = agruparYSumar(todosLosIngresos, (i) => i.medio_pago, (i) => i.monto);

  const egresosPorCategoria = agruparYSumar(gastos || [], (g) => g.categoria, (g) => Number(g.monto));
  if (totalPagosProfesionales > 0) {
    egresosPorCategoria.push({ clave: "Honorarios profesionales", monto: totalPagosProfesionales });
    egresosPorCategoria.sort((a, b) => b.monto - a.monto);
  }

  const COMPARTIDO = "Compartido (toda la clínica)";
  const todosLosEgresosPorEspecialidad = [
    ...(gastos || []).map((g) => ({ especialidad: g.especialidad || COMPARTIDO, monto: Number(g.monto) })),
    ...(pagosProfesionales || []).map((p) => ({
      especialidad: p.profesional?.especialidad || COMPARTIDO,
      monto: Number(p.monto),
    })),
  ];
  const egresosPorEspecialidad = agruparYSumar(
    todosLosEgresosPorEspecialidad,
    (i) => i.especialidad,
    (i) => i.monto
  );

  const todosLosEgresos = [
    ...(gastos || []).map((g) => ({ medio_pago: g.medio_pago, monto: Number(g.monto) })),
    ...(pagosProfesionales || []).map((p) => ({ medio_pago: p.medio_pago, monto: Number(p.monto) })),
  ];
  const egresosPorMedioPago = agruparYSumar(todosLosEgresos, (i) => i.medio_pago, (i) => i.monto);

  const mediosPagoUnicos = Array.from(
    new Set([...ingresosPorMedioPago.map((f) => f.clave), ...egresosPorMedioPago.map((f) => f.clave)])
  );
  const netoPorMedioPago = mediosPagoUnicos
    .map((clave) => {
      const ingreso = ingresosPorMedioPago.find((f) => f.clave === clave)?.monto || 0;
      const egreso = egresosPorMedioPago.find((f) => f.clave === clave)?.monto || 0;
      return { clave, ingreso, egreso, monto: ingreso - egreso };
    })
    .sort((a, b) => b.monto - a.monto);

  return {
    ingresosGeneral,
    ingresosOrtodoncia,
    ingresosTotal,
    egresosTotal,
    totalGastos,
    totalPagosProfesionales,
    balance,
    ingresosPorEspecialidad,
    ingresosPorMedioPago,
    egresosPorCategoria,
    egresosPorEspecialidad,
    egresosPorMedioPago,
    netoPorMedioPago,
    cantidadCobrosGeneral: (cobrosGeneral || []).length,
    cantidadCobrosOrtodoncia: (cobrosOrto || []).length,
    cantidadGastos: (gastos || []).length,
  };
}

export async function obtenerBalanceAnual(anio) {
  const fechaInicio = `${anio}-01-01`;
  const fechaFin = `${anio}-12-31`;

  const [
    { data: cobrosGeneral, error: errorGeneral },
    { data: cobrosOrto, error: errorOrto },
    { data: gastos, error: errorGastos },
    { data: pagosProfesionales, error: errorPagos },
  ] = await Promise.all([
    supabase.from("caja_general").select("fecha, pago").gte("fecha", fechaInicio).lte("fecha", fechaFin),
    supabase.from("caja_ortodoncia").select("fecha, importe").gte("fecha", fechaInicio).lte("fecha", fechaFin),
    supabase.from("gastos").select("fecha, monto").gte("fecha", fechaInicio).lte("fecha", fechaFin),
    supabase.from("pagos_profesionales").select("fecha, monto").gte("fecha", fechaInicio).lte("fecha", fechaFin),
  ]);
  if (errorGeneral) throw errorGeneral;
  if (errorOrto) throw errorOrto;
  if (errorGastos) throw errorGastos;
  if (errorPagos) throw errorPagos;

  const ingresosPorMes = Array(12).fill(0);
  const egresosPorMes = Array(12).fill(0);

  for (const c of cobrosGeneral || []) {
    const mes = Number(c.fecha.slice(5, 7)) - 1;
    ingresosPorMes[mes] += Number(c.pago);
  }
  for (const c of cobrosOrto || []) {
    const mes = Number(c.fecha.slice(5, 7)) - 1;
    ingresosPorMes[mes] += Number(c.importe);
  }
  for (const g of gastos || []) {
    const mes = Number(g.fecha.slice(5, 7)) - 1;
    egresosPorMes[mes] += Number(g.monto);
  }
  for (const p of pagosProfesionales || []) {
    const mes = Number(p.fecha.slice(5, 7)) - 1;
    egresosPorMes[mes] += Number(p.monto);
  }

  const meses = ingresosPorMes.map((ingresos, i) => ({
    mes: i + 1,
    ingresos,
    egresos: egresosPorMes[i],
    balance: ingresos - egresosPorMes[i],
  }));

  const ingresosTotal = ingresosPorMes.reduce((a, b) => a + b, 0);
  const egresosTotal = egresosPorMes.reduce((a, b) => a + b, 0);

  return {
    meses,
    ingresosTotal,
    egresosTotal,
    balanceTotal: ingresosTotal - egresosTotal,
  };
}

// Desglose día por día del mes, para la barra detallada de Balance Mensual.
// Si un día ya fue aprobado (cierre diario con detalle congelado), usa esos
// números fijos en vez de recalcularlos en vivo — así un gasto cargado
// después del cierre no cambia silenciosamente un día ya cerrado.
export async function obtenerDetalleDiarioMes(fechaInicio, fechaFin) {
  const [
    { data: cobrosGeneral, error: errorGeneral },
    { data: cobrosOrto, error: errorOrto },
    { data: gastos, error: errorGastos },
    { data: pagosProfesionales, error: errorPagos },
    cierres,
  ] = await Promise.all([
    supabase.from("caja_general").select("fecha, pago").gte("fecha", fechaInicio).lte("fecha", fechaFin),
    supabase.from("caja_ortodoncia").select("fecha, importe").gte("fecha", fechaInicio).lte("fecha", fechaFin),
    supabase.from("gastos").select("fecha, monto").gte("fecha", fechaInicio).lte("fecha", fechaFin),
    supabase.from("pagos_profesionales").select("fecha, monto").gte("fecha", fechaInicio).lte("fecha", fechaFin),
    obtenerCierresDelMes(fechaInicio, fechaFin),
  ]);
  if (errorGeneral) throw errorGeneral;
  if (errorOrto) throw errorOrto;
  if (errorGastos) throw errorGastos;
  if (errorPagos) throw errorPagos;

  const ingresoPorDia = {};
  const egresoPorDia = {};
  for (const c of cobrosGeneral || []) ingresoPorDia[c.fecha] = (ingresoPorDia[c.fecha] || 0) + Number(c.pago);
  for (const c of cobrosOrto || []) ingresoPorDia[c.fecha] = (ingresoPorDia[c.fecha] || 0) + Number(c.importe);
  for (const g of gastos || []) egresoPorDia[g.fecha] = (egresoPorDia[g.fecha] || 0) + Number(g.monto);
  for (const p of pagosProfesionales || []) egresoPorDia[p.fecha] = (egresoPorDia[p.fecha] || 0) + Number(p.monto);

  const cierrePorFecha = {};
  for (const c of cierres || []) cierrePorFecha[c.fecha] = c;

  const [anio, mes] = fechaInicio.split("-").map(Number);
  const ultimoDia = new Date(anio, mes, 0).getDate();
  const dias = [];
  for (let d = 1; d <= ultimoDia; d++) {
    const fecha = `${anio}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (fecha > fechaFin) break;
    const cierre = cierrePorFecha[fecha];
    if (cierre?.detalle) {
      dias.push({
        fecha,
        ingreso: cierre.detalle.totalCombinado,
        egreso: cierre.detalle.totalEgresos,
        neto: cierre.detalle.totalNeto,
        cerrado: true,
      });
    } else {
      const ingreso = ingresoPorDia[fecha] || 0;
      const egreso = egresoPorDia[fecha] || 0;
      dias.push({ fecha, ingreso, egreso, neto: ingreso - egreso, cerrado: false });
    }
  }
  return dias;
}
