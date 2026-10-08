import { supabase } from "@/lib/supabaseClient";
import { fechaDeHoyISO } from "@/lib/agenda";
import { obtenerTurnosGeneralPorRango } from "@/lib/data/turnosGeneral";

function horaActualArgentina() {
  return new Date().toLocaleTimeString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// Turnos de Odontología General en los que el paciente vino (no se marcó "No asistió"
// ni está cancelado) y todavía no se cargó "qué se hizo" en la Agenda. Los de hoy
// entran recién cuando ya pasó su horario. Cada turno trae `conNota`: si ese día ya
// hay una nota clínica manual de ese paciente (ayuda a ver que "ya lo anotó, pero no
// lo marcó como realizado").
export async function obtenerPendientesDeRegistro(fechaDesde, fechaHasta) {
  const hoy = fechaDeHoyISO();
  const ahora = horaActualArgentina();
  const turnos = await obtenerTurnosGeneralPorRango(fechaDesde, fechaHasta);
  const candidatos = turnos.filter(
    (t) =>
      t.estado === "Agendado" &&
      t.asistencia !== "No asistió" &&
      t.pacienteId &&
      t.profesionalDeTurnoId &&
      (t.fecha < hoy || (t.fecha === hoy && t.horaInicio <= ahora))
  );
  if (candidatos.length === 0) return [];

  const ids = candidatos.map((t) => t.id);
  const pacientes = [...new Set(candidatos.map((t) => t.pacienteId))];

  const marcados = new Set();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase
      .from("prestaciones_realizadas_agenda")
      .select("turno_general_id")
      .in("turno_general_id", ids.slice(i, i + 200));
    if (error) throw error;
    for (const f of data) marcados.add(f.turno_general_id);
  }

  const notas = new Set(); // "pacienteId|fecha"
  for (let i = 0; i < pacientes.length; i += 100) {
    const { data, error } = await supabase
      .from("historial_clinico_general_entradas")
      .select("paciente_id, fecha")
      .in("paciente_id", pacientes.slice(i, i + 100))
      .eq("origen", "manual")
      .gte("fecha", fechaDesde)
      .lte("fecha", fechaHasta);
    if (error) throw error;
    for (const f of data) notas.add(`${f.paciente_id}|${f.fecha}`);
  }

  return candidatos
    .filter((t) => !marcados.has(t.id))
    .map((t) => ({ ...t, conNota: notas.has(`${t.pacienteId}|${t.fecha}`) }));
}
