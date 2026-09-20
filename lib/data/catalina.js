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
