import { supabase } from "@/lib/supabaseClient";
import { crearGasto, eliminarGasto } from "@/lib/data/gastos";

export const CUENTAS_PERSONALES = ["Efectivo", "Banco"];
export const CATEGORIAS_INGRESO_PERSONAL = ["Sueldo", "Saldo inicial", "Otro ingreso"];
export const CATEGORIAS_EGRESO_PERSONAL = [
  "Alquiler",
  "Servicios (luz, gas, agua, internet)",
  "Supermercado",
  "Colegio",
  "Auto / Nafta",
  "Salud",
  "Tarjeta de crédito",
  "Otro",
];

function mapearFila(f) {
  return {
    id: f.id,
    cuenta: f.cuenta,
    tipo: f.tipo,
    categoria: f.categoria,
    monto: Number(f.monto),
    fecha: f.fecha,
    descripcion: f.descripcion,
    gastoId: f.gasto_id,
  };
}

export async function obtenerMovimientosPersonales({ fechaInicio, fechaFin } = {}) {
  let query = supabase
    .from("movimientos_personales")
    .select("*")
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });
  if (fechaInicio) query = query.gte("fecha", fechaInicio);
  if (fechaFin) query = query.lte("fecha", fechaFin);

  const { data, error } = await query;
  if (error) throw error;
  return data.map(mapearFila);
}

// Saldo = suma de TODOS los movimientos históricos (no solo el período que
// se esté mirando), así siempre refleja la plata disponible real.
export async function obtenerSaldosPersonales() {
  const { data, error } = await supabase.from("movimientos_personales").select("cuenta, tipo, monto");
  if (error) throw error;
  const saldos = { Efectivo: 0, Banco: 0 };
  for (const m of data) {
    const signo = m.tipo === "Ingreso" ? 1 : -1;
    saldos[m.cuenta] += signo * Number(m.monto);
  }
  return saldos;
}

export async function crearMovimientoPersonal(datos) {
  const { data, error } = await supabase
    .from("movimientos_personales")
    .insert({
      cuenta: datos.cuenta,
      tipo: datos.tipo,
      categoria: datos.categoria,
      monto: Number(datos.monto),
      fecha: datos.fecha,
      descripcion: datos.descripcion || null,
      gasto_id: datos.gastoId || null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapearFila(data);
}

// Si el movimiento vino de un sueldo, borra también el Gasto de la
// clínica que se generó junto — para que no quede huérfano ni descuadre
// la caja del consultorio. Primero hay que borrar el movimiento (que
// apunta al gasto) y recién después el gasto, porque al revés viola la
// referencia entre las dos tablas.
export async function eliminarMovimientoPersonal(movimiento) {
  const { error } = await supabase.from("movimientos_personales").delete().eq("id", movimiento.id);
  if (error) throw error;
  if (movimiento.gastoId) {
    await eliminarGasto(movimiento.gastoId);
  }
}

// Registrar un sueldo hace DOS cosas a la vez: lo resta de la caja de la
// clínica (un Gasto más, categoría "Sueldos") y lo suma a la cuenta
// personal correspondiente (Efectivo o Banco, según cómo se lo cobraron).
export async function registrarSueldo({ fecha, monto, medioPago, quien, descripcion }) {
  const gasto = await crearGasto({
    fecha,
    categoria: "Sueldos",
    especialidad: null,
    descripcion: descripcion || `Sueldo${quien ? ` — ${quien}` : ""}`,
    monto,
    medioPago,
  });

  const cuenta = medioPago === "Efectivo" ? "Efectivo" : "Banco";
  return crearMovimientoPersonal({
    cuenta,
    tipo: "Ingreso",
    categoria: "Sueldo",
    monto,
    fecha,
    descripcion: quien ? `Sueldo — ${quien}` : "Sueldo",
    gastoId: gasto.id,
  });
}
