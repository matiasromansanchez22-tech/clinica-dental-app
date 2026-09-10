import { supabase } from "@/lib/supabaseClient";

const BUCKET = "panoramicas-pacientes";

const TIPOS_HEIC = ["image/heic", "image/heif"];

function esArchivoHeic(archivo) {
  const nombre = (archivo.name || "").toLowerCase();
  return TIPOS_HEIC.includes(archivo.type) || nombre.endsWith(".heic") || nombre.endsWith(".heif");
}

// Los iPhone mandan las fotos en formato HEIC cuando se envían "como
// documento" (para no perder calidad) — pero ningún navegador las puede
// mostrar en ese formato. Acá se convierten a JPG antes de subir, así se
// ven bien en la app sin perder la calidad que se buscaba al mandarlas
// como documento. Si el archivo no es HEIC, se sube tal cual.
export async function prepararArchivoParaSubir(archivo) {
  if (!esArchivoHeic(archivo)) return archivo;

  try {
    const heic2any = (await import("heic2any")).default;
    const resultado = await heic2any({ blob: archivo, toType: "image/jpeg", quality: 0.92 });
    const blobConvertido = Array.isArray(resultado) ? resultado[0] : resultado;

    const nombreNuevo = archivo.name.replace(/\.(heic|heif)$/i, "") + ".jpg";
    return new File([blobConvertido], nombreNuevo, { type: "image/jpeg" });
  } catch {
    // Las fotos HDR más nuevas de iPhone (con "mapa de ganancia" HDR
    // incrustado) usan una variante de HEIC que esta conversión
    // automática todavía no puede leer — se necesita el archivo en otro
    // formato en vez de reintentar.
    throw new Error(
      'Esta foto no se pudo convertir automáticamente (es una variante de HEIC muy nueva). Pedile al profesional que la reenvíe, o mejor: en el iPhone andá a Ajustes → Cámara → Formatos y elegí "Más compatible" — así las próximas fotos se guardan en un formato que sube sin problema, sin perder calidad.'
    );
  }
}

function mapearFila(f) {
  return {
    id: f.id,
    tipoPaciente: f.tipo_paciente,
    pacienteId: f.paciente_id,
    pacienteNombre: f.paciente_nombre,
    storagePath: f.storage_path,
    nombreArchivo: f.nombre_archivo,
    fecha: f.fecha,
    observaciones: f.observaciones,
  };
}

// Una "carpeta" por paciente (agrupa lo que ya se subió), para mostrar de
// entrada en la pantalla principal y poder entrar directo con un clic, sin
// tener que buscar por nombre cada vez.
export async function obtenerCarpetasPanoramicas() {
  const { data, error } = await supabase.from("panoramicas").select("tipo_paciente, paciente_id, paciente_nombre, fecha");
  if (error) throw error;
  const mapa = {};
  for (const f of data) {
    const clave = `${f.tipo_paciente}:${f.paciente_id}`;
    if (!mapa[clave]) {
      mapa[clave] = {
        tipoPaciente: f.tipo_paciente,
        pacienteId: f.paciente_id,
        pacienteNombre: f.paciente_nombre,
        cantidad: 0,
        ultimaFecha: f.fecha,
      };
    }
    mapa[clave].cantidad += 1;
    if (f.fecha > mapa[clave].ultimaFecha) mapa[clave].ultimaFecha = f.fecha;
  }
  return Object.values(mapa).sort((a, b) => (a.ultimaFecha < b.ultimaFecha ? 1 : -1));
}

export async function obtenerPanoramicasPaciente(tipoPaciente, pacienteId) {
  const { data, error } = await supabase
    .from("panoramicas")
    .select("*")
    .eq("tipo_paciente", tipoPaciente)
    .eq("paciente_id", pacienteId)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(mapearFila);
}

// La "carpeta" del paciente es simplemente el prefijo de la ruta
// (tipoPaciente/pacienteId/...) — Storage la arma sola al subir el
// primer archivo, no hace falta crearla a mano.
export async function subirPanoramica({ tipoPaciente, pacienteId, pacienteNombre, archivo, fecha, observaciones }) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const extension = archivo.name.includes(".") ? archivo.name.slice(archivo.name.lastIndexOf(".")) : "";
  const nombreEnStorage = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${extension}`;
  const storagePath = `${tipoPaciente}/${pacienteId}/${nombreEnStorage}`;

  const { error: errorSubida } = await supabase.storage.from(BUCKET).upload(storagePath, archivo, {
    contentType: archivo.type || undefined,
  });
  if (errorSubida) throw errorSubida;

  const { data, error } = await supabase
    .from("panoramicas")
    .insert({
      tipo_paciente: tipoPaciente,
      paciente_id: pacienteId,
      paciente_nombre: pacienteNombre,
      storage_path: storagePath,
      nombre_archivo: archivo.name,
      fecha: fecha || new Date().toISOString().slice(0, 10),
      observaciones: observaciones || null,
      subido_por: user?.id || null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapearFila(data);
}

export async function obtenerUrlPanoramica(storagePath) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 60 * 60);
  if (error) throw error;
  return data.signedUrl;
}

export async function eliminarPanoramica(id, storagePath) {
  const { error: errorStorage } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (errorStorage) throw errorStorage;
  const { error } = await supabase.from("panoramicas").delete().eq("id", id);
  if (error) throw error;
}
