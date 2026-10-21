import { supabase } from "@/lib/supabaseClient";
import { conMarcaDeConsentimiento } from "@/lib/data/consentimientos";

const SELECT_TURNO = `id, fecha, hora_inicio, duracion_min, consultorio, concepto, valor,
  estado, confirmacion, presencia, asistencia, observaciones, motivo,
  paciente_id, ortodoncista_id, whatsapp, prioridad, ortodoncista_habitual_id, motivo_prioridad, tipo_otro_ortodoncista, sobreturno,
  paciente:pacientes_ortodoncia(nombre, whatsapp),
  ortodoncista:profesionales!ortodoncista_id(nombre),
  habitual:profesionales!ortodoncista_habitual_id(nombre)`;

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
    motivo: fila.motivo,
    // Prioridad: el paciente es de otra ortodoncista (la habitual) y este turno lo atiende quien figura
    // como ortodoncista del turno. Reusa "profesionalResponsable" para que la agenda lo muestre.
    prioridad: Boolean(fila.prioridad),
    ortodoncistaHabitualId: fila.ortodoncista_habitual_id,
    ortodoncistaHabitual: fila.habitual?.nombre ?? null,
    motivoPrioridad: fila.motivo_prioridad,
    // Prioridad / Sobreturno / Cobertura: qué tipo de turno es cuando lo atiende una ortodoncista distinta a la de la ficha.
    tipoOtroOrtodoncista: fila.tipo_otro_ortodoncista ?? null,
    // Sobreturno encimado: se agendó encima de otro turno por si se libera; se muestra aparte en la agenda.
    sobreturno: Boolean(fila.sobreturno),
    profesionalResponsable: fila.prioridad ? fila.habitual?.nombre ?? null : null,
  };
}

export async function obtenerTurnosOrtodonciaPorFecha(fecha) {
  const { data, error } = await supabase
    .from("turnos_ortodoncia")
    .select(SELECT_TURNO)
    .eq("fecha", fecha)
    .order("hora_inicio");
  if (error) throw error;
  return conMarcaDeConsentimiento("ortodoncia", data.map(mapearFila));
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
  return conMarcaDeConsentimiento("ortodoncia", data.map(mapearFila));
}

// Todos los turnos de un paciente (pasados y futuros) — para poder
// contestar "¿cuándo tenía turno?" sin tener que ir día por día en la
// agenda. Más recientes primero.
export async function obtenerTurnosOrtodonciaPorPaciente(pacienteId) {
  const { data, error } = await supabase
    .from("turnos_ortodoncia")
    .select(SELECT_TURNO)
    .eq("paciente_id", pacienteId)
    .order("fecha", { ascending: false })
    .order("hora_inicio", { ascending: false });
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
      ...(turno.sobreturno ? { sobreturno: true } : {}),
      ...(turno.tipoOtroOrtodoncista
        ? {
            tipo_otro_ortodoncista: turno.tipoOtroOrtodoncista,
            prioridad: turno.tipoOtroOrtodoncista !== "Cobertura",
            ortodoncista_habitual_id: turno.ortodoncistaHabitualId || null,
            motivo_prioridad: turno.motivoPrioridad || null,
          }
        : {}),
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
      `id, fecha, hora_inicio, consultorio, concepto, whatsapp, paciente_id, motivo,
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
    motivo: f.motivo,
  }));
}

// Para el puntito rojo del menú — reusa la misma función de arriba (así
// también se autolimpia) y solo devuelve cuántos quedan pendientes.
export async function obtenerCantidadTurnosOrtodonciaAReprogramar() {
  const turnos = await obtenerTurnosOrtodonciaAReprogramar();
  return turnos.length;
}

// Corregir el concepto de un turno ya agendado (por ejemplo, se cargó como Control y en realidad es una consulta).
// Además acomoda el estado del paciente cuando corresponde: un paciente nuevo que todavía no empezó el tratamiento
// y no pagó nada pasa a "Consulta"; si el turno pasa a ser una instalación, un paciente en "Consulta" pasa a "Activo".
export async function cambiarConceptoTurnoOrtodoncia(turno, nuevoConcepto) {
  const actualizado = await actualizarEstadoTurnoOrtodoncia(turno.id, { concepto: nuevoConcepto });
  if (turno.pacienteId) {
    const { data: ficha } = await supabase.from("pacientes_ortodoncia").select("estado_paciente, fecha_instalacion").eq("id", turno.pacienteId).single();
    if (ficha) {
      const ahora = new Date().toISOString();
      if (nuevoConcepto === "Consulta de ortodoncia" && ficha.estado_paciente === "Activo" && !ficha.fecha_instalacion) {
        const { count } = await supabase.from("caja_ortodoncia").select("id", { count: "exact", head: true }).eq("paciente_id", turno.pacienteId);
        if (!count) await supabase.from("pacientes_ortodoncia").update({ estado_paciente: "Consulta", updated_at: ahora }).eq("id", turno.pacienteId);
      } else if ((nuevoConcepto === "Instalación superior" || nuevoConcepto === "Instalación inferior") && ficha.estado_paciente === "Consulta") {
        await supabase.from("pacientes_ortodoncia").update({ estado_paciente: "Activo", fecha_instalacion: turno.fecha || null, updated_at: ahora }).eq("id", turno.pacienteId);
      }
    }
  }
  return actualizado;
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
