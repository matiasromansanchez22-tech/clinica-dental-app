// Resumen de fin de jornada (mañana o tarde): cuántos pacientes vinieron y cuántos quedaron sin marcar QUÉ SE HIZO y QUÉ SIGUE (la próxima
// prestación o el próximo turno), de Odontología General y de Ortodoncia, por profesional. Recibe el cliente de Supabase, así corre tanto
// en el navegador (pantalla y cartel) como en el servidor (aviso automático).
//
// Reglas (las mismas que Pendientes de registro):
//  - Un turno cuenta como "vino" si sigue agendado, no figura "No asistió", tiene paciente y profesional, y ya empezó.
//  - "Qué se hizo" está cargado si el turno tiene al menos una prestación en prestaciones_realizadas_agenda (en Ortodoncia, una visita
//    que la secretaria cobró y la profesional todavía tiene que completar —por_completar— NO cuenta como cargada).
//  - "Qué sigue" está cargado si alguna de esas prestaciones indica la próxima prestación, una nota para el próximo turno o el alta.
//  - La mañana son los turnos que empiezan antes de las 13:00; la tarde, desde las 13:00.

export const CORTE_TARDE = "13:00";
export const JORNADAS = {
  manana: { clave: "manana", texto: "mañana", titulo: "Cierre de la mañana" },
  tarde: { clave: "tarde", texto: "tarde", titulo: "Cierre de la tarde" },
};

const hh = (t) => String(t || "").slice(0, 5);

// El aviso y el cartel de fin de jornada son solo para Matías (una Dueña cuyo nombre empieza con "Matías").
const sinTildes = (t) => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
export const esDestinatarioDelResumen = (perfil) => perfil?.rol === "Duena" && sinTildes(perfil?.nombre).startsWith("matias");
const enJornada = (hora, jornada) => (jornada === "manana" ? hh(hora) < CORTE_TARDE : hh(hora) >= CORTE_TARDE);

// Qué jornada es "ahora" (según la hora) para mostrar por defecto.
export const jornadaDeAhora = (ahora) => (hh(ahora) < CORTE_TARDE ? "manana" : "tarde");

async function leerTodo(consulta, pagina = 1000) {
  const filas = [];
  for (let d = 0; ; d += pagina) {
    const { data, error } = await consulta().range(d, d + pagina - 1);
    if (error) throw error;
    filas.push(...data);
    if (data.length < pagina) break;
  }
  return filas;
}

async function registrosPorTurno(cliente, columnaTurno, ids, esOrto) {
  const mapa = new Map(); // turnoId -> { cargado, sigue }
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await cliente
      .from("prestaciones_realizadas_agenda")
      .select(`${columnaTurno}, proxima_prestacion_nombre, nota_proximo_turno, alta, por_completar`)
      .in(columnaTurno, ids.slice(i, i + 200));
    if (error) throw error;
    for (const f of data) {
      const e = mapa.get(f[columnaTurno]) || { cargado: false, sigue: false };
      // En Ortodoncia, una visita "por completar" todavía no está cargada por la profesional.
      if (!(esOrto && f.por_completar)) {
        e.cargado = true;
        if (f.proxima_prestacion_nombre || f.nota_proximo_turno || f.alta) e.sigue = true;
      }
      mapa.set(f[columnaTurno], e);
    }
  }
  return mapa;
}

//   devuelve { fecha, jornada, total: { agendados, vinieron, sinQueSeHizo, sinQueSigue, porVenir },
//              porProfesional: [{ profesionalId, nombre, area, agendados, vinieron, cargados, sinQueSeHizo, sinQueSigue,
//                                 pacientes: [{ hora, paciente, falta: ["qué se hizo" | "qué sigue"] }] }] }
export async function calcularResumenJornada(cliente, { fecha, jornada, hoy, ahora }) {
  const [general, orto] = await Promise.all([
    leerTodo(() =>
      cliente
        .from("turnos_general")
        .select("id, hora_inicio, estado, confirmacion, asistencia, paciente_id, profesional_de_turno_id, paciente:pacientes(apellido_y_nombre), profesional:profesionales!profesional_de_turno_id(nombre)")
        .eq("fecha", fecha)
        .order("hora_inicio")
        .order("id")
    ),
    leerTodo(() =>
      cliente
        .from("turnos_ortodoncia")
        .select("id, hora_inicio, estado, confirmacion, asistencia, sobreturno, paciente_id, ortodoncista_id, paciente:pacientes_ortodoncia(nombre), profesional:profesionales!ortodoncista_id(nombre)")
        .eq("fecha", fecha)
        .order("hora_inicio")
        .order("id")
    ),
  ]);

  const normalizar = (t, area) => ({
    id: t.id,
    area,
    hora: hh(t.hora_inicio),
    estado: t.estado,
    confirmacion: t.confirmacion,
    asistencia: t.asistencia,
    pacienteId: t.paciente_id,
    paciente: (area === "General" ? t.paciente?.apellido_y_nombre : t.paciente?.nombre)?.trim() || "(sin paciente)",
    profesionalId: area === "General" ? t.profesional_de_turno_id : t.ortodoncista_id,
    profesional: t.profesional?.nombre || "(sin asignar)",
  });
  const turnos = [...general.map((t) => normalizar(t, "General")), ...orto.filter((t) => !t.sobreturno).map((t) => normalizar(t, "Ortodoncia"))].filter((t) => enJornada(t.hora, jornada));
  const agendados = turnos.filter((t) => t.estado === "Agendado" && t.confirmacion !== "Reprogramar");
  const yaEmpezo = (t) => fecha < hoy || (fecha === hoy && t.hora <= ahora);
  const vinieron = agendados.filter((t) => t.asistencia !== "No asistió" && t.pacienteId && t.profesionalId && yaEmpezo(t));

  const idsG = vinieron.filter((t) => t.area === "General").map((t) => t.id);
  const idsO = vinieron.filter((t) => t.area === "Ortodoncia").map((t) => t.id);
  const [regG, regO] = await Promise.all([registrosPorTurno(cliente, "turno_general_id", idsG, false), registrosPorTurno(cliente, "turno_ortodoncia_id", idsO, true)]);

  const mapa = new Map();
  const entrada = (t) => {
    const clave = `${t.area}|${t.profesionalId || "sin"}`;
    if (!mapa.has(clave)) mapa.set(clave, { profesionalId: t.profesionalId, nombre: t.profesional, area: t.area, agendados: 0, vinieron: 0, cargados: 0, sinQueSeHizo: 0, sinQueSigue: 0, pacientes: [] });
    return mapa.get(clave);
  };
  for (const t of agendados) entrada(t).agendados += 1;
  for (const t of vinieron) {
    const e = entrada(t);
    const r = (t.area === "General" ? regG : regO).get(t.id) || { cargado: false, sigue: false };
    e.vinieron += 1;
    const falta = [];
    if (!r.cargado) {
      e.sinQueSeHizo += 1;
      falta.push("qué se hizo");
    } else e.cargados += 1;
    if (!r.sigue) {
      e.sinQueSigue += 1;
      falta.push("qué sigue");
    }
    if (falta.length) e.pacientes.push({ hora: t.hora, paciente: t.paciente, falta });
  }
  const porProfesional = [...mapa.values()].sort((a, b) => b.sinQueSeHizo + b.sinQueSigue - (a.sinQueSeHizo + a.sinQueSigue) || a.nombre.localeCompare(b.nombre));
  const suma = (campo) => porProfesional.reduce((s, p) => s + p[campo], 0);
  return {
    fecha,
    jornada,
    total: {
      agendados: agendados.length,
      vinieron: vinieron.length,
      porVenir: agendados.filter((t) => !yaEmpezo(t)).length,
      sinQueSeHizo: suma("sinQueSeHizo"),
      sinQueSigue: suma("sinQueSigue"),
      pacientesPendientes: porProfesional.reduce((n, p) => n + p.pacientes.length, 0),
    },
    porProfesional,
  };
}

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
export function textoDeFecha(fechaISO) {
  const [a, m, d] = fechaISO.split("-").map(Number);
  return `${DIAS[new Date(a, m - 1, d).getDay()]} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

const primerNombre = (n) => String(n || "").split(" ")[0];

// Texto corto del resumen completo (para el aviso al celular o para copiar y pegar).
export function textoResumen(r) {
  const j = JORNADAS[r.jornada];
  const t = r.total;
  const lineas = [`${j.titulo} · ${textoDeFecha(r.fecha)}`, `Vinieron ${t.vinieron} de ${t.agendados} agendados${t.porVenir ? ` (${t.porVenir} todavía por atender)` : ""}.`];
  if (t.pacientesPendientes === 0) lineas.push("✅ Todo cargado: qué se hizo y qué sigue.");
  else {
    lineas.push(`Pacientes sin cargar: ${t.pacientesPendientes} (sin "qué se hizo": ${t.sinQueSeHizo} · sin "qué sigue": ${t.sinQueSigue}).`);
    const quienes = r.porProfesional.filter((p) => p.pacientes.length > 0).map((p) => `${primerNombre(p.nombre)}${p.area === "Ortodoncia" ? " (orto)" : ""} ${p.pacientes.length}`);
    lineas.push(quienes.join(" · "));
  }
  return lineas.join("\n");
}

// Texto del aviso a UN profesional con sus pacientes pendientes.
export function textoParaProfesional(p, r) {
  const j = JORNADAS[r.jornada];
  const pend = p.pacientes;
  const lista = pend.slice(0, 4).map((x) => `${x.hora} ${x.paciente}`).join(" · ");
  return {
    titulo: `📝 ${j.titulo}: te faltan ${pend.length} paciente${pend.length === 1 ? "" : "s"}`,
    mensaje: `Vinieron ${p.vinieron}. Falta marcar qué se hizo (${p.sinQueSeHizo}) y qué sigue (${p.sinQueSigue}). ${lista}${pend.length > 4 ? " …" : ""}`,
  };
}
