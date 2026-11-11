// Cuánto del "qué se hizo" de la Agenda está cargado, por profesional. Se usa en la pantalla Pendientes de registro (cumplimiento),
// en el cartel de inicio de cada odontólogo y en los avisos automáticos (cron). Recibe el cliente de Supabase para poder correr
// tanto en el navegador como en el servidor.
//
// Un turno cuenta como "vino" con la misma regla que Pendientes de registro: sigue agendado, no figura "No asistió", tiene
// paciente y profesional, y ya pasó (los de hoy, cuando ya pasó su horario). Está "cargado" si tiene al menos una prestación en
// prestaciones_realizadas_agenda atada a ese turno.

const PAGINA = 1000;

export function horaYFechaEnArgentina() {
  const ahora = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  return { hoy: ahora.slice(0, 10), ahora: ahora.slice(11, 16) };
}

export function sumarDiasISO(fechaISO, dias) {
  const f = new Date(`${fechaISO}T12:00:00Z`);
  f.setUTCDate(f.getUTCDate() + dias);
  return f.toISOString().slice(0, 10);
}

//   devuelve { porProfesional: [{ id, nombre, vinieron, cargados, sinCargar, porcentaje }] (de menos a más cumplimiento),
//              pendientes: [{ id, fecha, hora, paciente, profesionalId, profesional }] (los más viejos primero),
//              vinieron, cargados, sinCargar, porcentaje }
export async function calcularCumplimientoRegistro(cliente, { desde, hasta, hoy, ahora }) {
  const turnos = [];
  for (let d = 0; ; d += PAGINA) {
    const { data, error } = await cliente
      .from("turnos_general")
      .select(
        "id, fecha, hora_inicio, estado, asistencia, paciente_id, profesional_de_turno_id, paciente:pacientes(apellido_y_nombre), profesional:profesionales!profesional_de_turno_id(nombre)"
      )
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha")
      .order("hora_inicio")
      .range(d, d + PAGINA - 1);
    if (error) throw error;
    turnos.push(...data);
    if (data.length < PAGINA) break;
  }

  const vinieron = turnos.filter(
    (t) =>
      t.estado === "Agendado" &&
      t.asistencia !== "No asistió" &&
      t.paciente_id &&
      t.profesional_de_turno_id &&
      (t.fecha < hoy || (t.fecha === hoy && String(t.hora_inicio).slice(0, 5) <= ahora))
  );

  const cargados = new Set();
  const ids = vinieron.map((t) => t.id);
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await cliente.from("prestaciones_realizadas_agenda").select("turno_general_id").in("turno_general_id", ids.slice(i, i + 200));
    if (error) throw error;
    for (const f of data) cargados.add(f.turno_general_id);
  }

  const mapa = new Map();
  const pendientes = [];
  for (const t of vinieron) {
    const e = mapa.get(t.profesional_de_turno_id) || { id: t.profesional_de_turno_id, nombre: t.profesional?.nombre || "(sin nombre)", vinieron: 0, cargados: 0 };
    e.vinieron += 1;
    if (cargados.has(t.id)) e.cargados += 1;
    else
      pendientes.push({
        id: t.id,
        fecha: t.fecha,
        hora: String(t.hora_inicio).slice(0, 5),
        paciente: t.paciente?.apellido_y_nombre?.trim() || "(sin paciente)",
        profesionalId: t.profesional_de_turno_id,
        profesional: e.nombre,
      });
    mapa.set(t.profesional_de_turno_id, e);
  }
  const porProfesional = [...mapa.values()]
    .map((e) => ({ ...e, sinCargar: e.vinieron - e.cargados, porcentaje: e.vinieron ? Math.round((e.cargados / e.vinieron) * 100) : 100 }))
    .sort((a, b) => a.porcentaje - b.porcentaje || b.sinCargar - a.sinCargar);
  const total = vinieron.length;
  return {
    porProfesional,
    pendientes,
    vinieron: total,
    cargados: total - pendientes.length,
    sinCargar: pendientes.length,
    porcentaje: total ? Math.round(((total - pendientes.length) / total) * 100) : 100,
  };
}

export function textoFechaCorta(fechaISO) {
  const [, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}`;
}
