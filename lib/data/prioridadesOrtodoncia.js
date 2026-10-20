import { supabase } from "@/lib/supabaseClient";
import { fechaDeHoyISO } from "@/lib/agenda";
import { ESTADOS_ASISTENCIA, situacionDelTurno } from "@/lib/data/seguimientoOrtodoncia";

// Turnos de "Prioridad": el paciente es de una ortodoncista (la habitual) y lo atendió otra porque la suya no
// tenía disponibilidad. Acá se ve a quién hay que devolverle a su ortodoncista: si ya tiene turno con ella o falta darlo.

export const SITUACION_VUELTA = {
  POR_VENIR: "Todavía no vino a la prioridad",
  YA_TIENE_TURNO: "Ya tiene turno con su ortodoncista",
  FALTA_TURNO: "Falta darle turno con su ortodoncista",
  A_REVISAR: "Revisar: no figura que haya venido",
};

// `ortodoncistaHabitualId` (opcional): solo los pacientes de esa ortodoncista. Si todavía no se corrió la
// migración 160 devuelve { disponible: false } y no rompe nada.
export async function obtenerPrioridadesOrtodoncia(ortodoncistaHabitualId = null) {
  const hoy = fechaDeHoyISO();
  let consulta = supabase
    .from("turnos_ortodoncia")
    .select(
      `id, fecha, hora_inicio, concepto, estado, presencia, asistencia, paciente_id, ortodoncista_id, ortodoncista_habitual_id, motivo_prioridad,
       paciente:pacientes_ortodoncia(nombre),
       ortodoncista:profesionales!ortodoncista_id(nombre),
       habitual:profesionales!ortodoncista_habitual_id(nombre)`
    )
    .eq("prioridad", true)
    .eq("estado", "Agendado")
    .order("fecha", { ascending: false });
  if (ortodoncistaHabitualId) consulta = consulta.eq("ortodoncista_habitual_id", ortodoncistaHabitualId);
  const { data, error } = await consulta;
  if (error) return { disponible: false, prioridades: [] };

  // Turnos posteriores de esos pacientes con su ortodoncista habitual.
  const pacienteIds = [...new Set(data.map((t) => t.paciente_id).filter(Boolean))];
  const siguientes = [];
  for (let i = 0; i < pacienteIds.length; i += 100) {
    const { data: lote } = await supabase
      .from("turnos_ortodoncia")
      .select("paciente_id, fecha, ortodoncista_id, prioridad")
      .in("paciente_id", pacienteIds.slice(i, i + 100))
      .eq("estado", "Agendado");
    siguientes.push(...(lote || []));
  }

  const prioridades = data.map((t) => {
    const situacion = situacionDelTurno(t, hoy);
    const proximoConHabitual =
      siguientes
        .filter(
          (s) =>
            s.paciente_id === t.paciente_id &&
            s.ortodoncista_id === t.ortodoncista_habitual_id &&
            !s.prioridad &&
            s.fecha > t.fecha
        )
        .map((s) => s.fecha)
        .sort()[0] || null;
    let vuelta;
    if (situacion === ESTADOS_ASISTENCIA.POR_VENIR) vuelta = SITUACION_VUELTA.POR_VENIR;
    else if (situacion === ESTADOS_ASISTENCIA.ASISTIO) {
      vuelta = proximoConHabitual ? SITUACION_VUELTA.YA_TIENE_TURNO : SITUACION_VUELTA.FALTA_TURNO;
    } else vuelta = proximoConHabitual ? SITUACION_VUELTA.YA_TIENE_TURNO : SITUACION_VUELTA.A_REVISAR;
    return {
      id: t.id,
      fecha: t.fecha,
      hora: (t.hora_inicio || "").slice(0, 5),
      concepto: t.concepto,
      pacienteId: t.paciente_id,
      paciente: t.paciente?.nombre ?? "(sin paciente)",
      atendidoPor: t.ortodoncista?.nombre ?? "—",
      habitual: t.habitual?.nombre ?? "—",
      motivo: t.motivo_prioridad,
      situacionTurno: situacion,
      proximoConHabitual,
      vuelta,
      porVolver: vuelta === SITUACION_VUELTA.FALTA_TURNO || vuelta === SITUACION_VUELTA.A_REVISAR,
    };
  });
  // Primero los que falta devolver a su ortodoncista.
  prioridades.sort((a, b) => Number(b.porVolver) - Number(a.porVolver) || b.fecha.localeCompare(a.fecha));
  return { disponible: true, prioridades };
}

export async function obtenerCantidadPrioridadesPorVolver(ortodoncistaHabitualId = null) {
  const { prioridades } = await obtenerPrioridadesOrtodoncia(ortodoncistaHabitualId);
  return prioridades.filter((p) => p.porVolver).length;
}
