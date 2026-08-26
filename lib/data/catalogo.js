import { supabase } from "@/lib/supabaseClient";

export async function obtenerCatalogo(busqueda) {
  let query = supabase
    .from("catalogo_prestaciones")
    .select("*")
    .order("prestacion");

  if (busqueda) {
    query = query.or(`prestacion.ilike.%${busqueda}%,id.ilike.%${busqueda}%,categoria.ilike.%${busqueda}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function actualizarPrestacionCatalogo(id, cambios) {
  const { data, error } = await supabase.from("catalogo_prestaciones").update(cambios).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

async function generarProximoIdCatalogo() {
  const { data, error } = await supabase.from("catalogo_prestaciones").select("id").ilike("id", "OG-%");
  if (error) throw error;
  const numeros = data.map((f) => Number(f.id.split("-")[1])).filter((n) => !Number.isNaN(n));
  const proximo = (numeros.length ? Math.max(...numeros) : 0) + 1;
  return `OG-${String(proximo).padStart(4, "0")}`;
}

export async function crearPrestacionCatalogo(datos) {
  const id = await generarProximoIdCatalogo();
  const { data, error } = await supabase
    .from("catalogo_prestaciones")
    .insert({
      id,
      especialidad: datos.especialidad || null,
      categoria: datos.categoria || null,
      prestacion: datos.prestacion,
      profesional_habilitado: datos.profesionalHabilitado || null,
      profesional_sugerido: datos.profesionalSugerido || null,
      particular: Boolean(datos.particular),
      nomenclada: Boolean(datos.nomenclada),
      valor_lista: Number(datos.valorLista) || 0,
      valor_efectivo: Number(datos.valorEfectivo) || 0,
      tiempo_estimado_min: datos.tiempoEstimado ? Number(datos.tiempoEstimado) : null,
      estado: "Activo",
      requiere_laboratorio: Boolean(datos.requiereLaboratorio),
      observaciones: datos.observaciones || null,
      activa_obra_social: Boolean(datos.activaObraSocial),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
