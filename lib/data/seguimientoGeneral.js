import { supabase } from "@/lib/supabaseClient";
import { fechaDeHoyISO } from "@/lib/agenda";
import { nombreCercano } from "@/lib/whatsapp";
import { calcularSeguimientoGeneral } from "@/lib/seguimientoGeneral";

export const ESTADOS_SEGUIMIENTO = ["Por contactar", "Mensaje enviado", "Sin respuesta", "Quiere seguir", "Turno agendado", "No quiere seguir", "Ya no es paciente"];

export async function obtenerSeguimientoGeneral() {
  return calcularSeguimientoGeneral(supabase, { hoy: fechaDeHoyISO() });
}

export async function guardarGestionSeguimiento(pacienteId, cambios) {
  // Queda anotado quién hizo el último contacto (lo usa la rutina del equipo para contar los contactos del día).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("seguimiento_general")
    .upsert({ paciente_id: pacienteId, ...cambios, ...(cambios.estado ? { usuario_id: user?.id ?? null } : {}), updated_at: new Date().toISOString() }, { onConflict: "paciente_id" })
    .select("paciente_id, estado, nota, fecha_ultimo_contacto")
    .single();
  if (error) {
    if (/relation|does not exist|schema cache/i.test(error.message || "")) throw new Error("Falta correr la migración 208 en Supabase.");
    throw error;
  }
  return data;
}

// Para cuando se le escribe: queda con la fecha de hoy.
export const cambiosDeContacto = (estado) => ({ estado, fecha_ultimo_contacto: fechaDeHoyISO() });

export async function guardarCelularPaciente(pacienteId, numero) {
  const { error } = await supabase.from("pacientes").update({ celular: numero.trim() || null }).eq("id", pacienteId);
  if (error) throw error;
}

// Justo antes de escribirle se vuelve a mirar si ya tiene un turno por venir (la lista pudo quedar abierta hace rato).
export async function proximoTurnoDelPaciente(pacienteId) {
  const { data } = await supabase
    .from("turnos_general")
    .select("fecha")
    .eq("paciente_id", pacienteId)
    .eq("estado", "Agendado")
    .gte("fecha", fechaDeHoyISO())
    .order("fecha")
    .limit(1);
  return data?.[0]?.fecha || null;
}

const dm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const minus = (t) => String(t || "").charAt(0).toLowerCase() + String(t || "").slice(1);
const primerNombreProf = (n) => String(n || "").split(" ")[0];

// Borrador del mensaje: se puede editar antes de mandarlo.
export function mensajeSeguimientoGeneral(x) {
  const n = nombreCercano(x.nombre);
  const prof = primerNombreProf(x.profesional);
  const intro = `¡Hola ${n}! Te escribimos desde Clínica Dental Marianela Ramírez 😊`;
  if (x.categoria === "A") {
    const consulta = x.primeraConsulta ? `Viniste a tu consulta${prof ? ` con ${prof}` : ""} el ${dm(x.primeraConsulta)} y te dejaron armado` : "Te dejamos armado";
    return `${intro} ${consulta} el presupuesto de tu tratamiento. ¿Pudiste verlo? Si te quedó alguna duda o querés que veamos juntos las opciones de pago, contanos y coordinamos un turno. ¡Estamos a tu disposición!`;
  }
  if (x.categoria === "C") {
    return `${intro} Vimos que tu tratamiento quedó en pausa${x.ultimaPractica ? ` después de tu ${minus(x.ultimaPractica)}` : ""}.${x.proxima ? ` Lo que sigue es ${minus(x.proxima)}.` : ""} ¿Cómo te sentís? Queremos ayudarte a continuarlo: ¿coordinamos tu próximo turno?`;
  }
  const cuando = x.primeraConsulta ? `el ${dm(x.primeraConsulta)}` : "hace unos días";
  return `${intro} Viniste a tu consulta${prof ? ` con ${prof}` : ""} ${cuando} y queríamos saber cómo estás.${x.proxima ? ` Te habían indicado ${minus(x.proxima)}.` : ""} Si todavía tenés pendiente tu tratamiento, o te quedó alguna duda, podemos coordinar un turno para ayudarte. ¿Lo vemos?`;
}
