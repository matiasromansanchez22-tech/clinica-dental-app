import { supabase } from "@/lib/supabaseClient";

// Todos los pagos a profesionales (de Caja, de Producción y los que salieron de
// la reserva), con la fecha en que se pagó y el momento exacto en que se
// registró. Se pagina de a 1000 porque la base corta ahí.
export async function obtenerHistorialPagos(fechaDesde, fechaHasta) {
  const filas = [];
  for (let desde = 0; ; desde += 1000) {
    let consulta = supabase
      .from("pagos_profesionales")
      .select("id, fecha, tipo, monto, medio_pago, observaciones, origen, desde_reserva, created_at, profesional_id, profesional:profesionales(nombre, especialidad)")
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .range(desde, desde + 999);
    if (fechaDesde) consulta = consulta.gte("fecha", fechaDesde);
    if (fechaHasta) consulta = consulta.lte("fecha", fechaHasta);
    const { data, error } = await consulta;
    if (error) throw error;
    filas.push(...data);
    if (data.length < 1000) break;
  }
  return filas.map((f) => ({
    id: f.id,
    fecha: f.fecha,
    registradoEn: f.created_at,
    profesionalId: f.profesional_id,
    profesional: f.profesional?.nombre ?? "—",
    especialidad: f.profesional?.especialidad ?? null,
    tipo: f.tipo,
    monto: Number(f.monto),
    medioPago: f.medio_pago,
    observaciones: f.observaciones,
    // De dónde salió la plata: la reserva del Consultorio, la caja del día, o
    // un pago cargado desde Producción y liquidación (pago diferido).
    salioDe: f.desde_reserva ? "Reserva" : f.origen === "Caja" ? "Caja del día" : "Producción",
  }));
}

export function fechaHoraArgentina(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
