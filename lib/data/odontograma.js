import { supabase } from "@/lib/supabaseClient";
import { crearEntradaHistorialGeneral } from "@/lib/data/historialClinicoGeneral";

// Odontograma de Sistema General — guarda solo el estado ACTUAL de cada
// diente/cara (una fila por combinación, pisada con upsert). El historial
// de cambios queda en historial_clinico_general_entradas: cada vez que se
// marca algo acá, se crea sola una entrada ahí, para no tener que cargar
// todo dos veces.
//
// "(sin marcar)" borra la fila (vuelve al diente en blanco, "todavía no
// revisado"). Cualquier otro estado —incluido "Sano"— se guarda explícito,
// para poder distinguir "no revisado" de "revisado y está sano".

const ETIQUETA_CARA = {
  vestibular: "vestibular",
  mesial: "mesial",
  distal: "distal",
  oclusal: "oclusal",
  palatino: "palatino/lingual",
};

// Mismo orden que en el componente (arcada superior e inferior) — hace
// falta acá también para calcular qué piezas quedan "entre" dos elegidas
// para una prótesis.
const PIEZAS_SUPERIOR = ["18", "17", "16", "15", "14", "13", "12", "11", "21", "22", "23", "24", "25", "26", "27", "28"];
const PIEZAS_INFERIOR = ["48", "47", "46", "45", "44", "43", "42", "41", "31", "32", "33", "34", "35", "36", "37", "38"];

export async function obtenerOdontograma(pacienteId) {
  const { data, error } = await supabase
    .from("odontograma_estado")
    .select("pieza, cara, estado, profesional_id, fecha")
    .eq("paciente_id", pacienteId);
  if (error) throw error;
  return data;
}

export async function marcarEstadoDiente({ pacienteId, pieza, cara, estado, profesionalId, fecha }) {
  if (estado === "(sin marcar)") {
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

// Las piezas de una misma arcada entre "desde" y "hasta" (en cualquier
// orden), inclusive — para saber qué dientes abarca un puente. null si son
// de arcadas distintas (un puente no cruza de arriba a abajo).
export function piezasEntre(piezaDesde, piezaHasta) {
  const arcada = PIEZAS_SUPERIOR.includes(piezaDesde)
    ? PIEZAS_SUPERIOR
    : PIEZAS_INFERIOR.includes(piezaDesde)
      ? PIEZAS_INFERIOR
      : null;
  if (!arcada || !arcada.includes(piezaHasta)) return null;
  const i1 = arcada.indexOf(piezaDesde);
  const i2 = arcada.indexOf(piezaHasta);
  const [ini, fin] = i1 <= i2 ? [i1, i2] : [i2, i1];
  return arcada.slice(ini, fin + 1);
}

// Prótesis (puente) — abarca varias piezas seguidas, así que se guarda una
// fila por pieza (todas con cara "protesis"), pero una sola entrada de
// historial clínico para no repetirla una vez por diente.
export async function marcarProtesis({ pacienteId, piezaDesde, piezaHasta, estado, profesionalId, fecha }) {
  const piezas = piezasEntre(piezaDesde, piezaHasta);
  if (!piezas) throw new Error("Elegí dos dientes de la misma arcada (de arriba, o de abajo).");

  if (estado === "(sin marcar)") {
    const { error } = await supabase
      .from("odontograma_estado")
      .delete()
      .eq("paciente_id", pacienteId)
      .eq("cara", "protesis")
      .in("pieza", piezas);
    if (error) throw error;
  } else {
    const filas = piezas.map((pieza) => ({
      paciente_id: pacienteId,
      pieza,
      cara: "protesis",
      estado,
      profesional_id: profesionalId || null,
      fecha,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("odontograma_estado").upsert(filas, { onConflict: "paciente_id,pieza,cara" });
    if (error) throw error;
  }

  await crearEntradaHistorialGeneral({
    pacienteId,
    fecha,
    profesionalId,
    nota: `Odontograma — prótesis dientes ${piezaDesde} a ${piezaHasta}: ${estado}`,
  });
}
