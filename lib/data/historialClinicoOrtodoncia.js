import { supabase } from "@/lib/supabaseClient";
import { moverAPapelera } from "@/lib/data/papelera";

const SELECT_ENTRADA = `id, paciente_id, fecha, nota, created_at, profesional:profesionales(id, nombre)`;

function mapearEntrada(f) {
  return {
    id: f.id,
    pacienteId: f.paciente_id,
    fecha: f.fecha,
    nota: f.nota,
    profesionalId: f.profesional?.id ?? null,
    profesional: f.profesional?.nombre ?? null,
  };
}

export async function obtenerHistorialClinico(pacienteId) {
  const { data, error } = await supabase
    .from("historial_clinico_entradas")
    .select(SELECT_ENTRADA)
    .eq("paciente_id", pacienteId)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(mapearEntrada);
}

export async function crearEntradaHistorial({ pacienteId, fecha, profesionalId, nota }) {
  const { data, error } = await supabase
    .from("historial_clinico_entradas")
    .insert({ paciente_id: pacienteId, fecha, profesional_id: profesionalId || null, nota })
    .select(SELECT_ENTRADA)
    .single();
  if (error) throw error;
  return mapearEntrada(data);
}

export async function actualizarEntradaHistorial(id, { fecha, profesionalId, nota }) {
  const { data, error } = await supabase
    .from("historial_clinico_entradas")
    .update({ fecha, profesional_id: profesionalId || null, nota })
    .eq("id", id)
    .select(SELECT_ENTRADA)
    .single();
  if (error) throw error;
  return mapearEntrada(data);
}

export async function eliminarEntradaHistorial(id) {
  await moverAPapelera("historial_clinico_entradas", id);
}
