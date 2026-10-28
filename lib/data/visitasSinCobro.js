import { supabase } from "@/lib/supabaseClient";
import { fechaDeHoyISO } from "@/lib/agenda";
import { ESTADOS_ASISTENCIA, situacionDelTurno } from "@/lib/data/seguimientoOrtodoncia";

// Control de "visitas sin cobro" de Ortodoncia: pacientes que vinieron un día y no tienen ningún cobro cargado ese mes (ni el mes
// figura como pago anticipado en la grilla de Controles), salvo que alguien ya haya justificado por qué.

export const MOTIVOS_SIN_COBRO = ["Pagó antes", "No se cobra esta visita", "Queda pendiente de pago"];
// Odontología General: además se puede explicar que se factura a la obra social, o escribir otro motivo.
export const MOTIVOS_SIN_COBRO_GENERAL = [...MOTIVOS_SIN_COBRO, "Obra social (se factura)", "Otro motivo"];

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

// Las visitas de `fecha` que todavía no tienen cobro ni justificación.
//   devuelve [{ turnoId, pacienteId, paciente, concepto, hora, ortodoncista }]
export async function obtenerVisitasSinCobroDelDia(fecha) {
  const hoy = fechaDeHoyISO();
  const { data: turnos, error } = await supabase
    .from("turnos_ortodoncia")
    .select("id, fecha, hora_inicio, concepto, estado, presencia, asistencia, paciente_id, paciente:pacientes_ortodoncia(nombre), ortodoncista:profesionales!ortodoncista_id(nombre)")
    .eq("fecha", fecha)
    .eq("estado", "Agendado")
    .order("hora_inicio");
  if (error) throw error;
  const vinieron = turnos.filter((t) => t.paciente_id && situacionDelTurno(t, hoy) === ESTADOS_ASISTENCIA.ASISTIO);
  if (vinieron.length === 0) return [];

  const mes = fecha.slice(0, 7);
  const [anio, numMes] = [Number(mes.slice(0, 4)), Number(mes.slice(5, 7))];
  const ultimo = String(new Date(anio, numMes, 0).getDate()).padStart(2, "0");
  const ids = vinieron.map((t) => t.paciente_id);
  const [cobros, grilla, justificadas] = await Promise.all([
    supabase.from("caja_ortodoncia").select("paciente_id").in("paciente_id", ids).gte("fecha", `${mes}-01`).lte("fecha", `${mes}-${ultimo}`),
    supabase.from("controles_ortodoncia").select(`paciente_id, ${MESES[numMes - 1]}`).in("paciente_id", ids).eq("anio", anio),
    supabase.from("visitas_sin_cobro_justificadas").select("turno_ortodoncia_id").in("turno_ortodoncia_id", vinieron.map((t) => t.id)),
  ]);
  if (cobros.error) throw cobros.error;
  // Si todavía no se corrió la migración 168 no se bloquea nada: el control queda apagado.
  if (justificadas.error) return [];

  const conCobro = new Set((cobros.data || []).map((c) => c.paciente_id));
  const anticipado = new Set(
    (grilla.data || []).filter((g) => /anticipado/i.test(g[MESES[numMes - 1]] || "")).map((g) => g.paciente_id)
  );
  const yaJustificado = new Set((justificadas.data || []).map((j) => j.turno_ortodoncia_id));

  return vinieron
    .filter((t) => !conCobro.has(t.paciente_id) && !anticipado.has(t.paciente_id) && !yaJustificado.has(t.id))
    .map((t) => ({
      turnoId: t.id,
      pacienteId: t.paciente_id,
      paciente: t.paciente?.nombre?.trim() ?? "(paciente)",
      concepto: t.concepto,
      hora: (t.hora_inicio || "").slice(0, 5),
      ortodoncista: t.ortodoncista?.nombre ?? "Sin asignar",
    }));
}

// "No se cobra esta visita" y "Queda pendiente de pago" piden una nota para entender el motivo después.
export function motivoNecesitaNota(motivo) {
  return motivo !== "Pagó antes" && motivo !== "Obra social (se factura)";
}

// `sistema`: "ortodoncia" (por defecto) o "general".
export async function justificarVisitaSinCobro({ turnoId, pacienteId, fecha, motivo, nota, sistema = "ortodoncia" }) {
  const motivos = sistema === "general" ? MOTIVOS_SIN_COBRO_GENERAL : MOTIVOS_SIN_COBRO;
  if (!motivos.includes(motivo)) throw new Error("Elegí un motivo.");
  if (motivoNecesitaNota(motivo) && !nota?.trim()) throw new Error("Escribí una nota para explicar el motivo.");
  const columna = sistema === "general" ? "turno_general_id" : "turno_ortodoncia_id";
  const { error } = await supabase.from("visitas_sin_cobro_justificadas").upsert(
    { [columna]: turnoId, paciente_id: pacienteId, fecha, motivo, nota: nota?.trim() || null },
    { onConflict: columna }
  );
  if (error) throw error;
}

// Los turnos ya justificados en un rango (para que "Qué revisar" no los vuelva a marcar).
export async function obtenerTurnosJustificados(desdeISO) {
  const { data, error } = await supabase.from("visitas_sin_cobro_justificadas").select("turno_ortodoncia_id").gte("fecha", desdeISO);
  if (error) return new Set();
  return new Set(data.map((j) => j.turno_ortodoncia_id));
}
