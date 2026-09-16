import { supabase } from "@/lib/supabaseClient";
import { moverAPapelera } from "@/lib/data/papelera";

const CLAVE_POR_MEDIO = {
  Efectivo: "efectivo",
  Transferencia: "transferencia",
  "Débito": "debito",
  "Crédito": "credito",
  "Mercado Pago": "mercado_pago",
  QR: "qr",
};

// Un cobro puede tener el pago repartido entre varios medios (pago mixto,
// migración 097) — cada parte del desglose suma a su propio medio en vez
// de que todo el importe caiga en un único bolsón "Mixto".
function sumarPorMedioPago(filas, campoMonto) {
  const totales = { efectivo: 0, transferencia: 0, debito: 0, credito: 0, mercado_pago: 0, qr: 0 };
  filas.forEach((f) => {
    const partes = f.desglose_pago?.length ? f.desglose_pago : [{ medio: f.medio_pago, monto: f[campoMonto] }];
    for (const parte of partes) {
      const clave = CLAVE_POR_MEDIO[parte.medio];
      if (clave) totales[clave] += Number(parte.monto);
    }
  });
  const totalGeneral = Object.values(totales).reduce((a, b) => a + b, 0);
  return { ...totales, totalGeneral, cantidadCobros: filas.length };
}

export async function calcularTotalesDelDiaOrtodoncia(fecha) {
  // Si desglose_pago (pago mixto) todavía no existe como columna (falta
  // correr la migración 097), sigue funcionando el Cierre normal en vez de
  // romperse.
  let { data, error } = await supabase
    .from("caja_ortodoncia")
    .select("importe, medio_pago, desglose_pago")
    .eq("fecha", fecha);
  if (error?.message?.includes("desglose_pago")) {
    ({ data, error } = await supabase.from("caja_ortodoncia").select("importe, medio_pago").eq("fecha", fecha));
  }
  if (error) throw error;
  return sumarPorMedioPago(data, "importe");
}

export async function calcularTotalesDelTurnoOrtodoncia(fecha, usuarioId) {
  let { data, error } = await supabase
    .from("caja_ortodoncia")
    .select("importe, medio_pago, desglose_pago")
    .eq("fecha", fecha)
    .eq("usuario_id", usuarioId);
  if (error?.message?.includes("desglose_pago")) {
    ({ data, error } = await supabase
      .from("caja_ortodoncia")
      .select("importe, medio_pago")
      .eq("fecha", fecha)
      .eq("usuario_id", usuarioId));
  }
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

  const { error: errorBloqueo } = await supabase
    .from("caja_ortodoncia")
    .update({ cerrado: true })
    .eq("fecha", fecha)
    .eq("usuario_id", usuarioId);
  if (errorBloqueo) throw errorBloqueo;

  return data;
}

// Solo la Dueña puede reabrir un turno ya cerrado.
export async function reabrirTurnoOrtodoncia(fecha, usuarioId) {
  const { error: errorDesbloqueo } = await supabase
    .from("caja_ortodoncia")
    .update({ cerrado: false })
    .eq("fecha", fecha)
    .eq("usuario_id", usuarioId);
  if (errorDesbloqueo) throw errorDesbloqueo;

  await moverAPapelera("cierres_turno_ortodoncia", { fecha, usuario_id: usuarioId });
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
