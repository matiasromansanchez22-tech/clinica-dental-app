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

// Para cuando se le escribe o se le avisa por otro medio: queda con la fecha de hoy.
export function cambiosDeContacto(estado) {
  return { estado, fecha_ultimo_contacto: fechaDeHoyISO() };
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

// Para los que vienen seguido pero todavía no tienen turno este mes: invitarlos a agendar el control.
export function mensajeAgendarControlOrtodoncia(nombrePaciente) {
  const nombre = nombreCercano(nombrePaciente);
  return `¡Hola ${nombre}! Te escribimos desde Clínica Dental Marianela Ramírez. Vimos que todavía no tenés turno de ortodoncia para este mes. ¿Querés que te agendemos tu control? Decinos qué días y horarios te quedan mejor y lo coordinamos. ¡Gracias!`;
}
