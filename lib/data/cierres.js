import { supabase } from "@/lib/supabaseClient";

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

