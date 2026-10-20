import { supabase } from "@/lib/supabaseClient";
import { fechaDeHoyISO } from "@/lib/agenda";
import { nombreCercano } from "@/lib/whatsapp";

export const ESTADOS_RETOMAR = [
  "Por contactar",
  "Mensaje enviado",
  "Sin respuesta",
  "Quiere retomar",
  "Turno agendado",
  "No quiere seguir",
  "Ya no es paciente",
];

// Seguimiento guardado de cada paciente ({ [pacienteId]: { estado, nota, fecha_ultimo_contacto } }).
// Si todavía no se corrió la migración 158 devuelve { disponible: false } y la pantalla avisa.
export async function obtenerGestionRetomar() {
  const { data, error } = await supabase
    .from("retomar_ortodoncia")
    .select("paciente_id, estado, nota, fecha_ultimo_contacto");
  if (error) return { disponible: false, porPaciente: {} };
  return { disponible: true, porPaciente: Object.fromEntries(data.map((g) => [g.paciente_id, g])) };
}

export async function guardarGestionRetomar(pacienteId, cambios) {
  const { data, error } = await supabase
    .from("retomar_ortodoncia")
    .upsert(
      { paciente_id: pacienteId, ...cambios, updated_at: new Date().toISOString() },
      { onConflict: "paciente_id" }
    )
    .select("paciente_id, estado, nota, fecha_ultimo_contacto")
    .single();
  if (error) throw error;
  return data;
}

// Justo antes de escribirle a alguien se vuelve a mirar en la base (la lista puede haber quedado abierta hace rato):
// si ya tiene un turno por venir, o ya vino/pagó en los últimos 30 días, se le avisa a quien va a escribir.
export async function verificarAntesDeEscribir(pacienteId) {
  const hoy = fechaDeHoyISO();
  const [y, m, d] = hoy.split("-").map(Number);
  const hace30 = new Date(y, m - 1, d - 30);
  const desde = `${hace30.getFullYear()}-${String(hace30.getMonth() + 1).padStart(2, "0")}-${String(hace30.getDate()).padStart(2, "0")}`;
  const [turnos, cobros] = await Promise.all([
    supabase
      .from("turnos_ortodoncia")
      .select("fecha, hora_inicio, estado, presencia")
      .eq("paciente_id", pacienteId)
      .eq("estado", "Agendado")
      .gte("fecha", desde)
      .order("fecha"),
    supabase.from("caja_ortodoncia").select("fecha, concepto").eq("paciente_id", pacienteId).gte("fecha", desde).order("fecha", { ascending: false }),
  ]);
  const proximoTurno = (turnos.data || []).find((t) => t.fecha >= hoy) || null;
  const visita =
    (turnos.data || []).filter((t) => t.fecha <= hoy && ["En espera", "En consultorio", "Finalizado"].includes(t.presencia)).pop() ||
    (cobros.data || []).find((c) => c.concepto !== "Pago adelantado") ||
    null;
  return { proximoTurno, ultimaVisita: visita?.fecha || null };
}

// Para cuando se le escribe o se le avisa por otro medio: queda con la fecha de hoy.
export function cambiosDeContacto(estado) {
  return { estado, fecha_ultimo_contacto: fechaDeHoyISO() };
}

// El paciente en realidad solo vino a una consulta (nunca arrancó el tratamiento): pasa a "Consulta" y sale de las
// listas de pacientes en tratamiento. Si más adelante arranca (instalación), el sistema lo vuelve a Activo solo.
export async function marcarComoConsulta(pacienteId) {
  const { error } = await supabase.from("pacientes_ortodoncia").update({ estado_paciente: "Consulta" }).eq("id", pacienteId);
  if (error) throw error;
}

export async function guardarWhatsAppPacienteOrtodoncia(pacienteId, numero) {
  const { error } = await supabase
    .from("pacientes_ortodoncia")
    .update({ whatsapp: numero.trim() || null })
    .eq("id", pacienteId);
  if (error) throw error;
}

// Borrador del mensaje: se puede editar en WhatsApp antes de mandarlo.
export function mensajeRetomarOrtodoncia(nombrePaciente) {
  const nombre = nombreCercano(nombrePaciente);
  return `¡Hola ${nombre}! Te escribimos desde Clínica Dental Marianela Ramírez. Hace un tiempo que no te vemos por el consultorio y queríamos saber cómo estás y si querés retomar tu tratamiento de ortodoncia. Si querés, coordinamos un turno. ¡Te esperamos!`;
}

// Para los que tenían turno y no vinieron: ofrecerles reprogramarlo.
export function mensajeReprogramarTurnoOrtodoncia(nombrePaciente, fechaTurnoISO) {
  const nombre = nombreCercano(nombrePaciente);
  const [, mes, dia] = (fechaTurnoISO || "").split("-");
  const cuando = fechaTurnoISO ? ` del ${dia}/${mes}` : "";
  return `¡Hola ${nombre}! Te escribimos desde Clínica Dental Marianela Ramírez. Vimos que no pudiste venir a tu turno de ortodoncia${cuando}. ¿Querés que lo reprogramemos? Decinos qué días y horarios te quedan mejor y lo coordinamos. ¡Gracias!`;
}

// Para los que vienen seguido pero todavía no tienen turno este mes: invitarlos a agendar el control.
export function mensajeAgendarControlOrtodoncia(nombrePaciente) {
  const nombre = nombreCercano(nombrePaciente);
  return `¡Hola ${nombre}! Te escribimos desde Clínica Dental Marianela Ramírez. Vimos que todavía no tenés turno de ortodoncia para este mes. ¿Querés que te agendemos tu control? Decinos qué días y horarios te quedan mejor y lo coordinamos. ¡Gracias!`;
}
