import { supabase } from "@/lib/supabaseClient";
import { crearGasto, eliminarGasto } from "@/lib/data/gastos";

export const CUENTAS_PERSONALES = ["Efectivo", "Banco"];

export const CATEGORIAS_INGRESO_CONSULTORIO = ["Saldo inicial", "Otro ingreso"];
export const CATEGORIAS_EGRESO_CONSULTORIO = ["Sueldo pagado", "Otro egreso"];

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
    panel: f.panel,
    cuenta: f.cuenta,
    tipo: f.tipo,
    categoria: f.categoria,
    monto: Number(f.monto),
    fecha: f.fecha,
    descripcion: f.descripcion,
    gastoId: f.gasto_id,
    movimientoVinculadoId: f.movimiento_vinculado_id,
  };
}

export async function obtenerMovimientosPersonales({ fechaInicio, fechaFin, panel }) {
  let query = supabase
    .from("movimientos_personales")
    .select("*")
    .eq("panel", panel)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });
  if (fechaInicio) query = query.gte("fecha", fechaInicio);
  if (fechaFin) query = query.lte("fecha", fechaFin);

  const { data, error } = await query;
  if (error) throw error;
  return data.map(mapearFila);
}

// Saldo = suma de TODOS los movimientos históricos de ese panel (no solo
// el período que se esté mirando), así siempre refleja la plata
// disponible real.
export async function obtenerSaldosPersonales(panel) {
  const { data, error } = await supabase.from("movimientos_personales").select("cuenta, tipo, monto").eq("panel", panel);
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
      panel: datos.panel,
      cuenta: datos.cuenta,
      tipo: datos.tipo,
      categoria: datos.categoria,
      monto: Number(datos.monto),
      fecha: datos.fecha,
      descripcion: datos.descripcion || null,
      gasto_id: datos.gastoId || null,
      movimiento_vinculado_id: datos.movimientoVinculadoId || null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapearFila(data);
}

// Si el movimiento tiene un Gasto y/o un movimiento vinculado en el otro
// panel (caso típico: un sueldo, que es Egreso en Consultorio + Ingreso en
// Personal, ligados al mismo Gasto), se borran los tres juntos. Primero
// hay que borrar los movimientos (que apuntan al gasto) y recién después
// el gasto, porque al revés viola la referencia entre las tablas.
export async function eliminarMovimientoPersonal(movimiento) {
  const idsABorrar = [movimiento.id];
  let gastoId = movimiento.gastoId;

  if (movimiento.movimientoVinculadoId) {
    const { data: vinculado, error: errorVinculado } = await supabase
      .from("movimientos_personales")
      .select("id, gasto_id")
      .eq("id", movimiento.movimientoVinculadoId)
      .maybeSingle();
    if (errorVinculado) throw errorVinculado;
    if (vinculado) {
      idsABorrar.push(vinculado.id);
      gastoId = gastoId || vinculado.gasto_id;
    }
  }

  const { error } = await supabase.from("movimientos_personales").delete().in("id", idsABorrar);
  if (error) throw error;

  if (gastoId) {
    await eliminarGasto(gastoId);
  }
}

// Registrar un sueldo SIEMPRE hace estas dos cosas:
//   1. Un Gasto oficial de la clínica (categoría "Sueldos"), como siempre.
//   2. Un Egreso en el panel Consultorio (resta de esa plata disponible).
// Si es el sueldo de los dueños (Matías/Marianela), además hace una
// tercera: un Ingreso en el panel Personal, vinculado al Egreso para
// poder borrar los tres juntos desde cualquiera de los dos paneles. Si es
// el sueldo de un empleado (secretaria, etc.) esa plata no es de los
// dueños, así que NO se suma a Personal.
export async function registrarSueldo({ fecha, monto, medioPago, quien, descripcion, esParaDuenos }) {
  const gasto = await crearGasto({
    fecha,
    categoria: "Sueldos",
    especialidad: null,
    descripcion: descripcion || `Sueldo${quien ? ` — ${quien}` : ""}`,
    monto,
    medioPago,
  });

  const cuenta = medioPago === "Efectivo" ? "Efectivo" : "Banco";
  const detalle = quien ? `Sueldo — ${quien}` : "Sueldo";

  const egresoConsultorio = await crearMovimientoPersonal({
    panel: "Consultorio",
    cuenta,
    tipo: "Egreso",
    categoria: "Sueldo pagado",
    monto,
    fecha,
    descripcion: detalle,
    gastoId: gasto.id,
  });

  if (!esParaDuenos) {
    return egresoConsultorio;
  }

  const ingresoPersonal = await crearMovimientoPersonal({
    panel: "Personal",
    cuenta,
    tipo: "Ingreso",
    categoria: "Sueldo",
    monto,
    fecha,
    descripcion: detalle,
    movimientoVinculadoId: egresoConsultorio.id,
  });

  const { error } = await supabase
    .from("movimientos_personales")
    .update({ movimiento_vinculado_id: ingresoPersonal.id })
    .eq("id", egresoConsultorio.id);
  if (error) throw error;

  return ingresoPersonal;
}
