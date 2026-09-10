import { supabase } from "@/lib/supabaseClient";

const BUCKET = "biblioteca-marca";
export const CATEGORIAS_MARCA = ["Logos", "Plantillas", "Otros"];

function mapearFila(f) {
  return {
    id: f.id,
    nombreArchivo: f.nombre_archivo,
    storagePath: f.storage_path,
    categoria: f.categoria,
    createdAt: f.created_at,
  };
}

// Si todavía no se corrió la migración que crea esta tabla, se muestra
// vacío en vez de un error técnico — la pantalla igual sirve para ver
// los colores de la marca mientras tanto.
export async function obtenerBibliotecaMarca() {
  try {
    const { data, error } = await supabase
      .from("biblioteca_marca")
      .select("*")
      .order("categoria")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data.map(mapearFila);
  } catch {
    return [];
  }
}

export async function subirABiblioteca(archivo, categoria) {
  const extension = archivo.name.includes(".") ? archivo.name.slice(archivo.name.lastIndexOf(".")) : "";
  const nombreEnStorage = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension}`;

  const { error: errorSubida } = await supabase.storage.from(BUCKET).upload(nombreEnStorage, archivo, {
    contentType: archivo.type || undefined,
  });
  if (errorSubida) throw errorSubida;

  const { data, error } = await supabase
    .from("biblioteca_marca")
    .insert({ nombre_archivo: archivo.name, storage_path: nombreEnStorage, categoria: categoria || "Otros" })
    .select()
    .single();
  if (error) throw error;
  return mapearFila(data);
}

export async function obtenerUrlBiblioteca(storagePath) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function eliminarDeBiblioteca(id, storagePath) {
  const { error: errorStorage } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (errorStorage) throw errorStorage;
  const { error } = await supabase.from("biblioteca_marca").delete().eq("id", id);
  if (error) throw error;
}
