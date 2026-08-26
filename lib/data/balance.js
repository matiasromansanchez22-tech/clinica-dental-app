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
  ] = await Promise.all([
    supabase.from("caja_general").select("fecha, pago, medio_pago, tipo").gte("fecha", fechaInicio).lte("fecha", fechaFin),
    supabase.from("caja_ortodoncia").select("fecha, importe, medio_pago").gte("fecha", fechaInicio).lte("fecha", fechaFin),
    supabase.from("gastos").select("fecha, monto, categoria, especialidad, medio_pago").gte("fecha", fechaInicio).lte("fecha", fechaFin),
  ]);
  if (errorGeneral) throw errorGeneral;
  if (errorOrto) throw errorOrto;
  if (errorGastos) throw errorGastos;

  const ingresosGeneral = (cobrosGeneral || []).reduce((acc, c) => acc + Number(c.pago), 0);
  const ingresosOrtodoncia = (cobrosOrto || []).reduce((acc, c) => acc + Number(c.importe), 0);
  const ingresosTotal = ingresosGeneral + ingresosOrtodoncia;
  const egresosTotal = (gastos || []).reduce((acc, g) => acc + Number(g.monto), 0);
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
  const egresosPorMedioPago = agruparYSumar(gastos || [], (g) => g.medio_pago, (g) => Number(g.monto));

  return {
    ingresosGeneral,
    ingresosOrtodoncia,
    ingresosTotal,
    egresosTotal,
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
