import { supabase } from "@/lib/supabaseClient";

function rangoDelMes(anio, mes) {
  const desde = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const ultimoDia = new Date(anio, mes, 0).getDate();
  const hasta = `${anio}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
  return { desde, hasta };
}

// Turnos de Sistema General que quedaron con estado "Cancelado" — a
// diferencia de "a reprogramar", esto es solo un registro histórico (no
// se autolimpia ni requiere acción), por eso se filtra por mes para no
// terminar cargando años de turnos cancelados de una sola vez.
export async function obtenerTurnosCanceladosGeneral(anio, mes) {
  const { desde, hasta } = rangoDelMes(anio, mes);
  const { data, error } = await supabase
    .from("turnos_general")
    .select(
      `id, fecha, hora_inicio, consultorio, tipo_atencion, paciente_id, motivo, updated_at,
       paciente:pacientes(apellido_y_nombre, celular),
       profesional_de_turno:profesionales!profesional_de_turno_id(nombre)`
    )
    .eq("estado", "Cancelado")
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .order("fecha", { ascending: false });
  if (error) throw error;

  return data.map((f) => ({
    id: f.id,
    fecha: f.fecha,
    horaInicio: f.hora_inicio.slice(0, 5),
    consultorio: f.consultorio,
    tipoAtencion: f.tipo_atencion,
    paciente: f.paciente?.apellido_y_nombre ?? "—",
    celular: f.paciente?.celular ?? "—",
    profesionalDeTurno: f.profesional_de_turno?.nombre ?? "—",
    motivo: f.motivo,
  }));
}

// Igual que arriba, para Ortodoncia.
export async function obtenerTurnosCanceladosOrtodoncia(anio, mes) {
  const { desde, hasta } = rangoDelMes(anio, mes);
  const { data, error } = await supabase
    .from("turnos_ortodoncia")
    .select(
      `id, fecha, hora_inicio, consultorio, concepto, whatsapp, paciente_id, motivo, updated_at,
       paciente:pacientes_ortodoncia(nombre, whatsapp),
       ortodoncista:profesionales!ortodoncista_id(nombre)`
    )
    .eq("estado", "Cancelado")
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .order("fecha", { ascending: false });
  if (error) throw error;

  return data.map((f) => ({
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
