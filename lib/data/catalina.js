import { supabase } from "@/lib/supabaseClient";
import { moverAPapelera } from "@/lib/data/papelera";

export const CATEGORIAS_CATALINA = [
  "Frutas",
  "Verduras",
  "Cereales y legumbres",
  "Lácteos",
  "Carnes y pescado",
  "Huevo",
  "Otros",
];

export const ESTADOS_ALIMENTO_CATALINA = ["Le gustó", "No le gustó", "Alergia o reacción", "A probar de nuevo"];

const CAMPOS_ALIMENTO_CATALINA = "id, nombre, categoria, fecha_primera_vez, estado, notas, created_at, updated_at";

export async function obtenerAlimentosCatalina() {
  const { data, error } = await supabase.from("catalina_alimentos").select(CAMPOS_ALIMENTO_CATALINA).order("nombre");
  if (error) throw error;
  return data;
}

export async function crearAlimentoCatalina(datos) {
  const { data, error } = await supabase
    .from("catalina_alimentos")
    .insert({
      nombre: datos.nombre,
      categoria: datos.categoria,
      fecha_primera_vez: datos.fechaPrimeraVez || null,
      estado: datos.estado,
      notas: datos.notas || null,
    })
    .select(CAMPOS_ALIMENTO_CATALINA)
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarAlimentoCatalina(id, datos) {
  const { data, error } = await supabase
    .from("catalina_alimentos")
    .update({
      nombre: datos.nombre,
      categoria: datos.categoria,
      fecha_primera_vez: datos.fechaPrimeraVez || null,
      estado: datos.estado,
      notas: datos.notas || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(CAMPOS_ALIMENTO_CATALINA)
    .single();
  if (error) throw error;
  return data;
}

export async function eliminarAlimentoCatalina(id) {
  await moverAPapelera("catalina_alimentos", id);
}

const CAMPOS_STOCK_CATALINA = "id, nombre, categoria, cantidad, unidad, notas, created_at, updated_at";

export async function obtenerStockCatalina() {
  const { data, error } = await supabase.from("catalina_stock").select(CAMPOS_STOCK_CATALINA).order("nombre");
  if (error) throw error;
  return data;
}

export async function crearItemStockCatalina(datos) {
  const { data, error } = await supabase
    .from("catalina_stock")
    .insert({
      nombre: datos.nombre,
      categoria: datos.categoria,
      cantidad: Number(datos.cantidad) || 0,
      unidad: datos.unidad || null,
      notas: datos.notas || null,
    })
    .select(CAMPOS_STOCK_CATALINA)
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarItemStockCatalina(id, datos) {
  const { data, error } = await supabase
    .from("catalina_stock")
    .update({
      nombre: datos.nombre,
      categoria: datos.categoria,
      cantidad: Number(datos.cantidad) || 0,
      unidad: datos.unidad || null,
      notas: datos.notas || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(CAMPOS_STOCK_CATALINA)
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarCantidadStockCatalina(id, cantidad) {
  const { error } = await supabase
    .from("catalina_stock")
    .update({ cantidad: Number(cantidad) || 0, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function eliminarItemStockCatalina(id) {
  await moverAPapelera("catalina_stock", id);
}

// Registra varios productos comprados de una — si el nombre ya existe en
// el stock, le suma la cantidad comprada; si no, lo crea. Si el mismo
// nombre aparece dos veces en la misma compra, se suman entre sí antes.
export async function registrarCompraCatalina(items) {
  const agrupados = new Map();
  for (const item of items) {
    const nombre = (item.nombre || "").trim();
    if (!nombre) continue;
    const clave = nombre.toLowerCase();
    const cantidad = Number(item.cantidad) || 0;
    if (agrupados.has(clave)) {
      agrupados.get(clave).cantidad += cantidad;
    } else {
      agrupados.set(clave, { nombre, categoria: item.categoria, unidad: item.unidad, cantidad });
    }
  }
  if (agrupados.size === 0) return;

  const { data: stockActual, error } = await supabase.from("catalina_stock").select("id, nombre, cantidad");
  if (error) throw error;

  for (const item of agrupados.values()) {
    const existente = stockActual.find((s) => s.nombre.trim().toLowerCase() === item.nombre.toLowerCase());
    if (existente) {
      await actualizarCantidadStockCatalina(existente.id, Number(existente.cantidad) + item.cantidad);
    } else {
      await crearItemStockCatalina(item);
    }
  }
}
