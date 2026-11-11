import { supabase } from "@/lib/supabaseClient";
import { moverAPapelera } from "@/lib/data/papelera";

export async function obtenerCuentas() {
  const { data, error } = await supabase.from("cuentas_dinero").select("id, nombre, orden").order("orden");
  if (error) throw error;
  return data;
}

export async function obtenerMovimientosCuentas() {
  const { data, error } = await supabase
    .from("movimientos_cuentas")
    .select("*, registrador:perfiles(nombre)")
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((m) => ({
    id: m.id,
    fecha: m.fecha,
    tipo: m.tipo,
    cuentaId: m.cuenta_id,
    cuentaDestinoId: m.cuenta_destino_id,
    monto: Number(m.monto),
    observaciones: m.observaciones,
    medioOrigen: m.medio_origen ?? null,
    registradoPor: m.registrador?.nombre ?? null,
    registradoEn: m.created_at,
  }));
}

export async function crearSaldoReal({ fecha, cuentaId, monto, observaciones }) {
  const { error } = await supabase.from("movimientos_cuentas").insert({
    fecha,
    tipo: "Saldo real",
    cuenta_id: cuentaId,
    monto: Number(monto),
    observaciones: observaciones?.trim() || null,
  });
  if (error) throw error;
}

// medioOrigen (opcional): de qué medio de pago venía la plata ("Débito", "Crédito", "Mercado Pago" o "QR"). Sirve para que el control
// contra el Balance Mensual la cuente como transferencia una vez que está en la otra cuenta. Necesita la migración 202.
export const MEDIOS_DE_ORIGEN = ["Débito", "Crédito", "Mercado Pago", "QR"];

export async function crearTransferenciaEntreCuentas({ fecha, cuentaId, cuentaDestinoId, monto, observaciones, medioOrigen }) {
  const { error } = await supabase.from("movimientos_cuentas").insert({
    fecha,
    tipo: "Transferencia",
    cuenta_id: cuentaId,
    cuenta_destino_id: cuentaDestinoId,
    monto: Number(monto),
    observaciones: observaciones?.trim() || null,
    ...(medioOrigen ? { medio_origen: medioOrigen } : {}),
  });
  if (error) {
    if (medioOrigen && /medio_origen/.test(error.message)) throw new Error("Falta correr la migración 202 en Supabase para poder indicar de qué medio venía la plata.");
    throw error;
  }
}

// Desglose por medio de pago (sin efectivo) ya ajustado por lo que se pasó entre cuentas: la plata que venía de Débito (o Crédito, etc.)
// y se pasó a otra cuenta figura como Transferencia. El total no cambia: solo se mueve de un medio a otro.
//   filas: [{ clave, monto }] · devuelve { filas, movido: [{ medio, monto }] }
export function ajustarMediosPorTransferencias(filas, movimientos, desde, hasta) {
  const mapa = new Map(filas.map((f) => [f.clave, { ...f }]));
  const movido = {};
  for (const m of movimientos) {
    if (m.tipo !== "Transferencia" || !m.medioOrigen || m.fecha < desde || m.fecha > hasta) continue;
    const origen = mapa.get(m.medioOrigen) || { clave: m.medioOrigen, monto: 0 };
    origen.monto -= m.monto;
    mapa.set(m.medioOrigen, origen);
    const destino = mapa.get("Transferencia") || { clave: "Transferencia", monto: 0 };
    destino.monto += m.monto;
    mapa.set("Transferencia", destino);
    movido[m.medioOrigen] = (movido[m.medioOrigen] || 0) + m.monto;
  }
  return {
    filas: [...mapa.values()].filter((f) => Math.abs(f.monto) >= 1).sort((a, b) => b.monto - a.monto),
    movido: Object.entries(movido).map(([medio, monto]) => ({ medio, monto })),
  };
}

// Va a la Papelera antes de borrarse (se puede restaurar).
export async function eliminarMovimientoCuenta(id) {
  await moverAPapelera("movimientos_cuentas", id);
}

// Orden en el que pasaron los movimientos: por fecha y, dentro del mismo día, por cuándo se cargaron.
function antes(a, b) {
  return a.fecha !== b.fecha ? a.fecha < b.fecha : a.registradoEn < b.registradoEn;
}

// Saldo estimado de cada cuenta hasta una fecha: el último "Saldo real" cargado hasta ese día, más lo que se pasó entre
// cuentas después de ese saldo. Si todavía no hay ningún saldo real, parte de cero y queda marcado como "sin saldo real".
export function estimarSaldos(cuentas, movimientos, hastaFecha) {
  const hasta = movimientos.filter((m) => m.fecha <= hastaFecha);
  const filas = cuentas.map((c) => {
    const saldos = hasta.filter((m) => m.tipo === "Saldo real" && m.cuentaId === c.id);
    const ultimo = saldos.reduce((mejor, m) => (!mejor || antes(mejor, m) ? m : mejor), null);
    let saldo = ultimo ? ultimo.monto : 0;
    for (const m of hasta) {
      if (m.tipo !== "Transferencia") continue;
      if (ultimo && !antes(ultimo, m)) continue;
      if (m.cuentaId === c.id) saldo -= m.monto;
      if (m.cuentaDestinoId === c.id) saldo += m.monto;
    }
    return { cuenta: c, saldo, ultimoSaldoReal: ultimo };
  });
  return { filas, total: filas.reduce((a, f) => a + f.saldo, 0) };
}
