import { supabase } from "@/lib/supabaseClient";
import { moverAPapelera } from "@/lib/data/papelera";
import { crearInsumoStock, obtenerRodanteDeposito, sumarCantidadStock } from "@/lib/data/stock";

export const SECTORES_INSUMO = [
  "Odontología General",
  "Tratamiento de Conducto",
  "Ortodoncia",
  "Insumos descartables",
  "Otros",
];

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
  await moverAPapelera("pedidos_insumos", id);
}

// Igual que crearPedido, pero además suma la cantidad de cada ítem al
// depósito de Stock — solo para los ítems que el usuario vinculó a un
// insumo existente o marcó para crear uno nuevo (los que no se vinculan
// se guardan igual en el pedido, pero no tocan el stock). Solo actualiza
// stock si el pedido ya está "Recibido": uno "Pendiente" o "Cancelado"
// todavía no llegó físicamente.
export async function crearPedidoConStock(datos) {
  const itemsFinal = [];
  for (const item of datos.items) {
    let insumoId = item.insumoId || null;
    if (!insumoId && item.crearInsumoNuevo) {
      const nuevo = await crearInsumoStock(item.insumo, item.sector || SECTORES_INSUMO[0]);
      insumoId = nuevo.id;
    }
    itemsFinal.push({
      insumo: item.insumo,
      cantidad: item.cantidad,
      precioUnitario: item.precioUnitario,
      sector: item.sector,
      ...(insumoId ? { insumoId } : {}),
    });
  }

  const pedido = await crearPedido({ ...datos, items: itemsFinal });

  if (datos.estado === "Recibido") {
    const itemsConStock = itemsFinal.filter((i) => i.insumoId);
    if (itemsConStock.length > 0) {
      const deposito = await obtenerRodanteDeposito();
      for (const item of itemsConStock) {
        await sumarCantidadStock(item.insumoId, deposito.id, Number(item.cantidad) || 0);
      }
    }
  }

  return pedido;
}

// Manda la foto/PDF de la factura del proveedor a la IA y devuelve lo
// que pudo leer (proveedor, fecha, medio de pago, ítems) — el llamador
// decide qué hacer con eso, nunca se carga nada solo desde acá.
export async function leerFacturaPedidoConIA(archivo, _categoriasNoUsadas) {
  const formData = new FormData();
  formData.append("archivo", archivo);

  const res = await fetch("/api/leer-factura-pedido", { method: "POST", body: formData });
  const datos = await res.json();
  if (!res.ok) throw new Error(datos.error || "No se pudo leer la factura.");
  return datos;
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
  await moverAPapelera("notas_credito_proveedores", id);
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
