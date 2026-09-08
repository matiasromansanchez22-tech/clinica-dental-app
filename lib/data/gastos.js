import { supabase } from "@/lib/supabaseClient";
import { moverAPapelera } from "@/lib/data/papelera";

export const MEDIOS_PAGO_GASTO = ["Efectivo", "Transferencia", "Débito", "Crédito", "Mercado Pago", "QR"];

function mapearFila(f) {
  return {
    id: f.id,
    fecha: f.fecha,
    categoria: f.categoria,
    especialidad: f.especialidad,
    descripcion: f.descripcion,
    monto: Number(f.monto),
    medioPago: f.medio_pago,
    observaciones: f.observaciones,
    cerrado: f.cerrado,
    mecanico: f.mecanico,
  };
}

export async function obtenerGastos(fechaInicio, fechaFin) {
  const { data, error } = await supabase
    .from("gastos")
    .select("*")
    .gte("fecha", fechaInicio)
    .lte("fecha", fechaFin)
    .order("fecha", { ascending: false });
  if (error) throw error;
  return data.map(mapearFila);
}

// Todos los pagos a laboratorio de siempre (sin filtro de fecha), para la
// cuenta corriente por mecánico en Cuentas por Mecánico — ese saldo es
// acumulado, no de un período puntual.
export async function obtenerPagosALaboratorio() {
  const { data, error } = await supabase
    .from("gastos")
    .select("*")
    .eq("categoria", "Pagos a Laboratorio")
    .order("fecha", { ascending: false });
  if (error) throw error;
  return data.map(mapearFila);
}

export async function crearGasto(datos) {
  const { data, error } = await supabase
    .from("gastos")
    .insert({
      fecha: datos.fecha,
      categoria: datos.categoria,
      especialidad: datos.especialidad || null,
      descripcion: datos.descripcion || null,
      monto: Number(datos.monto),
      medio_pago: datos.medioPago,
      observaciones: datos.observaciones || null,
      // Solo se manda si viene un valor: así no rompe la carga de gastos
      // comunes en clínicas donde todavía no se corrió la migración que
      // agrega esta columna (mecanico).
      ...(datos.mecanico ? { mecanico: datos.mecanico } : {}),
    })
    .select()
    .single();
  if (error) throw error;
  return mapearFila(data);
}

export async function actualizarGasto(id, datos) {
  const { data, error } = await supabase
    .from("gastos")
    .update({
      fecha: datos.fecha,
      categoria: datos.categoria,
      especialidad: datos.especialidad || null,
      descripcion: datos.descripcion || null,
      monto: Number(datos.monto),
      medio_pago: datos.medioPago,
      observaciones: datos.observaciones || null,
      ...(datos.mecanico ? { mecanico: datos.mecanico } : {}),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return mapearFila(data);
}

// Si el gasto viene de un sueldo (Registrar sueldo en Consultorio), hay
// movimientos en movimientos_personales que apuntan a él — hay que
// borrarlos primero, si no la base de datos rechaza el borrado del gasto
// (sin importar desde qué pantalla se borre: Caja, Gastos o Consultorio).
export async function eliminarGasto(id) {
  const { data: vinculados, error: errorVinculados } = await supabase
    .from("movimientos_personales")
    .select("id, movimiento_vinculado_id")
    .eq("gasto_id", id);
  if (errorVinculados) throw errorVinculados;

  if (vinculados && vinculados.length > 0) {
    const ids = new Set();
    for (const v of vinculados) {
      ids.add(v.id);
      if (v.movimiento_vinculado_id) ids.add(v.movimiento_vinculado_id);
    }
    const { error: errorBorrarVinculados } = await supabase
      .from("movimientos_personales")
      .delete()
      .in("id", Array.from(ids));
    if (errorBorrarVinculados) throw errorBorrarVinculados;
  }

  await moverAPapelera("gastos", id);
}

export async function obtenerCategoriasGasto() {
  const { data, error } = await supabase.from("categorias_gasto").select("*").order("nombre");
  if (error) throw error;
  return data;
}

export async function crearCategoriaGasto(nombre, visibleSecretarios = false, saleDeReserva = false) {
  const { data, error } = await supabase
    .from("categorias_gasto")
    .insert({ nombre, visible_secretarios: visibleSecretarios, sale_de_reserva: saleDeReserva })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarVisibilidadCategoriaGasto(id, visibleSecretarios) {
  const { error } = await supabase
    .from("categorias_gasto")
    .update({ visible_secretarios: visibleSecretarios })
    .eq("id", id);
  if (error) throw error;
}

// Categorías marcadas así (ej. Alquiler, Impuestos, Pago a proveedor) se
// pagan con la reserva de Consultorio en vez de con la plata del día —
// igual que ya pasa con Sueldos, pero configurable categoría por
// categoría en vez de estar fijo en el código.
export async function actualizarSaleDeReservaCategoriaGasto(id, saleDeReserva) {
  const { error } = await supabase
    .from("categorias_gasto")
    .update({ sale_de_reserva: saleDeReserva })
    .eq("id", id);
  if (error) throw error;
}
