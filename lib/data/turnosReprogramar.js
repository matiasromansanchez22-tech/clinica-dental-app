import { supabase } from "@/lib/supabaseClient";

// Doc 3.1: reporte de turnos marcados para reprogramar, con el celular del
// paciente y el turno original, para hacerles seguimiento telefónico.
//
// Antes de devolver la lista, revisa solo: si el paciente ya tiene otro
// turno agendado de verdad (armado desde la Agenda), quiere decir que ya
// se lo reprogramó — se lo saca de acá solo, sin que nadie tenga que
// acordarse de apretar ningún botón.
export async function obtenerTurnosAReprogramar() {
  const { data, error } = await supabase
    .from("turnos_general")
    .select(
      `id, fecha, hora_inicio, consultorio, tipo_atencion, paciente_id,
       paciente:pacientes(apellido_y_nombre, celular),
       profesional_de_turno:profesionales!profesional_de_turno_id(nombre)`
    )
    .eq("estado", "Reprogramado")
    .order("fecha", { ascending: false });

  if (error) throw error;

  const pacienteIds = [...new Set(data.map((t) => t.paciente_id).filter(Boolean))];
  const yaReprogramados = new Set();
  if (pacienteIds.length > 0) {
    const { data: nuevos, error: errorNuevos } = await supabase
      .from("turnos_general")
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
    await supabase.from("turnos_general").update({ estado: "Cancelado" }).in("id", idsParaResolverSolos);
  }

  return pendientes.map((f) => ({
    id: f.id,
    fecha: f.fecha,
    horaInicio: f.hora_inicio.slice(0, 5),
    consultorio: f.consultorio,
    tipoAtencion: f.tipo_atencion,
    paciente: f.paciente?.apellido_y_nombre ?? "—",
    celular: f.paciente?.celular ?? "—",
    profesionalDeTurno: f.profesional_de_turno?.nombre ?? "—",
  }));
}

// Para el puntito rojo del menú — reusa la misma función de arriba (así
// también se autolimpia) y solo devuelve cuántos quedan pendientes.
export async function obtenerCantidadTurnosAReprogramar() {
  const turnos = await obtenerTurnosAReprogramar();
  return turnos.length;
}
