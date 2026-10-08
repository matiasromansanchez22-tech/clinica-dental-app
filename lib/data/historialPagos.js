import { supabase } from "@/lib/supabaseClient";
import { gastoSaleDeLaReserva, obtenerCategoriasGasto } from "@/lib/data/gastos";

// Pagina de a 1000 porque la base corta ahí.
async function traerTodo(armarConsulta) {
  const filas = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await armarConsulta().range(desde, desde + 999);
    if (error) throw error;
    filas.push(...data);
    if (data.length < 1000) break;
  }
  return filas;
}

// Todos los pagos a profesionales (de Caja, de Producción y los que salieron de
// la reserva), con la fecha en que se pagó, el momento exacto en que se
// registró y quién lo cargó.
export async function obtenerHistorialPagos(fechaDesde, fechaHasta) {
  const filas = await traerTodo(() => {
    let consulta = supabase
      .from("pagos_profesionales")
      .select(
        `id, fecha, tipo, monto, medio_pago, observaciones, origen, desde_reserva, created_at, profesional_id,
         profesional:profesionales(nombre, especialidad),
         registrador:perfiles(nombre)`
      )
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false });
    if (fechaDesde) consulta = consulta.gte("fecha", fechaDesde);
    if (fechaHasta) consulta = consulta.lte("fecha", fechaHasta);
    return consulta;
  });
  return filas.map((f) => ({
    id: f.id,
    fecha: f.fecha,
    registradoEn: f.created_at,
    registradoPor: f.registrador?.nombre ?? null,
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

// Todos los gastos cargados, con quién y cuándo los registró y si salieron de
// la reserva del Consultorio o de la plata del mes.
export async function obtenerHistorialGastos(fechaDesde, fechaHasta) {
  const [filas, categorias] = await Promise.all([
    traerTodo(() => {
      let consulta = supabase
        .from("gastos")
        .select(
          `id, fecha, categoria, descripcion, monto, medio_pago, observaciones, desde_reserva, created_at,
           registrador:perfiles(nombre)`
        )
        .order("fecha", { ascending: false })
        .order("created_at", { ascending: false });
      if (fechaDesde) consulta = consulta.gte("fecha", fechaDesde);
      if (fechaHasta) consulta = consulta.lte("fecha", fechaHasta);
      return consulta;
    }),
    obtenerCategoriasGasto(),
  ]);
  const categoriasReserva = new Set(categorias.filter((c) => c.sale_de_reserva).map((c) => c.nombre));
  return filas.map((f) => ({
    id: f.id,
    fecha: f.fecha,
    registradoEn: f.created_at,
    registradoPor: f.registrador?.nombre ?? null,
    categoria: f.categoria,
    descripcion: f.descripcion,
    observaciones: f.observaciones,
    monto: Number(f.monto),
    medioPago: f.medio_pago,
    salioDe: gastoSaleDeLaReserva(f, categoriasReserva) ? "Reserva" : "Plata del mes",
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
