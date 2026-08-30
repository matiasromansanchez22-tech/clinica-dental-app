import { supabase } from "@/lib/supabaseClient";
import { calcularTotalesDelDia } from "@/lib/data/cierres";
import { calcularTotalesDelDiaOrtodoncia } from "@/lib/data/cierresTurnoOrtodoncia";
import { obtenerBalanceMensual } from "@/lib/data/balance";

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

async function contarTurnosAtendidos(tabla, fecha) {
  const { count, error } = await supabase
    .from(tabla)
    .select("id", { count: "exact", head: true })
    .eq("fecha", fecha)
    .eq("asistencia", "Asistió");
  if (error) throw error;
  return count || 0;
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
    contarTurnosAtendidos("turnos_general", fecha),
    contarTurnosAtendidos("turnos_ortodoncia", fecha),
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

export async function obtenerResumenMensual(anio, mes) {
  const { fechaInicio, fechaFin, desde, hasta } = rangoDelMes(anio, mes);

  const [pacientesNuevosGeneral, pacientesNuevosOrtodoncia, historialesMarcados, consentimientosMarcados, balance] =
    await Promise.all([
      contarPorFecha("pacientes", "created_at", desde, hasta),
      contarPorFecha("pacientes_ortodoncia", "created_at", desde, hasta),
      contarPorFecha("pacientes", "historia_clinica_marcada_en", desde, hasta),
      contarPorFecha("pacientes", "consentimiento_marcado_en", desde, hasta),
      obtenerBalanceMensual(fechaInicio, fechaFin),
    ]);

  return {
    anio,
    mes,
    pacientesNuevosGeneral,
    pacientesNuevosOrtodoncia,
    pacientesNuevosTotal: pacientesNuevosGeneral + pacientesNuevosOrtodoncia,
    historialesMarcados,
    consentimientosMarcados,
    balance,
  };
}

// Últimos N meses (incluyendo el actual), para ver la evolución mes a mes.
export async function obtenerTendenciaMensual(mesesAtras = 6) {
  const hoy = new Date();
  const meses = [];
  for (let i = mesesAtras - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    meses.push({ anio: d.getFullYear(), mes: d.getMonth() + 1 });
  }
  return Promise.all(meses.map(({ anio, mes }) => obtenerResumenMensual(anio, mes)));
}
