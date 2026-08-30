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

export async function calcularTotalesDelTurno(fecha, usuarioId) {
  const { data, error } = await supabase
    .from("caja_general")
    .select("pago, medio_pago")
    .eq("fecha", fecha)
    .eq("usuario_id", usuarioId);
  if (error) throw error;

  const totales = { efectivo: 0, transferencia: 0, debito: 0, credito: 0, mercado_pago: 0, qr: 0 };
  data.forEach((c) => {
    const clave = CLAVE_POR_MEDIO[c.medio_pago];
    if (clave) totales[clave] += Number(c.pago);
  });

  const totalGeneral = Object.values(totales).reduce((a, b) => a + b, 0);
  return { ...totales, totalGeneral, cantidadCobros: data.length };
}

export async function obtenerCierreTurno(fecha, usuarioId) {
  const { data, error } = await supabase
    .from("cierres_turno")
    .select("*")
    .eq("fecha", fecha)
    .eq("usuario_id", usuarioId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function guardarCierreTurno(fecha, usuarioId, nombreSecretaria, totales, observaciones) {
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
    .from("cierres_turno")
    .upsert(registro, { onConflict: "fecha,usuario_id" })
    .select()
    .single();
  if (error) throw error;

  // Al cerrar el turno, los cobros de ese día cargados por este usuario
  // quedan bloqueados (no se pueden editar ni borrar hasta reabrir).
  const { error: errorBloqueo } = await supabase
    .from("caja_general")
    .update({ cerrado: true })
    .eq("fecha", fecha)
    .eq("usuario_id", usuarioId);
  if (errorBloqueo) throw errorBloqueo;

  return data;
}

// Solo la Dueña puede reabrir un turno ya cerrado (lo permite la política
// de la base): desbloquea sus cobros de ese día y borra el cierre guardado
// para que se pueda corregir algo y volver a cerrar.
export async function reabrirTurno(fecha, usuarioId) {
  const { error: errorDesbloqueo } = await supabase
    .from("caja_general")
    .update({ cerrado: false })
    .eq("fecha", fecha)
    .eq("usuario_id", usuarioId);
  if (errorDesbloqueo) throw errorDesbloqueo;

  await moverAPapelera("cierres_turno", { fecha, usuario_id: usuarioId });
}

export async function obtenerCierresTurnoDelDia(fecha) {
  const { data, error } = await supabase
    .from("cierres_turno")
    .select("*")
    .eq("fecha", fecha)
    .order("guardado_en");
  if (error) throw error;
  return data;
}
