import { supabase } from "@/lib/supabaseClient";

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
    supabase.from("pagos_profesionales").select("fecha, monto, medio_pago").gte("fecha", fechaInicio).lte("fecha", fechaFin),
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

  const todosLosEgresos = [
    ...(gastos || []).map((g) => ({ medio_pago: g.medio_pago, monto: Number(g.monto) })),
    ...(pagosProfesionales || []).map((p) => ({ medio_pago: p.medio_pago, monto: Number(p.monto) })),
  ];
  const egresosPorMedioPago = agruparYSumar(todosLosEgresos, (i) => i.medio_pago, (i) => i.monto);

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
    egresosPorMedioPago,
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
