import { supabase } from "@/lib/supabaseClient";
import { moverAPapelera } from "@/lib/data/papelera";
import { crearMovimientoPersonal } from "@/lib/data/finanzasPersonales";

function mapearFila(f) {
  return {
    id: f.id,
    fecha: f.fecha,
    profesionalId: f.profesional_id,
    profesional: f.profesional?.nombre ?? "—",
    profesionalEspecialidad: f.profesional?.especialidad ?? null,
    tipo: f.tipo,
    monto: Number(f.monto),
    medioPago: f.medio_pago,
    observaciones: f.observaciones,
    origen: f.origen,
    desdeReserva: Boolean(f.desde_reserva),
  };
}

// origen "Caja": se pagó ese mismo día con la plata que entró en Caja ese
// día — se usa para restar del "Disponible" de Caja. origen "Produccion":
// pago diferido (puede ser plata que ya no está en ningún cajón) cargado
// desde Producción y liquidación — no debe tocar el Disponible de Caja de
// ningún día, aunque tenga la misma fecha por coincidencia.
// Los pagos "con la reserva" no tocan la caja ni lo limpio del mes: solo se
// incluyen cuando se pide (Producción y liquidación, para saber lo ya pagado).
export async function obtenerPagosProfesionales(fechaInicio, fechaFin, { origen, incluirDesdeReserva = false } = {}) {
  let query = supabase
    .from("pagos_profesionales")
    .select("*, profesional:profesionales(nombre, especialidad)")
    .gte("fecha", fechaInicio)
    .lte("fecha", fechaFin)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });
  if (origen) query = query.eq("origen", origen);
  if (!incluirDesdeReserva) query = query.eq("desde_reserva", false);
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
      ...(datos.desdeReserva ? { desde_reserva: true } : {}),
    })
    .select("*, profesional:profesionales(nombre)")
    .single();
  if (error) throw error;

  // Si se paga con la reserva, se descuenta de Consultorio (Efectivo si se
  // pagó en efectivo, si no Banco) y queda atado a este pago.
  if (datos.desdeReserva) {
    try {
      await crearMovimientoPersonal({
        panel: "Consultorio",
        cuenta: (datos.medioPago || "Efectivo") === "Efectivo" ? "Efectivo" : "Banco",
        tipo: "Egreso",
        categoria: "Pago a profesional",
        monto: datos.monto,
        fecha: datos.fecha,
        descripcion: `Pago ${data.profesional?.nombre ?? "profesional"}${datos.observaciones ? ` — ${datos.observaciones}` : ""}`,
        pagoProfesionalId: data.id,
      });
    } catch (e) {
      // Para no dejar un pago "con la reserva" sin su descuento.
      await supabase.from("pagos_profesionales").delete().eq("id", data.id);
      throw e;
    }
  }
  return mapearFila(data);
}

export async function eliminarPagoProfesional(id) {
  // Si se había pagado con la reserva, primero se devuelve esa plata a
  // Consultorio (se borra el descuento atado a este pago).
  const { error } = await supabase.from("movimientos_personales").delete().eq("pago_profesional_id", id);
  if (error) throw error;
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
