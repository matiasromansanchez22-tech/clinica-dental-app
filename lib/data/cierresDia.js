import { supabase } from "@/lib/supabaseClient";

export async function obtenerCierreDelDia(fecha) {
  const { data, error } = await supabase.from("cierres_dia_verificados").select("*").eq("fecha", fecha).maybeSingle();
  if (error) throw error;
  return data;
}

export async function aprobarCierreDelDia(fecha, usuarioId, nombreDuena, observaciones, detalle) {
  const { data, error } = await supabase
    .from("cierres_dia_verificados")
    .upsert(
      {
        fecha,
        usuario_id: usuarioId,
        nombre_duena: nombreDuena || null,
        aprobado_en: new Date().toISOString(),
        observaciones: observaciones || null,
        detalle: detalle || null,
      },
      { onConflict: "fecha" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Cierres aprobados dentro de un rango de fechas, con su detalle congelado
// (si lo tienen), para mostrar el desglose día por día en Balance Mensual.
export async function obtenerCierresDelMes(fechaInicio, fechaFin) {
  const { data, error } = await supabase
    .from("cierres_dia_verificados")
    .select("fecha, detalle, nombre_duena, aprobado_en")
    .gte("fecha", fechaInicio)
    .lte("fecha", fechaFin);
  if (error) throw error;
  return data;
}
