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
    usuarioId: f.usuario_id,
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
  // El panel Personal es privado por usuario: si no se especificó de
  // quién es (caso típico: lo carga uno mismo), se asume que es de quien
  // está logueado.
  let usuarioId = datos.usuarioId || null;
  if (datos.panel === "Personal" && !usuarioId) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    usuarioId = user?.id || null;
  }

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
      usuario_id: usuarioId,
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
// Límite conocido: si el sueldo vinculado es del Personal del OTRO dueño
// (ej. Matías borra un sueldo que se había acreditado a Marianela), ese
// ingreso queda huérfano porque el dueño que borra no tiene permiso para
// verlo ni borrarlo — lo tiene que borrar la otra persona desde su cuenta.
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
// Si es el sueldo de uno de los dueños, además hace una tercera: un
// Ingreso en SU panel Personal (privado, no lo ve el otro dueño),
// vinculado al Egreso para poder borrar los tres juntos. Por eso hace
// falta indicar paraUsuarioId — quién de los dos lo cobra — y no alcanza
// con saber que "es para los dueños". Si es el sueldo de un empleado
// (secretaria, etc.) esa plata no es de los dueños, así que NO se suma a
// ningún Personal.
export async function registrarSueldo({ fecha, monto, medioPago, quien, descripcion, esParaDuenos, paraUsuarioId }) {
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
    usuarioId: paraUsuarioId,
  });

  const { error } = await supabase
    .from("movimientos_personales")
    .update({ movimiento_vinculado_id: ingresoPersonal.id })
    .eq("id", egresoConsultorio.id);
  if (error) throw error;

  return ingresoPersonal;
}
