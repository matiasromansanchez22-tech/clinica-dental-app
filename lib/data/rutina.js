import { supabase } from "@/lib/supabaseClient";

// Registro de la rutina semanal de cada dueña: una fila por día con el turno, las tareas tildadas,
// las 3 prioridades y las notas del cierre. Cada dueña ve solo lo suyo (ver migración 183).

export async function obtenerRegistroDeRutina(fecha) {
  const { data, error } = await supabase.from("rutina_registro").select("*").eq("fecha", fecha).maybeSingle();
  if (error) throw error;
  return data;
}

// Guarda solo lo que se pasa en `cambios` ({ turno, hechos, prioridades, notas }); lo demás queda como estaba.
export async function guardarRegistroDeRutina(usuarioId, fecha, cambios) {
  const { data, error } = await supabase
    .from("rutina_registro")
    .upsert({ usuario_id: usuarioId, fecha, ...cambios, updated_at: new Date().toISOString() }, { onConflict: "usuario_id,fecha" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function obtenerRegistrosDeRutina(desde, hasta) {
  const { data, error } = await supabase
    .from("rutina_registro")
    .select("*")
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .order("fecha");
  if (error) throw error;
  return data;
}
