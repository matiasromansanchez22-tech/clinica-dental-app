import { supabase } from "@/lib/supabaseClient";

const CLAVE_POR_MEDIO = {
  Efectivo: "efectivo",
  Transferencia: "transferencia",
  "Débito": "debito",
  "Crédito": "credito",
  "Mercado Pago": "mercado_pago",
  QR: "qr",
};

function sumarPorMedioPago(filas, campoMonto) {
  const totales = { efectivo: 0, transferencia: 0, debito: 0, credito: 0, mercado_pago: 0, qr: 0 };
  filas.forEach((f) => {
    const clave = CLAVE_POR_MEDIO[f.medio_pago];
    if (clave) totales[clave] += Number(f[campoMonto]);
  });
  const totalGeneral = Object.values(totales).reduce((a, b) => a + b, 0);
  return { ...totales, totalGeneral, cantidadCobros: filas.length };
}

export async function calcularTotalesDelDiaOrtodoncia(fecha) {
  const { data, error } = await supabase.from("caja_ortodoncia").select("importe, medio_pago").eq("fecha", fecha);
  if (error) throw error;
  return sumarPorMedioPago(data, "importe");
}

export async function calcularTotalesDelTurnoOrtodoncia(fecha, usuarioId) {
  const { data, error } = await supabase
    .from("caja_ortodoncia")
    .select("importe, medio_pago")
    .eq("fecha", fecha)
    .eq("usuario_id", usuarioId);
  if (error) throw error;
  return sumarPorMedioPago(data, "importe");
}

export async function obtenerCierreTurnoOrtodoncia(fecha, usuarioId) {
  const { data, error } = await supabase
    .from("cierres_turno_ortodoncia")
    .select("*")
    .eq("fecha", fecha)
    .eq("usuario_id", usuarioId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function guardarCierreTurnoOrtodoncia(fecha, usuarioId, nombreSecretaria, totales, observaciones) {
  const registro = {
    fecha,
    usuario_id: usuarioId,
    nombre_secretaria: nombreSecretaria || null,
    efectivo: totales.efectivo,
    transferencia: totales.transferencia,
    debito: totales.debito,
    credito: totales.credito,
    mercado_pago: totales.mercado_pago,
    qr: totales.qr,
    total_general: totales.totalGeneral,
    observaciones: observaciones || null,
    guardado_en: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("cierres_turno_ortodoncia")
    .upsert(registro, { onConflict: "fecha,usuario_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function obtenerCierresTurnoOrtodonciaDelDia(fecha) {
  const { data, error } = await supabase
    .from("cierres_turno_ortodoncia")
    .select("*")
    .eq("fecha", fecha)
    .order("guardado_en");
  if (error) throw error;
  return data;
}
