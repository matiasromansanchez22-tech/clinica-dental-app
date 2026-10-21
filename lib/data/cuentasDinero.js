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

export async function crearTransferenciaEntreCuentas({ fecha, cuentaId, cuentaDestinoId, monto, observaciones }) {
  const { error } = await supabase.from("movimientos_cuentas").insert({
    fecha,
    tipo: "Transferencia",
    cuenta_id: cuentaId,
    cuenta_destino_id: cuentaDestinoId,
    monto: Number(monto),
    observaciones: observaciones?.trim() || null,
  });
  if (error) throw error;
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
