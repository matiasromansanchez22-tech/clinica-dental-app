import { supabase } from "@/lib/supabaseClient";
import { fechaDeHoyISO, hayConflictoDeHorario, seMuestraEnGrilla } from "@/lib/agenda";
import { obtenerTurnosOrtodonciaPorRango } from "@/lib/data/turnosOrtodoncia";

// Cuando un turno lo atiende una ortodoncista distinta a la de la ficha del paciente hay tres casos (columna tipo_otro_ortodoncista):
//  · Prioridad: lo atiende la otra y después vuelve con la suya.
//  · Sobreturno: se agendó con la otra para no perder el lugar; si se libera un turno con la suya, se pasa.
//  · Cobertura: la otra atiende solo ese día; no cambia nada.

export const TIPOS_OTRO_ORTODONCISTA = {
  PRIORIDAD: "Prioridad",
  SOBRETURNO: "Sobreturno",
  COBERTURA: "Cobertura",
};

const SELECT = `id, fecha, hora_inicio, duracion_min, consultorio, concepto, estado, paciente_id, ortodoncista_id, ortodoncista_habitual_id,
  tipo_otro_ortodoncista, motivo_prioridad,
  paciente:pacientes_ortodoncia(nombre, whatsapp, ortodoncista_id, ortodoncista:profesionales!ortodoncista_id(nombre)),
  ortodoncista:profesionales!ortodoncista_id(nombre),
  habitual:profesionales!ortodoncista_habitual_id(nombre)`;

function mapear(t) {
  return {
    id: t.id,
    fecha: t.fecha,
    hora: (t.hora_inicio || "").slice(0, 5),
    duracionMin: t.duracion_min,
    consultorio: t.consultorio,
    concepto: t.concepto,
    pacienteId: t.paciente_id,
    paciente: t.paciente?.nombre?.trim() ?? "(paciente)",
    whatsapp: t.paciente?.whatsapp || null,
    atiendeId: t.ortodoncista_id,
    atiende: t.ortodoncista?.nombre ?? "—",
    fichaId: t.paciente?.ortodoncista_id ?? null,
    ficha: t.paciente?.ortodoncista?.nombre ?? null,
    habitualId: t.ortodoncista_habitual_id,
    habitual: t.habitual?.nombre ?? t.paciente?.ortodoncista?.nombre ?? null,
    tipo: t.tipo_otro_ortodoncista,
    motivo: t.motivo_prioridad,
  };
}

// Turnos futuros de pacientes que atiende otra ortodoncista y todavía no se clasificaron (ni prioridad, ni sobreturno, ni cobertura).
// Devuelve { disponible: false } si todavía no se corrió la migración 169.
export async function obtenerTurnosSinClasificar() {
  const hoy = fechaDeHoyISO();
  const { data, error } = await supabase
    .from("turnos_ortodoncia")
    .select(SELECT)
    .eq("estado", "Agendado")
    .is("tipo_otro_ortodoncista", null)
    .gte("fecha", hoy)
    .order("fecha")
    .order("hora_inicio")
    .range(0, 999);
  if (error) return { disponible: false, turnos: [] };
  const turnos = data.map(mapear).filter((t) => t.fichaId && t.atiendeId && t.fichaId !== t.atiendeId);
  return { disponible: true, turnos };
}

// Deja el turno clasificado. Prioridad y Sobreturno marcan prioridad (así aparecen en Prioridades); Cobertura no.
export async function clasificarTurno(turnoId, tipo, { habitualId, motivo } = {}) {
  const esCobertura = tipo === TIPOS_OTRO_ORTODONCISTA.COBERTURA;
  const { error } = await supabase
    .from("turnos_ortodoncia")
    .update({
      tipo_otro_ortodoncista: tipo,
      prioridad: !esCobertura,
      ortodoncista_habitual_id: habitualId || null,
      motivo_prioridad: motivo?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", turnoId);
  if (error) throw error;
}

// Sobreturnos pendientes de acomodar: agendados, de hoy en adelante (y los de días pasados que quedaron sin resolver).
export async function obtenerSobreturnos() {
  const { data, error } = await supabase
    .from("turnos_ortodoncia")
    .select(SELECT)
    .eq("estado", "Agendado")
    .eq("tipo_otro_ortodoncista", TIPOS_OTRO_ORTODONCISTA.SOBRETURNO)
    .order("fecha")
    .order("hora_inicio");
  if (error) return { disponible: false, sobreturnos: [] };
  return { disponible: true, sobreturnos: data.map(mapear) };
}

// Lugares que quedaron libres con la ortodoncista habitual del paciente entre hoy y la fecha del sobreturno: turnos suyos
// cancelados o a reprogramar cuyo horario no volvió a ocuparse y alcanza para la duración del sobreturno.
export async function obtenerLugaresLibresParaSobreturno(sobreturno) {
  const hoy = fechaDeHoyISO();
  const desde = sobreturno.fecha < hoy ? sobreturno.fecha : hoy;
  const todos = await obtenerTurnosOrtodonciaPorRango(desde, sobreturno.fecha);
  const lugares = [];
  const vistos = new Set();
  for (const t of todos) {
    if (t.profesionalDeTurnoId !== sobreturno.habitualId) continue;
    if (seMuestraEnGrilla(t)) continue;
    if (t.fecha < hoy) continue;
    if (t.fecha === sobreturno.fecha && t.horaInicio === sobreturno.hora && t.consultorio === sobreturno.consultorio) continue;
    const clave = `${t.fecha}|${t.horaInicio}|${t.consultorio}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    const delDia = todos.filter((x) => x.fecha === t.fecha && seMuestraEnGrilla(x) && x.id !== sobreturno.id);
    const hayConflicto = hayConflictoDeHorario({
      turnosVisibles: delDia,
      consultorio: t.consultorio,
      profesionalDeTurnoId: sobreturno.habitualId,
      horaInicio: t.horaInicio,
      duracionMin: sobreturno.duracionMin,
    });
    if (!hayConflicto) lugares.push({ fecha: t.fecha, hora: t.horaInicio, consultorio: t.consultorio });
  }
  return lugares.sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
}

// Pasa el sobreturno al lugar libre con su ortodoncista habitual: deja de ser sobreturno y queda como un turno normal.
export async function pasarSobreturnoASuOrtodoncista(sobreturno, lugar) {
  const { error } = await supabase
    .from("turnos_ortodoncia")
    .update({
      fecha: lugar.fecha,
      hora_inicio: lugar.hora,
      consultorio: lugar.consultorio,
      ortodoncista_id: sobreturno.habitualId,
      tipo_otro_ortodoncista: null,
      prioridad: false,
      ortodoncista_habitual_id: null,
      motivo_prioridad: null,
      confirmacion: "Sin confirmar",
      updated_at: new Date().toISOString(),
    })
    .eq("id", sobreturno.id);
  if (error) throw error;
}

// No se liberó ningún lugar con su ortodoncista y se confirma que lo atiende la otra: pasa a ser una prioridad normal.
export async function confirmarSobreturnoConLaOtra(turnoId) {
  const { error } = await supabase
    .from("turnos_ortodoncia")
    .update({ tipo_otro_ortodoncista: TIPOS_OTRO_ORTODONCISTA.PRIORIDAD, updated_at: new Date().toISOString() })
    .eq("id", turnoId);
  if (error) throw error;
}
