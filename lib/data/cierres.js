import { supabase } from "@/lib/supabaseClient";

export async function calcularTotalesDelDia(fecha) {
  // Si desglose_pago (pago mixto) todavía no existe como columna (falta
  // correr la migración 083), sigue funcionando el Cierre Diario normal en
  // vez de romperse.
  let { data, error } = await supabase.from("caja_general").select("pago, medio_pago, desglose_pago").eq("fecha", fecha);
  if (error?.message?.includes("desglose_pago")) {
    ({ data, error } = await supabase.from("caja_general").select("pago, medio_pago").eq("fecha", fecha));
  }
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
    const partes = c.desglose_pago?.length ? c.desglose_pago : [{ medio: c.medio_pago, monto: c.pago }];
    for (const parte of partes) {
      const clave = CLAVE_POR_MEDIO[parte.medio];
      if (clave) totales[clave] += Number(parte.monto);
    }
  });

  const totalGeneral = Object.values(totales).reduce((a, b) => a + b, 0);
  return { ...totales, totalGeneral, cantidadCobros: data.length };
}

