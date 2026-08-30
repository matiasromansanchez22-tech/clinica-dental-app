import { supabase } from "@/lib/supabaseClient";
import { moverAPapelera } from "@/lib/data/papelera";

function mapearFila(f) {
  return {
    id: f.id,
    fecha: f.fecha,
    profesionalId: f.profesional_id,
    profesional: f.profesional?.nombre ?? "—",
    tipo: f.tipo,
    monto: Number(f.monto),
    medioPago: f.medio_pago,
    observaciones: f.observaciones,
    origen: f.origen,
  };
}

// origen "Caja": se pagó ese mismo día con la plata que entró en Caja ese
// día — se usa para restar del "Disponible" de Caja. origen "Produccion":
// pago diferido (puede ser plata que ya no está en ningún cajón) cargado
// desde Producción y liquidación — no debe tocar el Disponible de Caja de
// ningún día, aunque tenga la misma fecha por coincidencia.
export async function obtenerPagosProfesionales(fechaInicio, fechaFin, { origen } = {}) {
  let query = supabase
    .from("pagos_profesionales")
    .select("*, profesional:profesionales(nombre)")
    .gte("fecha", fechaInicio)
    .lte("fecha", fechaFin)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });
  if (origen) query = query.eq("origen", origen);
  const { data, error } = await query;
  if (error) throw error;
  return data.map(mapearFila);
}

export async function crearPagoProfesional(datos) {
  const { data, error } = await supabase
    .from("pagos_profesionales")
    .insert({
      fecha: datos.fecha,
      profesional_id: datos.profesionalId,
      tipo: datos.tipo,
      monto: Number(datos.monto),
      medio_pago: datos.medioPago || "Efectivo",
      observaciones: datos.observaciones || null,
      origen: datos.origen || "Produccion",
    })
    .select("*, profesional:profesionales(nombre)")
    .single();
  if (error) throw error;
  return mapearFila(data);
}

export async function eliminarPagoProfesional(id) {
  await moverAPapelera("pagos_profesionales", id);
}

// Suma pagada por profesional en el período, separada por tipo (Copago vs
// Obra Social), para poder mostrar cuánto ya se le pagó y cuánto le queda
// pendiente sobre lo calculado en Producción y liquidación.
export async function obtenerTotalPagadoPorProfesional(fechaInicio, fechaFin) {
  const { data, error } = await supabase
    .from("pagos_profesionales")
    .select("profesional_id, tipo, monto")
    .gte("fecha", fechaInicio)
    .lte("fecha", fechaFin);
  if (error) throw error;

  const mapa = {};
  data.forEach((f) => {
    if (!mapa[f.profesional_id]) mapa[f.profesional_id] = { copago: 0, obraSocial: 0 };
    if (f.tipo === "Obra Social") mapa[f.profesional_id].obraSocial += Number(f.monto);
    else mapa[f.profesional_id].copago += Number(f.monto);
  });
  return mapa;
}

export async function obtenerTotalPagadoGeneral(fechaInicio, fechaFin) {
  const { data, error } = await supabase
    .from("pagos_profesionales")
    .select("monto")
    .gte("fecha", fechaInicio)
    .lte("fecha", fechaFin);
  if (error) throw error;
  return data.reduce((acc, f) => acc + Number(f.monto), 0);
}
