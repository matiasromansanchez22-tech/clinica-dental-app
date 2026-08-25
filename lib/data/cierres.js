import { supabase } from "@/lib/supabaseClient";

const NOMBRES_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export async function calcularTotalesDelDia(fecha) {
  const { data, error } = await supabase.from("caja_general").select("pago, medio_pago").eq("fecha", fecha);
  if (error) throw error;

  const totales = { efectivo: 0, transferencia: 0, debito: 0, credito: 0, mercado_pago: 0, qr: 0 };
  const CLAVE_POR_MEDIO = {
    Efectivo: "efectivo",
    Transferencia: "transferencia",
    "Débito": "debito",
    "Crédito": "credito",
    "Mercado Pago": "mercado_pago",
    QR: "qr",
  };

  data.forEach((c) => {
    const clave = CLAVE_POR_MEDIO[c.medio_pago];
    if (clave) totales[clave] += Number(c.pago);
  });

  const totalGeneral = Object.values(totales).reduce((a, b) => a + b, 0);
  return { ...totales, totalGeneral, cantidadCobros: data.length };
}

export async function obtenerCierre(fecha) {
  const { data, error } = await supabase.from("cierres_diarios").select("*").eq("fecha", fecha).maybeSingle();
  if (error) throw error;
  return data;
}

export async function guardarCierreDiario(fecha, totales, responsable, observaciones) {
  const [anio, mes] = fecha.split("-");
  const registro = {
    fecha,
    anio: Number(anio),
    mes: NOMBRES_MES[Number(mes) - 1],
    efectivo: totales.efectivo,
    transferencia: totales.transferencia,
    debito: totales.debito,
    credito: totales.credito,
    mercado_pago: totales.mercado_pago,
    qr: totales.qr,
    total_general: totales.totalGeneral,
    responsable: responsable || null,
    guardado_en: new Date().toISOString(),
    observaciones: observaciones || null,
  };

  const { data, error } = await supabase
    .from("cierres_diarios")
    .upsert(registro, { onConflict: "fecha" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function obtenerCierresRecientes(limite = 30) {
  const { data, error } = await supabase
    .from("cierres_diarios")
    .select("*")
    .order("fecha", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return data;
}
