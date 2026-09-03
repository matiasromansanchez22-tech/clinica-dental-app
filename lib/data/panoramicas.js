import { supabase } from "@/lib/supabaseClient";

const BUCKET = "panoramicas-pacientes";

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
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

export async function eliminarPanoramica(id, storagePath) {
  const { error: errorStorage } = await supabase.storage.from(BUCKET).remove([storagePath]);
  if (errorStorage) throw errorStorage;
  const { error } = await supabase.from("panoramicas").delete().eq("id", id);
  if (error) throw error;
}
