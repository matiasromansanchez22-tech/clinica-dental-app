import { supabase } from "@/lib/supabaseClient";

// Saldo a favor del paciente — plata que ya pagó de más (o se le acreditó
// por algún motivo) y todavía no usó. Se carga a mano desde la ficha del
// paciente, y se aplica en Caja para descontarlo de un cobro nuevo. Es un
// ledger (como planes_pagos_historicos): el saldo actual es la suma de sus
// movimientos, no un total guardado aparte.

function columnaPaciente(esOrtodoncia) {
  return esOrtodoncia ? "paciente_ortodoncia_id" : "paciente_id";
}

export async function obtenerSaldoAFavor(pacienteId, esOrtodoncia) {
  if (!pacienteId) return 0;
  const { data, error } = await supabase
    .from("saldos_a_favor")
    .select("monto")
    .eq(columnaPaciente(esOrtodoncia), pacienteId);
  if (error) throw error;
  return (data || []).reduce((acc, r) => acc + Number(r.monto), 0);
}

export async function obtenerMovimientosSaldoAFavor(pacienteId, esOrtodoncia) {
  const { data, error } = await supabase
    .from("saldos_a_favor")
    .select("id, monto, motivo, fecha, created_at")
    .eq(columnaPaciente(esOrtodoncia), pacienteId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

// Carga manual — "este paciente tiene $X a favor porque...".
export async function agregarSaldoAFavor({ pacienteId, esOrtodoncia, monto, motivo, fecha }) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("saldos_a_favor").insert({
    [columnaPaciente(esOrtodoncia)]: pacienteId,
    monto,
    motivo: motivo || null,
    fecha,
    usuario_id: user?.id ?? null,
  });
  if (error) throw error;
}

export async function eliminarMovimientoSaldoAFavor(id) {
  const { error } = await supabase.from("saldos_a_favor").delete().eq("id", id);
  if (error) throw error;
}

// Se usa desde Caja al registrar un cobro — queda un movimiento negativo
// vinculado a ese cobro, para que se vea de dónde salió el descuento.
export async function aplicarSaldoAFavor({ pacienteId, esOrtodoncia, monto, cajaGeneralId, cajaOrtodonciaId, fecha }) {
  if (!monto || monto <= 0) return;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("saldos_a_favor").insert({
    [columnaPaciente(esOrtodoncia)]: pacienteId,
    monto: -Math.abs(monto),
    motivo: "Aplicado a un cobro",
    caja_general_id: cajaGeneralId || null,
    caja_ortodoncia_id: cajaOrtodonciaId || null,
    fecha,
    usuario_id: user?.id ?? null,
  });
  if (error) throw error;
}
