import { supabase } from "@/lib/supabaseClient";
import { fechaDeHoyISO } from "@/lib/agenda";
import { obtenerPacientesOrtodoncia } from "@/lib/data/pacientesOrtodoncia";

// Pacientes de ortopedia: hoy están cargados dentro de Ortodoncia (misma agenda y misma caja) y se identifican con la marca
// `es_ortopedia` de la ficha. Esta pantalla los junta en una sola lista, con su próximo turno y su última visita.

const PRESENCIAS_QUE_VINO = ["En espera", "En consultorio", "Finalizado"];

export async function obtenerPacientesOrtopedia({ busqueda } = {}) {
  const hoy = fechaDeHoyISO();
  const todos = await obtenerPacientesOrtodoncia({ busqueda });
  const pacientes = todos.filter((p) => p.esOrtopedia);
  if (pacientes.length === 0) return [];
  const ids = pacientes.map((p) => p.id);
  const turnos = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase
      .from("turnos_ortodoncia")
      .select("paciente_id, fecha, hora_inicio, estado, presencia, asistencia, concepto")
      .in("paciente_id", ids.slice(i, i + 100));
    if (error) throw error;
    turnos.push(...data);
  }
  const proximo = {};
  const ultima = {};
  for (const t of turnos) {
    if (t.estado === "Agendado" && t.fecha >= hoy && (!proximo[t.paciente_id] || t.fecha < proximo[t.paciente_id].fecha)) proximo[t.paciente_id] = t;
    if (t.estado === "Agendado" && t.fecha <= hoy && PRESENCIAS_QUE_VINO.includes(t.presencia) && (!ultima[t.paciente_id] || t.fecha > ultima[t.paciente_id])) {
      ultima[t.paciente_id] = t.fecha;
    }
  }
  return pacientes.map((p) => ({
    ...p,
    proximoTurnoFecha: proximo[p.id]?.fecha || null,
    proximoTurnoConcepto: proximo[p.id]?.concepto || null,
    ultimaVisita: ultima[p.id] || null,
  }));
}
