import { supabase } from "@/lib/supabaseClient";
import { fechaDeHoyISO } from "@/lib/agenda";
import { obtenerCierresTurnoDelDia } from "@/lib/data/cierresTurno";
import { obtenerCierresTurnoOrtodonciaDelDia } from "@/lib/data/cierresTurnoOrtodoncia";

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

// Hoy mismo: ¿algún secretario que ya marcó su salida (en "Mi horario")
// dejó cobros cargados sin cerrar el turno? Mientras sigue atendiendo es
// normal que la caja del día no esté cerrada todavía, así que no avisa
// hasta que se haya ido — recién ahí es una caja realmente pendiente.
export async function obtenerTurnosSinCerrarHoy() {
  const hoy = fechaDeHoyISO();

  const [{ data: registros, error: eReg }, { data: cobrosGeneral, error: eCg }, { data: cobrosOrto, error: eCo }, cierresGeneral, cierresOrto] =
    await Promise.all([
      supabase.from("registros_horario").select("usuario_id").eq("fecha", hoy).not("hora_salida", "is", null),
      supabase.from("caja_general").select("usuario_id").eq("fecha", hoy),
      supabase.from("caja_ortodoncia").select("usuario_id").eq("fecha", hoy),
      obtenerCierresTurnoDelDia(hoy),
      obtenerCierresTurnoOrtodonciaDelDia(hoy),
    ]);
  if (eReg) throw eReg;
  if (eCg) throw eCg;
  if (eCo) throw eCo;

  const salieron = new Set((registros || []).map((r) => r.usuario_id));
  const cerraronGeneral = new Set(cierresGeneral.map((c) => c.usuario_id));
  const cerraronOrto = new Set(cierresOrto.map((c) => c.usuario_id));

  const general = (cobrosGeneral || []).some((c) => salieron.has(c.usuario_id) && !cerraronGeneral.has(c.usuario_id));
  const ortodoncia = (cobrosOrto || []).some((c) => salieron.has(c.usuario_id) && !cerraronOrto.has(c.usuario_id));

  return { general, ortodoncia };
}

// Para el puntito rojo del menú — cuenta 1 por cada especialidad con un
// turno pendiente de cerrar (0, 1 o 2).
export async function obtenerCantidadTurnosSinCerrarHoy() {
  const { general, ortodoncia } = await obtenerTurnosSinCerrarHoy();
  return (general ? 1 : 0) + (ortodoncia ? 1 : 0);
}

