import { supabase } from "@/lib/supabaseClient";

export const REDES_SOCIALES = ["Instagram", "Facebook", "TikTok", "WhatsApp", "Otra"];
export const ESTADOS_CONTENIDO = ["Idea", "Diseño", "Aprobado", "Publicado"];

function mapearFila(f) {
  return {
    id: f.id,
    fecha: f.fecha,
    redSocial: f.red_social,
    estado: f.estado,
    texto: f.texto,
    tipoPaciente: f.tipo_paciente,
    pacienteId: f.paciente_id,
    pacienteNombre: f.paciente_nombre,
    observaciones: f.observaciones,
  };
}

export async function obtenerContenidos(fechaInicio, fechaFin) {
  let query = supabase.from("calendario_contenido").select("*").order("fecha", { ascending: false });
  if (fechaInicio) query = query.gte("fecha", fechaInicio);
  if (fechaFin) query = query.lte("fecha", fechaFin);
  const { data, error } = await query;
  if (error) throw error;
  return data.map(mapearFila);
}

export async function crearContenido(datos) {
  const { data, error } = await supabase
    .from("calendario_contenido")
    .insert({
      fecha: datos.fecha,
      red_social: datos.redSocial,
      estado: datos.estado || "Idea",
      texto: datos.texto || null,
      tipo_paciente: datos.tipoPaciente || null,
      paciente_id: datos.pacienteId || null,
      paciente_nombre: datos.pacienteNombre || null,
      observaciones: datos.observaciones || null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapearFila(data);
}

export async function actualizarContenido(id, datos) {
  const { data, error } = await supabase
    .from("calendario_contenido")
    .update({
      fecha: datos.fecha,
      red_social: datos.redSocial,
      estado: datos.estado,
      texto: datos.texto || null,
      tipo_paciente: datos.tipoPaciente || null,
      paciente_id: datos.pacienteId || null,
      paciente_nombre: datos.pacienteNombre || null,
      observaciones: datos.observaciones || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return mapearFila(data);
}

export async function eliminarContenido(id) {
  const { error } = await supabase.from("calendario_contenido").delete().eq("id", id);
  if (error) throw error;
}
