import { supabase } from "@/lib/supabaseClient";

function mapear(f) {
  return {
    id: f.id,
    fecha: f.fecha,
    texto: f.texto,
    agenda: f.agenda,
    horaAviso: f.hora_aviso ? f.hora_aviso.slice(0, 5) : null,
    hecho: f.hecho,
    avisoEnviado: Boolean(f.aviso_enviado_at),
  };
}

// Recordatorios de un rango de fechas para una Agenda ("General" u "Ortodoncia"):
// los de esa Agenda y los marcados para "Ambas".
export async function obtenerRecordatorios(desde, hasta, agenda) {
  const { data, error } = await supabase
    .from("recordatorios_agenda")
    .select("*")
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .in("agenda", [agenda, "Ambas"])
    .order("fecha")
    .order("hora_aviso", { ascending: true, nullsFirst: false })
    .order("created_at");
  if (error) throw error;
  return data.map(mapear);
}

export async function crearRecordatorio({ fecha, texto, agenda, horaAviso }) {
  const { error } = await supabase.from("recordatorios_agenda").insert({
    fecha,
    texto: texto.trim(),
    agenda,
    // El campo de hora a veces queda en 00:00 si se lo toca sin querer.
    hora_aviso: horaAviso && horaAviso !== "00:00" ? horaAviso : null,
  });
  if (error) throw error;
}

export async function marcarRecordatorioHecho(id, hecho) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { error } = await supabase
    .from("recordatorios_agenda")
    .update({ hecho, hecho_por: hecho ? user?.id ?? null : null, hecho_at: hecho ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) throw error;
}

export async function eliminarRecordatorio(id) {
  const { error } = await supabase.from("recordatorios_agenda").delete().eq("id", id);
  if (error) throw error;
}

// Recordatorios de hoy con hora de aviso que ya llegó y todavía no se marcaron
// como hechos (para el aviso en pantalla).
export async function obtenerRecordatoriosParaAvisar(hoy, horaActual) {
  const { data, error } = await supabase
    .from("recordatorios_agenda")
    .select("*")
    .eq("fecha", hoy)
    .eq("hecho", false)
    .not("hora_aviso", "is", null)
    .lte("hora_aviso", horaActual)
    .order("hora_aviso");
  if (error) throw error;
  return data.map(mapear);
}

// Se queda con el "turno" de mandar el push: solo una pantalla lo logra (la que
// actualiza la fila mientras todavía no tenía aviso_enviado_at), así no se manda
// dos veces aunque haya varias abiertas. Devuelve true si le tocó a esta.
export async function reclamarEnvioDePush(id) {
  const { data, error } = await supabase
    .from("recordatorios_agenda")
    .update({ aviso_enviado_at: new Date().toISOString() })
    .eq("id", id)
    .is("aviso_enviado_at", null)
    .select("id");
  if (error) throw error;
  return data.length > 0;
}
