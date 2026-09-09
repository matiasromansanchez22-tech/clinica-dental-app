import { supabase } from "@/lib/supabaseClient";

const BUCKET = "comprobantes";

// Sube la foto/PDF del comprobante y devuelve la ruta guardada — todavía
// no está asociada a ningún gasto, eso se hace después al guardar el
// gasto (así si cancela el formulario no queda un gasto a medias).
export async function subirComprobante(archivo) {
  const extension = archivo.name.includes(".") ? archivo.name.slice(archivo.name.lastIndexOf(".")) : "";
  const nombreEnStorage = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension}`;

  const { error } = await supabase.storage.from(BUCKET).upload(nombreEnStorage, archivo, {
    contentType: archivo.type || undefined,
  });
  if (error) throw error;
  return nombreEnStorage;
}

export async function obtenerUrlComprobante(storagePath) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function eliminarComprobante(storagePath) {
  const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (error) throw error;
}

// Manda el archivo a la API que lo lee con IA y devuelve la sugerencia
// (monto, fecha, medio de pago, categoría, descripción) — el llamador
// decide qué hacer con eso, nunca se carga nada solo desde acá.
export async function leerComprobanteConIA(archivo, categoriasDisponibles) {
  const formData = new FormData();
  formData.append("archivo", archivo);
  formData.append("categorias", JSON.stringify(categoriasDisponibles));

  const res = await fetch("/api/leer-comprobante", { method: "POST", body: formData });
  const datos = await res.json();
  if (!res.ok) throw new Error(datos.error || "No se pudo leer el comprobante.");
  return datos;
}
