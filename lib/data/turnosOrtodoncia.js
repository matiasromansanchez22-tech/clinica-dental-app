import { supabase } from "@/lib/supabaseClient";

const SELECT_TURNO = `id, fecha, hora_inicio, duracion_min, consultorio, concepto, valor,
  estado, confirmacion, presencia, asistencia, observaciones,
  paciente_id, ortodoncista_id, whatsapp,
  paciente:pacientes_ortodoncia(nombre, whatsapp),
  ortodoncista:profesionales!ortodoncista_id(nombre)`;

function mapearFila(fila) {
  return {
    id: fila.id,
    fecha: fila.fecha,
    horaInicio: fila.hora_inicio.slice(0, 5),
    duracionMin: fila.duracion_min,
    consultorio: fila.consultorio,
    pacienteId: fila.paciente_id,
    paciente: fila.paciente?.nombre ?? "(sin paciente asignado)",
    whatsapp: fila.whatsapp || fila.paciente?.whatsapp || null,
    profesionalDeTurnoId: fila.ortodoncista_id,
    profesionalDeTurno: fila.ortodoncista?.nombre ?? "(sin asignar)",
    tipoAtencion: fila.concepto,
    concepto: fila.concepto,
    valor: fila.valor,
    estado: fila.estado,
    confirmacion: fila.confirmacion,
    presencia: fila.presencia,
    asistencia: fila.asistencia,
    observaciones: fila.observaciones,
  };
}

export async function obtenerTurnosOrtodonciaPorFecha(fecha) {
  const { data, error } = await supabase
    .from("turnos_ortodoncia")
    .select(SELECT_TURNO)
    .eq("fecha", fecha)
    .order("hora_inicio");
  if (error) throw error;
  return data.map(mapearFila);
}

export async function obtenerTurnosOrtodonciaPorRango(fechaInicio, fechaFin) {
  const { data, error } = await supabase
    .from("turnos_ortodoncia")
    .select(SELECT_TURNO)
    .gte("fecha", fechaInicio)
    .lte("fecha", fechaFin)
    .order("fecha")
    .order("hora_inicio");
  if (error) throw error;
  return data.map(mapearFila);
}

export async function crearTurnoOrtodoncia(turno) {
  const { data, error } = await supabase
    .from("turnos_ortodoncia")
    .insert({
      fecha: turno.fecha,
      hora_inicio: turno.horaInicio,
      duracion_min: turno.duracionMin,
      consultorio: turno.consultorio,
      paciente_id: turno.pacienteId,
      whatsapp: turno.whatsapp || null,
      ortodoncista_id: turno.profesionalDeTurnoId,
      concepto: turno.concepto,
      valor: turno.valor || null,
      observaciones: turno.observaciones || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Antes de devolver la lista, revisa solo: si el paciente ya tiene otro
// turno agendado de verdad (armado desde la Agenda), quiere decir que ya
// se lo reprogramó — se lo saca de acá solo, sin que nadie tenga que
// acordarse de apretar ningún botón.
export async function obtenerTurnosOrtodonciaAReprogramar() {
  const { data, error } = await supabase
    .from("turnos_ortodoncia")
    .select(
      `id, fecha, hora_inicio, consultorio, concepto, whatsapp, paciente_id,
       paciente:pacientes_ortodoncia(nombre, whatsapp),
       ortodoncista:profesionales!ortodoncista_id(nombre)`
    )
    .eq("estado", "Reprogramado")
    .order("fecha", { ascending: false });

  if (error) throw error;

  const pacienteIds = [...new Set(data.map((t) => t.paciente_id).filter(Boolean))];
  const yaReprogramados = new Set();
  if (pacienteIds.length > 0) {
    const { data: nuevos, error: errorNuevos } = await supabase
      .from("turnos_ortodoncia")
      .select("paciente_id")
      .in("paciente_id", pacienteIds)
      .in("estado", ["Pendiente", "Agendado"]);
    if (errorNuevos) throw errorNuevos;
    nuevos.forEach((n) => yaReprogramados.add(n.paciente_id));
  }

  const pendientes = [];
  const idsParaResolverSolos = [];
  for (const t of data) {
    if (t.paciente_id && yaReprogramados.has(t.paciente_id)) {
      idsParaResolverSolos.push(t.id);
    } else {
      pendientes.push(t);
    }
  }

  if (idsParaResolverSolos.length > 0) {
    await supabase.from("turnos_ortodoncia").update({ estado: "Cancelado" }).in("id", idsParaResolverSolos);
  }

  return pendientes.map((f) => ({
    id: f.id,
    fecha: f.fecha,
    horaInicio: f.hora_inicio.slice(0, 5),
    consultorio: f.consultorio,
    concepto: f.concepto,
    paciente: f.paciente?.nombre ?? "(sin paciente asignado)",
    whatsapp: f.whatsapp || f.paciente?.whatsapp || "—",
    profesionalDeTurno: f.ortodoncista?.nombre ?? "(sin asignar)",
  }));
}

// Para el puntito rojo del menú — reusa la misma función de arriba (así
// también se autolimpia) y solo devuelve cuántos quedan pendientes.
export async function obtenerCantidadTurnosOrtodonciaAReprogramar() {
  const turnos = await obtenerTurnosOrtodonciaAReprogramar();
  return turnos.length;
}

export async function actualizarEstadoTurnoOrtodoncia(id, cambios) {
  const { data, error } = await supabase
    .from("turnos_ortodoncia")
    .update({ ...cambios, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(SELECT_TURNO)
    .single();
  if (error) throw error;
  return mapearFila(data);
}
