import { supabase } from "@/lib/supabaseClient";

export async function obtenerCierreDelDia(fecha) {
  const { data, error } = await supabase.from("cierres_dia_verificados").select("*").eq("fecha", fecha).maybeSingle();
  if (error) throw error;
  return data;
}

export async function aprobarCierreDelDia(fecha, usuarioId, nombreDuena, observaciones) {
  const { data, error } = await supabase
    .from("cierres_dia_verificados")
    .upsert(
      {
        fecha,
        usuario_id: usuarioId,
        nombre_duena: nombreDuena || null,
        aprobado_en: new Date().toISOString(),
        observaciones: observaciones || null,
      },
      { onConflict: "fecha" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}
