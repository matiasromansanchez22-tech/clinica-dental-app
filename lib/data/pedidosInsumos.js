import { supabase } from "@/lib/supabaseClient";

export const SECTORES_INSUMO = ["Odontología General", "Tratamiento de Conducto", "Ortodoncia", "Otros"];

function calcularTotalItems(items) {
  return items.reduce((acc, i) => acc + Number(i.cantidad || 0) * Number(i.precioUnitario || 0), 0);
}

export async function obtenerProveedores() {
  const { data, error } = await supabase.from("proveedores").select("*").order("nombre");
  if (error) throw error;
  return data;
}

export async function crearProveedor(nombre) {
  const { data, error } = await supabase.from("proveedores").insert({ nombre }).select().single();
  if (error) throw error;
  return data;
}

function mapearPedido(f) {
  return {
    id: f.id,
    fecha: f.fecha,
    proveedorId: f.proveedor_id,
    proveedor: f.proveedor?.nombre ?? "—",
    items: f.items || [],
    total: Number(f.total),
    medioPago: f.medio_pago,
    estado: f.estado,
    observaciones: f.observaciones,
  };
}

export async function obtenerPedidos(fechaInicio, fechaFin) {
  const { data, error } = await supabase
    .from("pedidos_insumos")
    .select("*, proveedor:proveedores(nombre)")
    .gte("fecha", fechaInicio)
    .lte("fecha", fechaFin)
    .order("fecha", { ascending: false });
  if (error) throw error;
  return data.map(mapearPedido);
}

export async function crearPedido(datos) {
  const total = calcularTotalItems(datos.items);
  const { data, error } = await supabase
    .from("pedidos_insumos")
    .insert({
      fecha: datos.fecha,
      proveedor_id: datos.proveedorId,
      items: datos.items,
      total,
      medio_pago: datos.medioPago || null,
      estado: datos.estado || "Recibido",
      observaciones: datos.observaciones || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function eliminarPedido(id) {
  const { error } = await supabase.from("pedidos_insumos").delete().eq("id", id);
  if (error) throw error;
}

function mapearNotaCredito(f) {
  return {
    id: f.id,
    fecha: f.fecha,
    proveedorId: f.proveedor_id,
    proveedor: f.proveedor?.nombre ?? "—",
    pedidoId: f.pedido_id,
    motivo: f.motivo,
    monto: Number(f.monto),
    estado: f.estado,
    observaciones: f.observaciones,
  };
}

export async function obtenerNotasCredito(fechaInicio, fechaFin) {
  const { data, error } = await supabase
    .from("notas_credito_proveedores")
    .select("*, proveedor:proveedores(nombre)")
    .gte("fecha", fechaInicio)
    .lte("fecha", fechaFin)
    .order("fecha", { ascending: false });
  if (error) throw error;
  return data.map(mapearNotaCredito);
}

export async function crearNotaCredito(datos) {
  const { data, error } = await supabase
    .from("notas_credito_proveedores")
    .insert({
      fecha: datos.fecha,
      proveedor_id: datos.proveedorId,
      pedido_id: datos.pedidoId || null,
      motivo: datos.motivo || null,
      monto: Number(datos.monto),
      observaciones: datos.observaciones || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarEstadoNotaCredito(id, estado) {
  const { error } = await supabase.from("notas_credito_proveedores").update({ estado }).eq("id", id);
  if (error) throw error;
}

export async function eliminarNotaCredito(id) {
  const { error } = await supabase.from("notas_credito_proveedores").delete().eq("id", id);
  if (error) throw error;
}

// Saldo a favor por proveedor: suma de notas de crédito todavía "Disponible"
// (sin fecha límite — trae todas las que estén en ese estado, sin importar cuándo se generaron).
export async function obtenerSaldoAFavorPorProveedor() {
  const { data, error } = await supabase
    .from("notas_credito_proveedores")
    .select("monto, proveedor:proveedores(id, nombre)")
    .eq("estado", "Disponible");
  if (error) throw error;

  const mapa = {};
  for (const fila of data) {
    const id = fila.proveedor?.id;
    if (!id) continue;
    if (!mapa[id]) mapa[id] = { proveedorId: id, proveedor: fila.proveedor.nombre, saldo: 0 };
    mapa[id].saldo += Number(fila.monto);
  }
  return Object.values(mapa).sort((a, b) => b.saldo - a.saldo);
}
