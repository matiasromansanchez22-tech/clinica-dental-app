import { supabase } from "@/lib/supabaseClient";
import { crearEntradaHistorialGeneral } from "@/lib/data/historialClinicoGeneral";

// Odontograma de Sistema General — guarda solo el estado ACTUAL de cada
// diente/cara (una fila por combinación, pisada con upsert). El historial
// de cambios queda en historial_clinico_general_entradas: cada vez que se
// marca algo acá, se crea sola una entrada ahí, para no tener que cargar
// todo dos veces.

const ETIQUETA_CARA = {
  vestibular: "vestibular",
  mesial: "mesial",
  distal: "distal",
  oclusal: "oclusal",
  palatino: "palatino/lingual",
};

export async function obtenerOdontograma(pacienteId) {
  const { data, error } = await supabase
    .from("odontograma_estado")
    .select("pieza, cara, estado, profesional_id, fecha")
    .eq("paciente_id", pacienteId);
  if (error) throw error;
  return data;
}

export async function marcarEstadoDiente({ pacienteId, pieza, cara, estado, profesionalId, fecha }) {
  if (estado === "Sano") {
    const { error } = await supabase
      .from("odontograma_estado")
      .delete()
      .eq("paciente_id", pacienteId)
      .eq("pieza", pieza)
      .eq("cara", cara);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("odontograma_estado").upsert(
      {
        paciente_id: pacienteId,
        pieza,
        cara,
        estado,
        profesional_id: profesionalId || null,
        fecha,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "paciente_id,pieza,cara" }
    );
    if (error) throw error;
  }

  const etiquetaCara = cara === "general" ? "" : ` (${ETIQUETA_CARA[cara] || cara})`;
  await crearEntradaHistorialGeneral({
    pacienteId,
    fecha,
    profesionalId,
    nota: `Odontograma — diente ${pieza}${etiquetaCara}: ${estado}`,
  });
}
