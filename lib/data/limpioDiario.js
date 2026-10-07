import { supabase } from "@/lib/supabaseClient";

export const MEDIOS = [
  { clave: "efectivo", label: "Efectivo", medio: "Efectivo" },
  { clave: "transferencia", label: "Transferencia", medio: "Transferencia" },
  { clave: "debito", label: "Débito", medio: "Débito" },
  { clave: "credito", label: "Crédito", medio: "Crédito" },
  { clave: "mercado_pago", label: "Mercado Pago", medio: "Mercado Pago" },
  { clave: "qr", label: "QR", medio: "QR" },
];

const CLAVE_POR_MEDIO = Object.fromEntries(MEDIOS.map((m) => [m.medio, m.clave]));

function vacio() {
  return Object.fromEntries(MEDIOS.map((m) => [m.clave, 0]));
}

// La base devuelve un máximo de 1000 filas por consulta: se pide por páginas.
async function traerTodo(armarConsulta) {
  const filas = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await armarConsulta().range(desde, desde + 999);
    if (error) throw error;
    filas.push(...data);
    if (data.length < 1000) break;
  }
  return filas;
}

async function traerCobros(tabla, campoMonto, inicio, fin) {
  const armar = (columnas) => () =>
    supabase.from(tabla).select(columnas).gte("fecha", inicio).lte("fecha", fin).order("fecha").order("id");
  try {
    return await traerTodo(armar(`fecha, ${campoMonto}, medio_pago, desglose_pago`));
  } catch (e) {
    if (!String(e.message).includes("desglose_pago")) throw e;
    return traerTodo(armar(`fecha, ${campoMonto}, medio_pago`));
  }
}

// Lo que queda "limpio" cada día: lo cobrado (General + Ortodoncia) menos
// los gastos y pagos a profesionales, separado por medio de pago. Misma
// regla que el Cierre Diario: los sueldos y las categorías marcadas "sale de
// la reserva" (alquiler, impuestos...) no cuentan porque no salen de la
// plata que entró ese día.
export async function obtenerLimpioPorDia(inicio, fin) {
  const [cobrosGeneral, cobrosOrto, gastos, pagos, { data: categorias, error: errorCat }] = await Promise.all([
    traerCobros("caja_general", "pago", inicio, fin),
    traerCobros("caja_ortodoncia", "importe", inicio, fin),
    traerTodo(() =>
      supabase.from("gastos").select("fecha, categoria, monto, medio_pago, desde_reserva").gte("fecha", inicio).lte("fecha", fin).order("fecha").order("id")
    ),
    traerTodo(() =>
      supabase.from("pagos_profesionales").select("fecha, monto, medio_pago").gte("fecha", inicio).lte("fecha", fin).order("fecha").order("id")
    ),
    supabase.from("categorias_gasto").select("nombre, sale_de_reserva"),
  ]);
  if (errorCat) throw errorCat;

  const categoriasReserva = new Set((categorias || []).filter((c) => c.sale_de_reserva).map((c) => c.nombre));
  const dias = {};
  const dia = (fecha) => (dias[fecha] ??= { fecha, ingresos: vacio(), egresos: vacio() });

  function sumarCobros(filas, campoMonto) {
    for (const f of filas) {
      const partes = f.desglose_pago?.length ? f.desglose_pago : [{ medio: f.medio_pago, monto: f[campoMonto] }];
      for (const parte of partes) {
        const clave = CLAVE_POR_MEDIO[parte.medio];
        if (clave) dia(f.fecha).ingresos[clave] += Number(parte.monto);
      }
    }
  }
  sumarCobros(cobrosGeneral, "pago");
  sumarCobros(cobrosOrto, "importe");

  for (const g of gastos) {
    if (g.desde_reserva || g.categoria === "Sueldos" || categoriasReserva.has(g.categoria)) continue;
    const clave = CLAVE_POR_MEDIO[g.medio_pago];
    if (clave) dia(g.fecha).egresos[clave] += Number(g.monto);
  }
  for (const p of pagos) {
    const clave = CLAVE_POR_MEDIO[p.medio_pago];
    if (clave) dia(p.fecha).egresos[clave] += Number(p.monto);
  }

  return Object.values(dias)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((d) => ({
      ...d,
      limpio: Object.fromEntries(MEDIOS.map((m) => [m.clave, d.ingresos[m.clave] - d.egresos[m.clave]])),
    }));
}
