import { supabase } from "@/lib/supabaseClient";
import { fechaDeHoyISO } from "@/lib/agenda";
import { nombreCercano } from "@/lib/whatsapp";

// Seguimiento de las CONSULTAS de Ortodoncia: pacientes que vinieron (o tenían que venir) a una consulta y todavía no
// tienen turno para la instalación. Una ficha en estado "Consulta" pasa sola a "Activo" cuando le cargan un turno de
// instalación, así que la lista se va vaciando a medida que agendan.

export const ESTADOS_CONSULTA = [
  "Por contactar",
  "Mensaje enviado",
  "Sin respuesta",
  "Lo está pensando",
  "Quiere instalar",
  "Instalación agendada",
  "No va a hacer ortodoncia",
];

// Los que todavía hay que seguir (no agendaron ni dijeron que no).
export const ESTADOS_CONSULTA_ABIERTOS = ["Por contactar", "Mensaje enviado", "Sin respuesta", "Lo está pensando", "Quiere instalar"];

export const SITUACION_CONSULTA = {
  VINO: "Vino a la consulta",
  AGENDADA: "Consulta agendada (todavía no vino)",
  SIN_MARCAR: "Consulta sin marcar (revisar si vino)",
  CANCELO: "Canceló la consulta",
};

const PRESENCIAS_QUE_VINO = ["En espera", "En consultorio", "Finalizado"];

async function enLotes(ids, consultaPorLote) {
  const filas = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await consultaPorLote(ids.slice(i, i + 100));
    filas.push(...(data || []));
  }
  return filas;
}

export async function obtenerGestionConsultas() {
  const { data, error } = await supabase
    .from("seguimiento_consultas_ortodoncia")
    .select("paciente_id, estado, nota, fecha_ultimo_contacto");
  if (error) return { disponible: false, porPaciente: {} };
  return { disponible: true, porPaciente: Object.fromEntries(data.map((g) => [g.paciente_id, g])) };
}

export async function guardarGestionConsulta(pacienteId, cambios) {
  const { data, error } = await supabase
    .from("seguimiento_consultas_ortodoncia")
    .upsert({ paciente_id: pacienteId, ...cambios, updated_at: new Date().toISOString() }, { onConflict: "paciente_id" })
    .select("paciente_id, estado, nota, fecha_ultimo_contacto")
    .single();
  if (error) throw error;
  return data;
}

export function cambiosDeContactoConsulta(estado) {
  return { estado, fecha_ultimo_contacto: fechaDeHoyISO() };
}

// Ficha que quedó como "Consulta" pero en realidad ya está en tratamiento (por ejemplo, ya tuvo un Control).
export async function pasarAActivo(pacienteId) {
  const { error } = await supabase.from("pacientes_ortodoncia").update({ estado_paciente: "Activo" }).eq("id", pacienteId);
  if (error) throw error;
}

function diasEntre(desdeISO, hastaISO) {
  return Math.round((new Date(`${hastaISO}T00:00:00`) - new Date(`${desdeISO}T00:00:00`)) / 86400000);
}

// Pacientes en estado "Consulta" (más los que ya tienen seguimiento guardado, para seguir viendo qué pasó con ellos).
export async function obtenerConsultasOrtodoncia() {
  const hoy = fechaDeHoyISO();
  const gestion = await obtenerGestionConsultas();
  const idsConSeguimiento = Object.keys(gestion.porPaciente);

  const { data: enConsulta, error } = await supabase
    .from("pacientes_ortodoncia")
    .select("id, nombre, whatsapp, estado_paciente, fecha_instalacion, ortodoncista:profesionales!ortodoncista_id(nombre)")
    .eq("estado_paciente", "Consulta")
    // Los pacientes de ortopedia en consulta se ven en Pacientes Ortopedia, no acá.
    .eq("es_ortopedia", false);
  if (error) throw error;
  const extra = idsConSeguimiento.filter((id) => !enConsulta.some((p) => p.id === id));
  const otros = await enLotes(extra, (lote) =>
    supabase
      .from("pacientes_ortodoncia")
      .select("id, nombre, whatsapp, estado_paciente, fecha_instalacion, ortodoncista:profesionales!ortodoncista_id(nombre)")
      .in("id", lote)
  );
  const pacientes = [...enConsulta, ...otros];
  const ids = pacientes.map((p) => p.id);

  const turnos = await enLotes(ids, (lote) =>
    supabase.from("turnos_ortodoncia").select("paciente_id, fecha, concepto, estado, presencia").in("paciente_id", lote).eq("estado", "Agendado")
  );
  const cobros = await enLotes(ids, (lote) =>
    supabase.from("caja_ortodoncia").select("paciente_id, fecha, concepto").in("paciente_id", lote).eq("concepto", "Consulta de ortodoncia")
  );

  const consultas = pacientes.map((p) => {
    const suyos = turnos.filter((t) => t.paciente_id === p.id);
    const turnosConsulta = suyos.filter((t) => t.concepto === "Consulta de ortodoncia").sort((a, b) => a.fecha.localeCompare(b.fecha));
    const turnosInstalacion = suyos.filter((t) => (t.concepto || "").startsWith("Instalación")).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const hayControl = suyos.some((t) => t.concepto === "Control" && t.fecha <= hoy && PRESENCIAS_QUE_VINO.includes(t.presencia));
    const cobroConsulta = cobros.find((c) => c.paciente_id === p.id);
    const vino = turnosConsulta.find((t) => t.fecha <= hoy && PRESENCIAS_QUE_VINO.includes(t.presencia));
    const porVenir = turnosConsulta.find((t) => t.fecha >= hoy);
    const pasado = turnosConsulta.filter((t) => t.fecha < hoy).pop();

    let situacion, fechaConsulta;
    if (vino || cobroConsulta) {
      situacion = SITUACION_CONSULTA.VINO;
      fechaConsulta = vino?.fecha || cobroConsulta.fecha;
    } else if (porVenir) {
      situacion = SITUACION_CONSULTA.AGENDADA;
      fechaConsulta = porVenir.fecha;
    } else if (pasado) {
      situacion = SITUACION_CONSULTA.SIN_MARCAR;
      fechaConsulta = pasado.fecha;
    } else {
      situacion = SITUACION_CONSULTA.CANCELO;
      fechaConsulta = null;
    }
    return {
      id: p.id,
      nombre: p.nombre,
      whatsapp: p.whatsapp,
      estadoFicha: p.estado_paciente,
      ortodoncista: p.ortodoncista?.nombre ?? "Sin asignar",
      situacion,
      fechaConsulta,
      diasDesdeConsulta: fechaConsulta && fechaConsulta <= hoy ? diasEntre(fechaConsulta, hoy) : null,
      instalacionAgendada: turnosInstalacion.find((t) => t.fecha >= hoy)?.fecha || null,
      // Ya tuvo un Control: en la práctica ya está en tratamiento aunque la ficha siga como "Consulta".
      yaEnTratamiento: hayControl || p.estado_paciente === "Activo",
    };
  });
  return { disponible: gestion.disponible, porPaciente: gestion.porPaciente, consultas };
}

export async function obtenerCantidadConsultasPorContactar() {
  const { consultas, porPaciente } = await obtenerConsultasOrtodoncia();
  return consultas.filter(
    (c) => c.estadoFicha === "Consulta" && !c.yaEnTratamiento && (porPaciente[c.id]?.estado || "Por contactar") === "Por contactar"
  ).length;
}

export function mensajeConsultaOrtodoncia(nombrePaciente, situacion) {
  const nombre = nombreCercano(nombrePaciente);
  if (situacion === SITUACION_CONSULTA.CANCELO || situacion === SITUACION_CONSULTA.AGENDADA) {
    return `¡Hola ${nombre}! Te escribimos desde Clínica Dental Marianela Ramírez. Vimos que quedó pendiente tu consulta de ortodoncia. ¿Querés que te agendemos una fecha? Decinos qué días y horarios te quedan mejor y lo coordinamos. ¡Gracias!`;
  }
  return `¡Hola ${nombre}! Te escribimos desde Clínica Dental Marianela Ramírez. Hace unos días viniste a la consulta de ortodoncia y queríamos saber qué te pareció y si querés que coordinemos el turno para la instalación. Cualquier duda que tengas, contanos. ¡Gracias!`;
}
