import { supabase } from "@/lib/supabaseClient";
import { obtenerOtrosIngresosParaBalance } from "@/lib/data/otrosIngresos";

// Balance separado de Odontología General y Ortodoncia.
//
// Reglas:
//  · Ingresos: caja de cada especialidad. Los reembolsos de ASOR van a General; "Otros ingresos"
//    (Scanner, etc.) quedan como ingreso común.
//  · Honorarios: según la especialidad del profesional (Ortodoncia → Ortodoncia; el resto → General).
//  · Gastos: los cargados como "General" u "Ortodoncia" son de esa especialidad; los que no tienen
//    especialidad son comunes de toda la clínica.
//  · "Resultado del mes" es lo mismo que el Balance Mensual (sin lo que se paga con la reserva).
//  · "Resultado final" además resta lo pagado con la reserva (alquiler, sueldos, etc.): lo propio de
//    cada especialidad y los gastos comunes repartidos según el porcentaje elegido.

export const CLAVE_PORCENTAJE_COMUNES = "balance_pct_comunes_ortodoncia";
export const PORCENTAJE_COMUNES_POR_DEFECTO = 50;

export async function obtenerPorcentajeComunesOrtodoncia() {
  const { data } = await supabase
    .from("configuracion_ortodoncia")
    .select("valor")
    .eq("clave", CLAVE_PORCENTAJE_COMUNES)
    .maybeSingle();
  return data ? Number(data.valor) : PORCENTAJE_COMUNES_POR_DEFECTO;
}

export async function guardarPorcentajeComunesOrtodoncia(porcentaje) {
  const { error } = await supabase
    .from("configuracion_ortodoncia")
    .upsert({ clave: CLAVE_PORCENTAJE_COMUNES, valor: porcentaje }, { onConflict: "clave" });
  if (error) throw error;
}

async function traerTodo(consulta) {
  const filas = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await consulta().range(desde, desde + 999);
    if (error) throw error;
    filas.push(...data);
    if (data.length < 1000) break;
  }
  return filas;
}

export async function obtenerDatosBalanceEspecialidades(desde, hasta) {
  const [general, orto, asor, otros, gastos, pagos] = await Promise.all([
    traerTodo(() => supabase.from("caja_general").select("fecha, pago").gte("fecha", desde).lte("fecha", hasta)),
    traerTodo(() => supabase.from("caja_ortodoncia").select("fecha, importe").gte("fecha", desde).lte("fecha", hasta)),
    traerTodo(() => supabase.from("pagos_asor").select("fecha, monto").gte("fecha", desde).lte("fecha", hasta)),
    obtenerOtrosIngresosParaBalance(desde, hasta),
    traerTodo(() =>
      supabase.from("gastos").select("fecha, monto, categoria, especialidad, desde_reserva").gte("fecha", desde).lte("fecha", hasta)
    ),
    traerTodo(() =>
      supabase
        .from("pagos_profesionales")
        .select("fecha, monto, desde_reserva, profesional:profesionales(especialidad)")
        .gte("fecha", desde)
        .lte("fecha", hasta)
    ),
  ]);
  return { general, orto, asor, otros: otros || [], gastos, pagos };
}

const suma = (filas, f) => filas.reduce((acc, x) => acc + (Number(f(x)) || 0), 0);

// A qué columna va un gasto o un pago a profesional.
function destinoGasto(g) {
  if (g.especialidad === "Ortodoncia") return "ortodoncia";
  if (g.especialidad === "General") return "general";
  return "comunes";
}
function destinoPago(p) {
  return p.profesional?.especialidad === "Ortodoncia" ? "ortodoncia" : "general";
}

// Calcula el balance de un conjunto de datos (de un mes, o de un rango). `pctOrtodoncia` es el % de los
// gastos comunes que carga Ortodoncia.
export function calcularBalanceEspecialidades(datos, pctOrtodoncia) {
  const col = () => ({
    ingresosPacientes: 0,
    ingresosAsor: 0,
    ingresosOtros: 0,
    honorarios: 0,
    gastosPropios: 0,
    gastosComunes: 0,
    reservaHonorarios: 0,
    reservaGastosPropios: 0,
    reservaGastosComunes: 0,
  });
  const c = { general: col(), ortodoncia: col(), comunes: col() };

  c.general.ingresosPacientes = suma(datos.general, (x) => x.pago);
  c.ortodoncia.ingresosPacientes = suma(datos.orto, (x) => x.importe);
  c.general.ingresosAsor = suma(datos.asor, (x) => x.monto);
  c.comunes.ingresosOtros = suma(datos.otros, (x) => x.monto);

  for (const p of datos.pagos) {
    const d = destinoPago(p);
    if (p.desde_reserva) c[d].reservaHonorarios += Number(p.monto) || 0;
    else c[d].honorarios += Number(p.monto) || 0;
  }
  const categoriasComunes = {};
  for (const g of datos.gastos) {
    const d = destinoGasto(g);
    const monto = Number(g.monto) || 0;
    if (d === "comunes") {
      if (g.desde_reserva) c.comunes.reservaGastosComunes += monto;
      else c.comunes.gastosComunes += monto;
      const k = g.categoria || "—";
      categoriasComunes[k] = (categoriasComunes[k] || 0) + monto;
    } else if (g.desde_reserva) c[d].reservaGastosPropios += monto;
    else c[d].gastosPropios += monto;
  }

  const ingresos = (x) => x.ingresosPacientes + x.ingresosAsor + x.ingresosOtros;
  const egresosMes = (x) => x.honorarios + x.gastosPropios + x.gastosComunes;
  const egresosReserva = (x) => x.reservaHonorarios + x.reservaGastosPropios;

  // Resultado del mes (igual al Balance Mensual): sin lo de la reserva ni el reparto de comunes.
  const resultadoMes = (x) => ingresos(x) - egresosMes(x);

  // Comunes: lo que se gastó en común (del mes y de la reserva) menos los ingresos comunes.
  const comunesNeto = c.comunes.gastosComunes + c.comunes.reservaGastosComunes - c.comunes.ingresosOtros;
  const pct = Math.min(100, Math.max(0, Number(pctOrtodoncia) || 0));
  const reparto = {
    ortodoncia: (comunesNeto * pct) / 100,
    general: (comunesNeto * (100 - pct)) / 100,
  };

  // Resultado final de cada especialidad: su resultado propio, menos lo suyo pagado con la reserva y su
  // parte de los gastos comunes (que incluyen lo común del mes y de la reserva).
  const final = (k) => ingresos(c[k]) - c[k].honorarios - c[k].gastosPropios - egresosReserva(c[k]) - reparto[k];

  return {
    columnas: c,
    ingresos: { general: ingresos(c.general), ortodoncia: ingresos(c.ortodoncia), comunes: ingresos(c.comunes) },
    resultadoMes: { general: resultadoMes(c.general), ortodoncia: resultadoMes(c.ortodoncia), comunes: resultadoMes(c.comunes) },
    resultadoMesTotal: resultadoMes(c.general) + resultadoMes(c.ortodoncia) + resultadoMes(c.comunes),
    comunesNeto,
    reparto,
    resultadoFinal: { general: final("general"), ortodoncia: final("ortodoncia") },
    resultadoFinalTotal: final("general") + final("ortodoncia"),
    categoriasComunes: Object.entries(categoriasComunes)
      .map(([categoria, monto]) => ({ categoria, monto }))
      .sort((a, b) => b.monto - a.monto),
    porcentajeOrtodoncia: pct,
  };
}

// Filtra los datos de un mes puntual (AAAA-MM) para armar la tabla de un año.
export function datosDelMes(datos, mes) {
  const delMes = (x) => x.fecha.slice(0, 7) === mes;
  return {
    general: datos.general.filter(delMes),
    orto: datos.orto.filter(delMes),
    asor: datos.asor.filter(delMes),
    otros: datos.otros.filter(delMes),
    gastos: datos.gastos.filter(delMes),
    pagos: datos.pagos.filter(delMes),
  };
}
