import { supabase } from "@/lib/supabaseClient";
import { calcularTotalesDelDia } from "@/lib/data/cierres";
import { calcularTotalesDelDiaOrtodoncia } from "@/lib/data/cierresTurnoOrtodoncia";
import { obtenerBalanceMensual } from "@/lib/data/balance";
import { obtenerIdsPacientesConActividad } from "@/lib/data/pacientes";
import { obtenerIdsPacientesConHistoricoPrevio } from "@/lib/data/registroPacientes";

function rangoDelDia(fecha) {
  return { desde: `${fecha}T00:00:00`, hasta: `${fecha}T23:59:59.999` };
}

function rangoDelMes(anio, mes) {
  const inicio = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const ultimoDia = new Date(anio, mes, 0).getDate();
  const fin = `${anio}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
  return { fechaInicio: inicio, fechaFin: fin, desde: `${inicio}T00:00:00`, hasta: `${fin}T23:59:59.999` };
}

async function contarPorFecha(tabla, columnaFecha, desde, hasta) {
  const { count, error } = await supabase
    .from(tabla)
    .select("id", { count: "exact", head: true })
    .gte(columnaFecha, desde)
    .lte(columnaFecha, hasta);
  if (error) throw error;
  return count || 0;
}

async function contarTurnosAtendidos(tabla, fecha, columna, valor) {
  const { count, error } = await supabase
    .from(tabla)
    .select("id", { count: "exact", head: true })
    .eq("fecha", fecha)
    .eq(columna, valor);
  if (error) throw error;
  return count || 0;
}

// La fecha del primer turno de cada paciente de Odontología General (no
// cancelado ni reprogramado, y ya pasado) — a diferencia de la fecha de
// alta del paciente, esto refleja cuándo vino de verdad por primera vez a
// consultarnos, sin importar si el registro del paciente ya existía de
// antes (por ejemplo, los que se cargaron en la migración inicial a la
// app). Ojo: para un paciente que ya venía de antes de usar la app y
// recién ahora se le carga un turno de control, esto lo cuenta como si
// fuera su primera consulta — es la mejor señal disponible en General,
// porque "tipo de atención" no es confiable (queda "Consulta" por
// defecto en casi todos los turnos, se cargue lo que se cargue).
async function obtenerPrimerTurnoPorPaciente(tabla) {
  const hoy = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from(tabla)
    .select("paciente_id, fecha")
    .eq("estado", "Agendado")
    .lte("fecha", hoy);
  if (error) throw error;

  const primerTurno = new Map();
  for (const t of data) {
    const actual = primerTurno.get(t.paciente_id);
    if (!actual || t.fecha < actual) primerTurno.set(t.paciente_id, t.fecha);
  }
  return primerTurno;
}

// En Ortodoncia SÍ hay una señal confiable de "esto fue una consulta
// nueva": el concepto del turno tiene que ser literalmente "Consulta de
// ortodoncia" (a diferencia de General, acá el personal lo carga bien
// porque de eso depende que el paciente arranque marcado como
// "Consulta"). Usar el primer turno del paciente sin este filtro
// confundía pacientes que ya venían en tratamiento desde antes de la app
// (su primer turno CARGADO EN LA APP terminaba siendo un Control de
// rutina, no su consulta real).
async function obtenerPrimeraConsultaOrtodonciaPorPaciente() {
  const hoy = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("turnos_ortodoncia")
    .select("paciente_id, fecha")
    .eq("estado", "Agendado")
    .eq("concepto", "Consulta de ortodoncia")
    .lte("fecha", hoy);
  if (error) throw error;

  const primeraConsulta = new Map();
  for (const t of data) {
    const actual = primeraConsulta.get(t.paciente_id);
    if (!actual || t.fecha < actual) primeraConsulta.set(t.paciente_id, t.fecha);
  }
  return primeraConsulta;
}

// Turnos "cerrados" del mes: agendados de verdad (no cancelados ni
// reprogramados) y ya pasados. De paso cuenta cuántos pacientes DISTINTOS
// hay ahí, para no confundir "cantidad de turnos" (si alguien vino 3 veces
// cuenta 3) con "cantidad de gente" (esa persona cuenta 1 sola vez).
async function obtenerTurnosDelMes(tabla, fechaInicio, fechaFinTope) {
  if (fechaFinTope < fechaInicio) return { turnos: 0, pacientesDistintos: 0 };
  const { data, error } = await supabase
    .from(tabla)
    .select("paciente_id")
    .eq("estado", "Agendado")
    .gte("fecha", fechaInicio)
    .lte("fecha", fechaFinTope);
  if (error) throw error;
  return { turnos: data.length, pacientesDistintos: new Set(data.map((t) => t.paciente_id)).size };
}

async function obtenerEstadoPacientesOrtodoncia() {
  const { data, error } = await supabase.from("pacientes_ortodoncia").select("id, estado_paciente");
  if (error) throw error;
  return new Map(data.map((p) => [p.id, p.estado_paciente]));
}

// Junta todo lo que hace falta para calcular conversión (primer turno de
// cada paciente + si ya arrancó tratamiento) una sola vez, para repartirlo
// entre varios meses sin repetir las mismas consultas pesadas.
export async function obtenerContextoConversion() {
  const [primerTurnoGeneralSinFiltrar, primerTurnoOrtodoncia, idsConActividad, estadoOrtodoncia, idsConHistoricoPrevio] =
    await Promise.all([
      obtenerPrimerTurnoPorPaciente("turnos_general"),
      obtenerPrimeraConsultaOrtodonciaPorPaciente(),
      obtenerIdsPacientesConActividad(),
      obtenerEstadoPacientesOrtodoncia(),
      obtenerIdsPacientesConHistoricoPrevio(),
    ]);

  // Si ya tenía un plan con pagos históricos (de antes de la app), su
  // primer turno EN LA APP no es su primera consulta de verdad.
  const primerTurnoGeneral = new Map(
    [...primerTurnoGeneralSinFiltrar].filter(([id]) => !idsConHistoricoPrevio.has(id))
  );

  return { primerTurnoGeneral, primerTurnoOrtodoncia, idsConActividad, estadoOrtodoncia };
}

// De los pacientes cuyo primer turno cayó en el mes, cuántos ya arrancaron
// un tratamiento de verdad (no importa si fue ese mismo mes o más
// adelante) — se apoya en la misma señal que "En consulta" (presupuesto
// aceptado o cobro en Caja).
function contarConversionGeneral(fechaInicio, fechaFin, primerTurno, idsConActividad) {
  let nuevos = 0;
  let comenzaronTratamiento = 0;
  for (const [id, fecha] of primerTurno) {
    if (fecha < fechaInicio || fecha > fechaFin) continue;
    nuevos++;
    if (idsConActividad.has(id)) comenzaronTratamiento++;
  }
  return { nuevos, comenzaronTratamiento };
}

// En Ortodoncia alcanza con mirar estado_paciente: "Consulta" es el único
// estado que significa que todavía no arrancó.
function contarConversionOrtodoncia(fechaInicio, fechaFin, primerTurno, estadoOrtodoncia) {
  let nuevos = 0;
  let comenzaronTratamiento = 0;
  for (const [id, fecha] of primerTurno) {
    if (fecha < fechaInicio || fecha > fechaFin) continue;
    nuevos++;
    if (estadoOrtodoncia.get(id) !== "Consulta") comenzaronTratamiento++;
  }
  return { nuevos, comenzaronTratamiento };
}

export async function obtenerActividadDelDia(fecha) {
  const { desde, hasta } = rangoDelDia(fecha);

  const [
    pacientesNuevosGeneral,
    pacientesNuevosOrtodoncia,
    historialesMarcados,
    consentimientosMarcados,
    turnosAtendidosGeneral,
    turnosAtendidosOrtodoncia,
    totalesGeneral,
    totalesOrtodoncia,
  ] = await Promise.all([
    contarPorFecha("pacientes", "created_at", desde, hasta),
    contarPorFecha("pacientes_ortodoncia", "created_at", desde, hasta),
    contarPorFecha("pacientes", "historia_clinica_marcada_en", desde, hasta),
    contarPorFecha("pacientes", "consentimiento_marcado_en", desde, hasta),
    contarTurnosAtendidos("turnos_general", fecha, "asistencia", "Asistió"),
    contarTurnosAtendidos("turnos_ortodoncia", fecha, "asistencia", "Asistió"),
    calcularTotalesDelDia(fecha),
    calcularTotalesDelDiaOrtodoncia(fecha),
  ]);

  return {
    pacientesNuevosGeneral,
    pacientesNuevosOrtodoncia,
    pacientesNuevosTotal: pacientesNuevosGeneral + pacientesNuevosOrtodoncia,
    historialesMarcados,
    consentimientosMarcados,
    turnosAtendidosGeneral,
    turnosAtendidosOrtodoncia,
    turnosAtendidosTotal: turnosAtendidosGeneral + turnosAtendidosOrtodoncia,
    cobradoHoy: totalesGeneral.totalGeneral + totalesOrtodoncia.totalGeneral,
    cantidadCobrosHoy: totalesGeneral.cantidadCobros + totalesOrtodoncia.cantidadCobros,
  };
}

export async function obtenerResumenMensual(anio, mes, contexto) {
  const { fechaInicio, fechaFin, desde, hasta } = rangoDelMes(anio, mes);
  const ctx = contexto || (await obtenerContextoConversion());
  const hoy = new Date().toISOString().slice(0, 10);
  const fechaFinTope = fechaFin < hoy ? fechaFin : hoy;

  const [historialesMarcados, consentimientosMarcados, balance, turnosGeneralMes, turnosOrtoMes] = await Promise.all([
    contarPorFecha("pacientes", "historia_clinica_marcada_en", desde, hasta),
    contarPorFecha("pacientes", "consentimiento_marcado_en", desde, hasta),
    obtenerBalanceMensual(fechaInicio, fechaFin),
    obtenerTurnosDelMes("turnos_general", fechaInicio, fechaFinTope),
    obtenerTurnosDelMes("turnos_ortodoncia", fechaInicio, fechaFinTope),
  ]);

  const conversionGeneral = contarConversionGeneral(fechaInicio, fechaFin, ctx.primerTurnoGeneral, ctx.idsConActividad);
  const conversionOrtodoncia = contarConversionOrtodoncia(
    fechaInicio,
    fechaFin,
    ctx.primerTurnoOrtodoncia,
    ctx.estadoOrtodoncia
  );

  return {
    anio,
    mes,
    primeraConsultaGeneral: conversionGeneral.nuevos,
    primeraConsultaOrtodoncia: conversionOrtodoncia.nuevos,
    primeraConsultaTotal: conversionGeneral.nuevos + conversionOrtodoncia.nuevos,
    comenzaronTratamientoGeneral: conversionGeneral.comenzaronTratamiento,
    comenzaronTratamientoOrtodoncia: conversionOrtodoncia.comenzaronTratamiento,
    comenzaronTratamientoTotal: conversionGeneral.comenzaronTratamiento + conversionOrtodoncia.comenzaronTratamiento,
    turnosCerradosGeneral: turnosGeneralMes.turnos,
    turnosCerradosOrtodoncia: turnosOrtoMes.turnos,
    turnosCerradosTotal: turnosGeneralMes.turnos + turnosOrtoMes.turnos,
    pacientesAtendidosGeneral: turnosGeneralMes.pacientesDistintos,
    pacientesAtendidosOrtodoncia: turnosOrtoMes.pacientesDistintos,
    pacientesAtendidosTotal: turnosGeneralMes.pacientesDistintos + turnosOrtoMes.pacientesDistintos,
    historialesMarcados,
    consentimientosMarcados,
    balance,
  };
}

// Últimos N meses (incluyendo el actual), para ver la evolución mes a mes.
// El contexto de conversión se calcula una sola vez acá y se reparte entre
// todos los meses, en vez de repetir las mismas consultas pesadas N veces.
export async function obtenerTendenciaMensual(mesesAtras = 6) {
  const hoy = new Date();
  const meses = [];
  for (let i = mesesAtras - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    meses.push({ anio: d.getFullYear(), mes: d.getMonth() + 1 });
  }
  const contexto = await obtenerContextoConversion();
  return Promise.all(meses.map(({ anio, mes }) => obtenerResumenMensual(anio, mes, contexto)));
}
