import { supabase } from "@/lib/supabaseClient";

// Casos (fotos de antes y después) de la galería pública. Las fotos se guardan en el almacenamiento público "galeria" con nombres
// largos e imposibles de adivinar. Un caso solo se puede publicar con la autorización del paciente tildada y las dos fotos.

const BUCKET = "galeria";

export const urlPublicaFoto = (ruta) => supabase.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl;

export async function obtenerCasos() {
  const { data, error } = await supabase.from("galeria_casos").select("*").order("orden", { ascending: true }).order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

// Achica la foto antes de subirla (las del celular pesan varios MB): máximo 1600 px de lado, JPG liviano.
export function reducirImagen(archivo, ladoMax = 1600, calidad = 0.82) {
  return new Promise((resolver, rechazar) => {
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, ladoMax / Math.max(img.width, img.height));
      const lienzo = document.createElement("canvas");
      lienzo.width = Math.round(img.width * escala);
      lienzo.height = Math.round(img.height * escala);
      lienzo.getContext("2d").drawImage(img, 0, 0, lienzo.width, lienzo.height);
      URL.revokeObjectURL(url);
      lienzo.toBlob((blob) => (blob ? resolver(blob) : rechazar(new Error("No se pudo preparar la foto."))), "image/jpeg", calidad);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      rechazar(new Error("No se pudo leer la foto. Probá con otra (JPG o PNG)."));
    };
    img.src = url;
  });
}

async function subir(ruta, blob) {
  const { error } = await supabase.storage.from(BUCKET).upload(ruta, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw error;
}

export async function crearCaso({ titulo, descripcion, tratamiento, duracionMeses, fotoAntes, fotoDespues, fotoIntermedia, etiquetaIntermedia, consentimiento, publicar, etiquetaDespues }) {
  const id = crypto.randomUUID();
  const rutaAntes = `casos/${id}/antes-${crypto.randomUUID()}.jpg`;
  const rutaDespues = `casos/${id}/despues-${crypto.randomUUID()}.jpg`;
  const rutaIntermedia = fotoIntermedia ? `casos/${id}/medio-${crypto.randomUUID()}.jpg` : null;
  const [blobAntes, blobDespues, blobIntermedia] = await Promise.all([reducirImagen(fotoAntes), reducirImagen(fotoDespues), fotoIntermedia ? reducirImagen(fotoIntermedia) : null]);
  await subir(rutaAntes, blobAntes);
  try {
    await subir(rutaDespues, blobDespues);
    if (rutaIntermedia) await subir(rutaIntermedia, blobIntermedia);
    const { data: maxOrden } = await supabase.from("galeria_casos").select("orden").order("orden", { ascending: false }).limit(1);
    const { error } = await supabase.from("galeria_casos").insert({
      id,
      titulo: titulo.trim(),
      descripcion: descripcion?.trim() || null,
      tratamiento: tratamiento || null,
      duracion_meses: duracionMeses ? Number(duracionMeses) : null,
      foto_antes: rutaAntes,
      foto_despues: rutaDespues,
      consentimiento: Boolean(consentimiento),
      publicado: Boolean(publicar && consentimiento),
      orden: (maxOrden?.[0]?.orden || 0) + 1,
      // El rótulo de la segunda foto lo agrega la migración 200; si todavía no está, se guarda el caso sin él.
      ...(etiquetaDespues && etiquetaDespues !== "Después" ? { etiqueta_despues: etiquetaDespues } : {}),
      // La foto del medio la agrega la migración 201.
      ...(rutaIntermedia ? { foto_intermedia: rutaIntermedia, etiqueta_intermedia: etiquetaIntermedia || "Durante el tratamiento" } : {}),
    });
    if (error) throw error;
  } catch (e) {
    // Si algo falló, no quedan fotos sueltas en el almacenamiento.
    await supabase.storage.from(BUCKET).remove([rutaAntes, rutaDespues, rutaIntermedia].filter(Boolean));
    throw e;
  }
  return id;
}

export async function actualizarCaso(id, cambios) {
  const { error } = await supabase.from("galeria_casos").update(cambios).eq("id", id);
  if (error) throw error;
}

export async function eliminarCaso(caso) {
  const { error: errorFotos } = await supabase.storage.from(BUCKET).remove([caso.foto_antes, caso.foto_intermedia, caso.foto_despues].filter(Boolean));
  if (errorFotos) throw errorFotos;
  const { error } = await supabase.from("galeria_casos").delete().eq("id", caso.id);
  if (error) throw error;
}
