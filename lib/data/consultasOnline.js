import { supabase } from "@/lib/supabaseClient";
import { hayConflictoDeHorario, seMuestraEnGrilla } from "@/lib/agenda";
import { crearPacienteOrtodoncia } from "@/lib/data/pacientesOrtodoncia";
import { obtenerDuracionesOrtodoncia } from "@/lib/data/duracionOrtodoncia";
import { ORIGEN_CONTINUACION } from "@/lib/ortodoncia";
import { crearTurnoOrtodoncia, obtenerTurnosOrtodonciaPorRango } from "@/lib/data/turnosOrtodoncia";
import { CLAVE_PROMO_CONSULTA, consultaBonificadaEl, promoConsultaHasta } from "@/lib/promoConsulta";

// Pedidos de turno que llegan desde la página pública /ortodoncia-info, horarios que se ofrecen en esa página y preguntas que le
// hace la gente al asistente. Lo usan Recepción (pedidos) y las Dueñas (todo).

const SELECT_PEDIDO = "id, created_at, nombre, whatsapp, fecha, hora_inicio, duracion_min, profesional_id, consultorio, estado, lugar, turno_id, paciente_id, nota, gestionada_en, profesional:profesionales!profesional_id(nombre)";

export const TIPOS_PEDIDO = ["Consulta", "Control", "Continuación"];

export async function obtenerPedidosDeTurno() {
  const pedir = (columnas) => supabase.from("solicitudes_turno_ortodoncia").select(columnas).order("fecha", { ascending: true }).order("hora_inicio", { ascending: true });
  // "tipo" y "dni" existen desde la migración 203; si todavía no se corrió, todos los pedidos cuentan como consulta.
  let { data, error } = await pedir(`${SELECT_PEDIDO}, tipo, dni`);
  if (error && /tipo|dni|column|schema cache/i.test(error.message || "")) ({ data, error } = await pedir(SELECT_PEDIDO));
  if (error) throw error;
  return data.map((f) => ({ tipo: "Consulta", dni: null, ...f, hora: String(f.hora_inicio).slice(0, 5), profesionalNombre: f.profesional?.nombre || "—" }));
}

// Hasta qué día la consulta está bonificada (promoción), o null. Se lee de la configuración de Ortodoncia.
export async function obtenerPromoConsultaHasta() {
  const { data } = await supabase.from("configuracion_ortodoncia").select("valor").eq("clave", CLAVE_PROMO_CONSULTA).maybeSingle();
  return promoConsultaHasta(data?.valor);
}

// Cuántos pedidos esperan respuesta (para el numerito del menú). Si la tabla todavía no existe devuelve 0.
export async function obtenerCantidadPedidosPendientes() {
  const { count, error } = await supabase.from("solicitudes_turno_ortodoncia").select("id", { count: "exact", head: true }).eq("estado", "Pendiente");
  return error ? 0 : count || 0;
}

// El número como lo guarda la ficha de paciente: sin el 549 de adelante (341 5551234 → 3415551234).
const numeroNacional = (whatsapp) => (String(whatsapp).startsWith("549") ? String(whatsapp).slice(3) : String(whatsapp));

// Qué turno se crea en la Agenda según lo que pidió la persona. La continuación (viene de otra clínica) entra como un control.
export function conceptoDePedido(tipo) {
  return tipo === "Control" || tipo === "Continuación" ? "Control" : "Consulta de ortodoncia";
}

// Agenda el pedido: busca la ficha del paciente por su WhatsApp y crea el turno en la Agenda (consulta, control o continuación).
//  - Consulta: si no hay ficha, crea una nueva en estado "Consulta".
//  - Continuación: si no hay ficha, crea una nueva marcada como "Continuación de otra clínica".
//  - Control: tiene que ser un paciente que ya existe; si no se lo encuentra por el WhatsApp, avisa (con el DNI que escribió) para buscarlo a mano.
// Si el horario ya lo ocupó otro turno, avisa y no hace nada.
export async function agendarPedido(pedido) {
  const tipo = pedido.tipo || "Consulta";
  const concepto = conceptoDePedido(tipo);
  let duracionMin = pedido.duracion_min;
  try {
    const duraciones = await obtenerDuracionesOrtodoncia();
    if (duraciones[concepto]) duracionMin = duraciones[concepto];
  } catch {
    // se usa la duración del pedido
  }

  const turnos = await obtenerTurnosOrtodonciaPorRango(pedido.fecha, pedido.fecha);
  const conflicto = hayConflictoDeHorario({
    turnosVisibles: turnos.filter(seMuestraEnGrilla),
    consultorio: pedido.consultorio,
    profesionalDeTurnoId: pedido.profesional_id,
    horaInicio: pedido.hora,
    duracionMin,
  });
  if (conflicto) throw new Error("Ese horario ya está ocupado en la Agenda. Rechazá el pedido y coordiná otro horario por WhatsApp.");

  const nacional = numeroNacional(pedido.whatsapp);
  const ultimos = nacional.slice(-8);
  const { data: existentes, error: errorBusqueda } = await supabase.from("pacientes_ortodoncia").select("id, nombre").ilike("whatsapp", `%${ultimos}`).limit(1);
  if (errorBusqueda) throw errorBusqueda;
  let pacienteId = existentes?.[0]?.id;
  if (!pacienteId) {
    if (tipo === "Control") {
      throw new Error(
        `No encontramos una ficha de ortodoncia con ese WhatsApp${pedido.dni ? ` (documento que escribió: ${pedido.dni})` : ""}. Buscala por nombre en Pacientes de Ortodoncia, agendale el control desde la Agenda y después dá de baja este pedido.`
      );
    }
    const nuevo = await crearPacienteOrtodoncia({
      nombre: pedido.nombre,
      whatsapp: nacional,
      ortodoncistaId: pedido.profesional_id,
      estadoPaciente: "Consulta",
      ...(tipo === "Continuación" ? { origenPaciente: ORIGEN_CONTINUACION } : {}),
    });
    pacienteId = nuevo.id;
  }

  const turno = await crearTurnoOrtodoncia({
    fecha: pedido.fecha,
    horaInicio: pedido.hora,
    duracionMin,
    consultorio: pedido.consultorio,
    pacienteId,
    whatsapp: nacional,
    profesionalDeTurnoId: pedido.profesional_id,
    concepto,
    observaciones: `Pidió turno desde la página web${pedido.lugar ? ` (${pedido.lugar})` : ""}${tipo === "Continuación" ? " para continuar su tratamiento de otra clínica" : tipo === "Control" ? " para un control" : ""}${
      pedido.dni ? `. DNI ${pedido.dni}` : ""
    }. Falta confirmar por WhatsApp.${tipo === "Consulta" && consultaBonificadaEl(pedido.fecha, await obtenerPromoConsultaHasta()) ? " Consulta bonificada (promoción)." : ""}`,
  });

  const { error } = await supabase
    .from("solicitudes_turno_ortodoncia")
    .update({ estado: "Agendada", turno_id: turno.id, paciente_id: pacienteId, gestionada_en: new Date().toISOString() })
    .eq("id", pedido.id);
  if (error) throw error;
  return { turnoId: turno.id, pacienteId, ficha: existentes?.[0]?.nombre || null };
}

export async function cambiarEstadoPedido(id, estado, nota) {
  const { error } = await supabase
    .from("solicitudes_turno_ortodoncia")
    .update({ estado, nota: nota || null, gestionada_en: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// ---------- Horarios que se ofrecen en la página ----------

export async function obtenerHorariosPublicos() {
  const { data, error } = await supabase
    .from("consulta_publica_horarios")
    .select("id, profesional_id, dia_semana, hora_inicio, hora_fin, consultorio, activo, profesional:profesionales!profesional_id(nombre)")
    .order("dia_semana")
    .order("hora_inicio");
  if (error) throw error;
  return data.map((f) => ({ ...f, desde: String(f.hora_inicio).slice(0, 5), hasta: String(f.hora_fin).slice(0, 5), profesionalNombre: f.profesional?.nombre || "—" }));
}

export async function crearHorarioPublico({ profesionalId, diaSemana, desde, hasta, consultorio }) {
  const { error } = await supabase
    .from("consulta_publica_horarios")
    .insert({ profesional_id: profesionalId, dia_semana: Number(diaSemana), hora_inicio: desde, hora_fin: hasta, consultorio: Number(consultorio) });
  if (error) throw error;
}

export async function cambiarActivoHorarioPublico(id, activo) {
  const { error } = await supabase.from("consulta_publica_horarios").update({ activo }).eq("id", id);
  if (error) throw error;
}

export async function eliminarHorarioPublico(id) {
  const { error } = await supabase.from("consulta_publica_horarios").delete().eq("id", id);
  if (error) throw error;
}

// Copia los bloques de la disponibilidad semanal de la Agenda de un profesional (consultorios 2 y 3) para no cargarlos uno por uno.
export async function importarDisponibilidadAgenda(profesionalId) {
  const { data, error } = await supabase
    .from("disponibilidad_profesional")
    .select("dia_semana, hora_inicio, hora_fin, consultorio")
    .eq("profesional_id", profesionalId)
    .eq("activo", true)
    .in("consultorio", [2, 3]);
  if (error) throw error;
  if (!data.length) throw new Error("Ese profesional no tiene disponibilidad cargada en la Agenda para los consultorios 2 y 3.");
  const { error: e2 } = await supabase
    .from("consulta_publica_horarios")
    .insert(data.map((b) => ({ profesional_id: profesionalId, dia_semana: b.dia_semana, hora_inicio: b.hora_inicio, hora_fin: b.hora_fin, consultorio: b.consultorio })));
  if (e2) throw e2;
  return data.length;
}

// ---------- Lo que pregunta la gente al asistente ----------

export async function obtenerPreguntasAlAsistente(limite = 80) {
  const { data, error } = await supabase.from("chat_publico_log").select("id, created_at, pregunta, respuesta").order("created_at", { ascending: false }).limit(limite);
  if (error) throw error;
  return data;
}
