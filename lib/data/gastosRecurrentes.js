import { supabase } from "@/lib/supabaseClient";
import { moverAPapelera } from "@/lib/data/papelera";
import { crearGastoConReserva } from "@/lib/data/gastos";
import { subirComprobante } from "@/lib/data/comprobantes";

function mapearFila(f) {
  return {
    id: f.id,
    nombre: f.nombre,
    categoria: f.categoria,
    tipo: f.tipo,
    montoSugerido: f.monto_sugerido === null ? null : Number(f.monto_sugerido),
    activo: f.activo,
    orden: f.orden,
  };
}

export async function obtenerGastosRecurrentes() {
  const { data, error } = await supabase
    .from("gastos_recurrentes")
    .select("*")
    .eq("activo", true)
    .order("orden")
    .order("nombre");
  if (error) throw error;
  return data.map(mapearFila);
}

export async function crearGastoRecurrente(datos) {
  const { data, error } = await supabase
    .from("gastos_recurrentes")
    .insert({
      nombre: datos.nombre,
      categoria: datos.categoria,
      tipo: datos.tipo,
      monto_sugerido: datos.montoSugerido === "" || datos.montoSugerido === null ? null : Number(datos.montoSugerido),
      orden: datos.orden ?? 0,
    })
    .select()
    .single();
  if (error) throw error;
  return mapearFila(data);
}

export async function actualizarGastoRecurrente(id, datos) {
  const { data, error } = await supabase
    .from("gastos_recurrentes")
    .update({
      nombre: datos.nombre,
      categoria: datos.categoria,
      tipo: datos.tipo,
      monto_sugerido: datos.montoSugerido === "" || datos.montoSugerido === null ? null : Number(datos.montoSugerido),
      activo: datos.activo,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return mapearFila(data);
}

export async function eliminarGastoRecurrente(id) {
  await moverAPapelera("gastos_recurrentes", id);
}

// Todos los gastos ya registrados este mes que coinciden por nombre — para
// poder mostrar "Pagado el 5/09 — $120.000" al lado de cada gasto
// recurrente en vez de tener que ir a buscarlo a la pantalla de Gastos.
export async function obtenerPagosDelMesPorNombre(fechaInicio, fechaFin) {
  const { data, error } = await supabase
    .from("gastos")
    .select("descripcion, fecha, monto, medio_pago")
    .gte("fecha", fechaInicio)
    .lte("fecha", fechaFin)
    .order("fecha", { ascending: false });
  if (error) throw error;
  const porNombre = {};
  for (const g of data) {
    if (!g.descripcion) continue;
    if (!porNombre[g.descripcion]) porNombre[g.descripcion] = [];
    porNombre[g.descripcion].push({ fecha: g.fecha, monto: Number(g.monto), medioPago: g.medio_pago });
  }
  return porNombre;
}

// Registra el pago de un gasto recurrente: crea el Gasto (con la
// descripción igual al nombre del recurrente, para poder emparejarlo
// después) y, si la categoría sale de la reserva, descuenta de
// Consultorio — mismo mecanismo que cargar un gasto a mano.
export async function registrarPagoRecurrente(gastoRecurrente, { fecha, monto, medioPago, comprobante }, categorias) {
  const comprobantePath = comprobante ? await subirComprobante(comprobante) : null;
  return crearGastoConReserva(
    {
      fecha,
      categoria: gastoRecurrente.categoria,
      descripcion: gastoRecurrente.nombre,
      monto,
      medioPago,
      ...(comprobantePath ? { comprobantePath } : {}),
    },
    categorias
  );
}
