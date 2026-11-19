import { supabase } from "@/lib/supabaseClient";
import { eliminarComprobante, obtenerUrlComprobante, subirComprobante } from "@/lib/data/comprobantes";
import { leerFacturaPedidoConIA } from "@/lib/data/pedidosInsumos";

// Boletas de los pedidos que van llegando (migración 209): foto o PDF + proveedor, fecha, monto y si está pagada.

export const MEDIOS_PAGO_BOLETA = ["Efectivo", "Transferencia", "Débito", "Crédito", "Mercado Pago", "QR"];

function revisar(error) {
  if (!error) return;
  if (/relation|does not exist|schema cache/i.test(error.message || "")) throw new Error("Falta correr la migración 209 en Supabase.");
  throw error;
}

function mapear(f) {
  return {
    id: f.id,
    fecha: f.fecha,
    proveedor: f.proveedor,
    numero: f.numero,
    monto: Number(f.monto),
    archivoPath: f.archivo_path,
    pagada: f.pagada,
    fechaPago: f.fecha_pago,
    medioPago: f.medio_pago,
    nota: f.nota,
    cargadaPorId: f.cargada_por,
    cargadaPor: f.cargador?.nombre ?? "—",
    creadaEn: f.created_at,
  };
}

export async function obtenerBoletas(desde, hasta) {
  const { data, error } = await supabase
    .from("boletas_pedidos")
    .select("id, fecha, proveedor, numero, monto, archivo_path, pagada, fecha_pago, medio_pago, nota, cargada_por, created_at, cargador:perfiles!cargada_por(nombre)")
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });
  revisar(error);
  return data.map(mapear);
}

// Nombres de proveedores ya usados (en boletas y en Pedidos de Insumos) para sugerir al escribir.
export async function obtenerNombresDeProveedores() {
  const [boletas, proveedores] = await Promise.all([supabase.from("boletas_pedidos").select("proveedor").limit(500), supabase.from("proveedores").select("nombre")]);
  const nombres = new Set([...(boletas.data || []).map((b) => b.proveedor), ...(proveedores.data || []).map((p) => p.nombre)].filter(Boolean));
  return [...nombres].sort((a, b) => a.localeCompare(b, "es"));
}

// Sube el archivo y guarda la boleta. Si el guardado falla, el archivo se borra para no dejar basura.
export async function crearBoleta({ archivo, fecha, proveedor, numero, monto, pagada, medioPago, nota }) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Tenés que iniciar sesión.");
  const ruta = await subirComprobante(archivo);
  const { error } = await supabase.from("boletas_pedidos").insert({
    fecha,
    proveedor: proveedor.trim(),
    numero: numero?.trim() || null,
    monto: Number(monto),
    archivo_path: ruta,
    pagada: Boolean(pagada),
    fecha_pago: pagada ? fecha : null,
    medio_pago: pagada ? medioPago || "Efectivo" : null,
    pagada_por: pagada ? user.id : null,
    nota: nota?.trim() || null,
    cargada_por: user.id,
  });
  if (error) {
    await eliminarComprobante(ruta).catch(() => {});
    revisar(error);
  }
}

export async function marcarBoletaPagada(id, { fechaPago, medioPago }) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase.from("boletas_pedidos").update({ pagada: true, fecha_pago: fechaPago, medio_pago: medioPago, pagada_por: user?.id ?? null }).eq("id", id);
  revisar(error);
}

export async function desmarcarBoletaPagada(id) {
  const { error } = await supabase.from("boletas_pedidos").update({ pagada: false, fecha_pago: null, medio_pago: null, pagada_por: null }).eq("id", id);
  revisar(error);
}

export async function eliminarBoleta(boleta) {
  const { data, error } = await supabase.from("boletas_pedidos").delete().eq("id", boleta.id).select("id");
  revisar(error);
  if (!data?.length) throw new Error("No se puede borrar: pasaron más de 30 minutos y solo una dueña o la contadora puede hacerlo.");
  await eliminarComprobante(boleta.archivoPath).catch(() => {});
}

export const urlDeBoleta = (boleta) => obtenerUrlComprobante(boleta.archivoPath);

// Lee la foto con IA y devuelve lo que pudo sacar: proveedor, fecha, monto (suma de los ítems), número y medio de pago.
export async function leerBoletaConIA(archivo) {
  const d = await leerFacturaPedidoConIA(archivo);
  const monto = (d.items || []).reduce((a, i) => a + Number(i.cantidad || 0) * Number(i.precioUnitario || 0), 0);
  return { proveedor: d.proveedor || "", fecha: d.fecha || "", monto: monto > 0 ? Math.round(monto) : "", numero: d.observaciones || "", medioPago: d.medioPago || "" };
}
