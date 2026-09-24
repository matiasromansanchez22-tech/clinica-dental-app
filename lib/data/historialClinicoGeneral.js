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

// Solo las manuales — las que genera el odontograma solo se ven en el
// odontograma mismo (obtenerHistorialOdontograma), para que este historial
// quede libre para anotar cómo viene el plan de tratamiento de cada
// paciente, sin mezclarse con el detalle diente por diente.
export async function obtenerHistorialClinicoGeneral(pacienteId) {
  const { data, error } = await supabase
    .from("historial_clinico_general_entradas")
    .select(SELECT_ENTRADA)
    .eq("paciente_id", pacienteId)
    .eq("origen", "manual")
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(mapearEntrada);
}

// Las que genera solo el odontograma al marcar un diente — para mostrarlas
// aparte, dentro del odontograma.
export async function obtenerHistorialOdontograma(pacienteId) {
  const { data, error } = await supabase
    .from("historial_clinico_general_entradas")
    .select(SELECT_ENTRADA)
    .eq("paciente_id", pacienteId)
    .eq("origen", "odontograma")
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(mapearEntrada);
}

export async function crearEntradaHistorialGeneral({ pacienteId, fecha, profesionalId, nota, origen }) {
  const { data, error } = await supabase
    .from("historial_clinico_general_entradas")
    .insert({ paciente_id: pacienteId, fecha, profesional_id: profesionalId || null, nota, origen: origen || "manual" })
    .select(SELECT_ENTRADA)
    .single();
  if (error) throw error;
  return mapearEntrada(data);
}

export async function actualizarEntradaHistorialGeneral(id, { fecha, profesionalId, nota }) {
  const { data, error } = await supabase
    .from("historial_clinico_general_entradas")
    .update({ fecha, profesional_id: profesionalId || null, nota })
    .eq("id", id)
    .select(SELECT_ENTRADA)
    .single();
  if (error) throw error;
  return mapearEntrada(data);
}

export async function eliminarEntradaHistorialGeneral(id) {
  await moverAPapelera("historial_clinico_general_entradas", id);
}
