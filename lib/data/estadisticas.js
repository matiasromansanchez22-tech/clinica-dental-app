import { supabase } from "@/lib/supabaseClient";
import { calcularTotalesDelDia } from "@/lib/data/cierres";
import { calcularTotalesDelDiaOrtodoncia } from "@/lib/data/cierresTurnoOrtodoncia";
import { obtenerBalanceMensual } from "@/lib/data/balance";
import { obtenerIdsPacientesConActividad } from "@/lib/data/pacientes";

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

// De los pacientes de Odontología General dados de alta en el mes, cuántos
// ya arrancaron un tratamiento de verdad (no importa si fue ese mismo mes o
// más adelante) — se apoya en la misma señal que "En consulta" (presupuesto
// aceptado o cobro en Caja). idsConActividad se puede pasar precalculado
// para no repetir las mismas dos consultas por cada mes de una tendencia.
async function contarConversionGeneral(desde, hasta, idsConActividad) {
  const [{ data: nuevos, error }, ids] = await Promise.all([
    supabase.from("pacientes").select("id").gte("created_at", desde).lte("created_at", hasta),
    idsConActividad || obtenerIdsPacientesConActividad(),
  ]);
  if (error) throw error;
  const comenzaronTratamiento = nuevos.filter((p) => ids.has(p.id)).length;
  return { nuevos: nuevos.length, comenzaronTratamiento };
}

// En Ortodoncia alcanza con mirar estado_paciente: "Consulta" es el único
// estado que significa que todavía no arrancó.
async function contarConversionOrtodoncia(desde, hasta) {
  const { data, error } = await supabase
    .from("pacientes_ortodoncia")
    .select("estado_paciente")
    .gte("created_at", desde)
    .lte("created_at", hasta);
  if (error) throw error;
  const comenzaronTratamiento = data.filter((p) => p.estado_paciente !== "Consulta").length;
  return { nuevos: data.length, comenzaronTratamiento };
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

export async function obtenerResumenMensual(anio, mes, idsConActividad) {
  const { fechaInicio, fechaFin, desde, hasta } = rangoDelMes(anio, mes);

  const [
    historialesMarcados,
    consentimientosMarcados,
    balance,
    conversionGeneral,
    conversionOrtodoncia,
  ] = await Promise.all([
    contarPorFecha("pacientes", "historia_clinica_marcada_en", desde, hasta),
    contarPorFecha("pacientes", "consentimiento_marcado_en", desde, hasta),
    obtenerBalanceMensual(fechaInicio, fechaFin),
    contarConversionGeneral(desde, hasta, idsConActividad),
    contarConversionOrtodoncia(desde, hasta),
  ]);

  return {
    anio,
    mes,
    pacientesNuevosGeneral: conversionGeneral.nuevos,
    pacientesNuevosOrtodoncia: conversionOrtodoncia.nuevos,
    pacientesNuevosTotal: conversionGeneral.nuevos + conversionOrtodoncia.nuevos,
    comenzaronTratamientoGeneral: conversionGeneral.comenzaronTratamiento,
    comenzaronTratamientoOrtodoncia: conversionOrtodoncia.comenzaronTratamiento,
    comenzaronTratamientoTotal: conversionGeneral.comenzaronTratamiento + conversionOrtodoncia.comenzaronTratamiento,
    historialesMarcados,
    consentimientosMarcados,
    balance,
  };
}

// Últimos N meses (incluyendo el actual), para ver la evolución mes a mes.
// idsConActividad se calcula una sola vez acá y se reparte entre todos los
// meses, en vez de repetir las mismas consultas de presupuestos/caja N veces.
export async function obtenerTendenciaMensual(mesesAtras = 6) {
  const hoy = new Date();
  const meses = [];
  for (let i = mesesAtras - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    meses.push({ anio: d.getFullYear(), mes: d.getMonth() + 1 });
  }
  const idsConActividad = await obtenerIdsPacientesConActividad();
  return Promise.all(meses.map(({ anio, mes }) => obtenerResumenMensual(anio, mes, idsConActividad)));
}
