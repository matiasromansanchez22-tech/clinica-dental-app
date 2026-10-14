import { supabase } from "@/lib/supabaseClient";
import { moverAPapelera } from "@/lib/data/papelera";

export const MEDIOS_OTROS_INGRESOS = ["Transferencia", "Efectivo", "Débito", "Crédito", "Mercado Pago", "QR"];

function mapear(f) {
  return {
    id: f.id,
    fecha: f.fecha,
    concepto: f.concepto,
    monto: Number(f.monto),
    medioPago: f.medio_pago,
    observaciones: f.observaciones,
    registradoPor: f.registrador?.nombre ?? null,
    registradoEn: f.created_at,
  };
}

export async function obtenerOtrosIngresos(fechaInicio, fechaFin) {
  const { data, error } = await supabase
    .from("otros_ingresos")
    .select("*, registrador:perfiles(nombre)")
    .gte("fecha", fechaInicio)
    .lte("fecha", fechaFin)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(mapear);
}

export async function crearOtroIngreso({ fecha, concepto, monto, medioPago, observaciones }) {
  const { error } = await supabase.from("otros_ingresos").insert({
    fecha,
    concepto: concepto.trim(),
    monto: Number(monto),
    medio_pago: medioPago || "Transferencia",
    observaciones: observaciones?.trim() || null,
  });
  if (error) throw error;
}

// Va a la Papelera antes de borrarse (se puede restaurar).
export async function eliminarOtroIngreso(id) {
  await moverAPapelera("otros_ingresos", id);
}

// Para los balances: devuelve [] si la tabla todavía no existe (falta correr la
// migración 150), así Balance Mensual / Anual no se rompen.
export async function obtenerOtrosIngresosParaBalance(fechaInicio, fechaFin) {
  let consulta = supabase.from("otros_ingresos").select("fecha, monto, medio_pago, concepto");
  if (fechaInicio) consulta = consulta.gte("fecha", fechaInicio);
  if (fechaFin) consulta = consulta.lte("fecha", fechaFin);
  const { data, error } = await consulta;
  if (error) return [];
  return data;
}
