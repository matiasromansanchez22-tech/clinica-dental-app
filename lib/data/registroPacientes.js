import { supabase } from "@/lib/supabaseClient";

function rangoDelMes(anio, mes) {
  const inicio = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const ultimoDia = new Date(anio, mes, 0).getDate();
  const fin = `${anio}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
  return { fechaInicio: inicio, fechaFin: fin };
}

// El primer turno de cada paciente (no cancelado ni reprogramado, ya
// pasado), con el profesional que lo atendió ese día — para saber quién
// se hizo cargo de la consulta, no solo cuántas hubo. Al venir ordenado
// por fecha ascendente, la primera fila que aparece por paciente ya es la
// más vieja.
async function obtenerPrimerTurnoConProfesionalGeneral() {
  const hoy = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("turnos_general")
    .select(
      `paciente_id, fecha, profesional_de_turno_id,
       paciente:pacientes(apellido_y_nombre),
       profesional_de_turno:profesionales!profesional_de_turno_id(nombre)`
    )
    .eq("estado", "Agendado")
    .lte("fecha", hoy)
    .order("fecha");
  if (error) throw error;

  const primerTurno = new Map();
  for (const t of data) {
    if (primerTurno.has(t.paciente_id)) continue;
    primerTurno.set(t.paciente_id, {
      pacienteId: t.paciente_id,
      paciente: t.paciente?.apellido_y_nombre ?? "(sin nombre)",
      fecha: t.fecha,
      profesionalId: t.profesional_de_turno_id,
      profesional: t.profesional_de_turno?.nombre ?? "(sin asignar)",
    });
  }
  return primerTurno;
}

// A diferencia de General, en Ortodoncia el concepto del turno SÍ es una
// señal confiable de "esto fue una consulta nueva de verdad" — por eso acá
// se filtra por concepto = "Consulta de ortodoncia" en vez de tomar
// cualquier primer turno. Si se tomara cualquier primer turno, un paciente
// que ya venía en tratamiento desde antes de usar la app (y recién ahora
// se le carga un Control de rutina) quedaría mal contado como consulta
// nueva.
async function obtenerPrimerTurnoConProfesionalOrtodoncia() {
  const hoy = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("turnos_ortodoncia")
    .select(
      `paciente_id, fecha, ortodoncista_id,
       paciente:pacientes_ortodoncia(nombre),
       ortodoncista:profesionales!ortodoncista_id(nombre)`
    )
    .eq("estado", "Agendado")
    .eq("concepto", "Consulta de ortodoncia")
    .lte("fecha", hoy)
    .order("fecha");
  if (error) throw error;

  const primerTurno = new Map();
  for (const t of data) {
    if (primerTurno.has(t.paciente_id)) continue;
    primerTurno.set(t.paciente_id, {
      pacienteId: t.paciente_id,
      paciente: t.paciente?.nombre ?? "(sin nombre)",
      fecha: t.fecha,
      profesionalId: t.ortodoncista_id,
      profesional: t.ortodoncista?.nombre ?? "(sin asignar)",
    });
  }
  return primerTurno;
}

// Pacientes con algún pago histórico cargado (de la planilla de antes de
// usar la app) en un plan de financiación — es la prueba más confiable de
// que ya eran pacientes de tratamiento desde antes, aunque su primer turno
// EN LA APP recién se haya cargado ahora (por ejemplo, un control de
// rutina). Se usan para no contarlos como "primera consulta" en General.
export async function obtenerIdsPacientesConHistoricoPrevio() {
  const { data, error } = await supabase
    .from("planes_pagos_historicos")
    .select("plan:planes_financiacion(paciente_id)");
  if (error) throw error;
  return new Set(data.map((f) => f.plan?.paciente_id).filter(Boolean));
}

// Plata cobrada en Caja a cada paciente, sumando todo lo que pagó hasta
// hoy — la base real para calcular cuánto le corresponde a cada
// profesional según el % que se le vaya a dar.
async function obtenerMontoCobradoPorPaciente(tabla, columnaMonto) {
  const { data, error } = await supabase.from(tabla).select(`paciente_id, ${columnaMonto}`);
  if (error) throw error;
  const monto = new Map();
  for (const f of data) {
    if (!f.paciente_id) continue;
    monto.set(f.paciente_id, (monto.get(f.paciente_id) || 0) + Number(f[columnaMonto] || 0));
  }
  return monto;
}

// Fecha en que cada paciente de Odontología General empezó de verdad
// (presupuesto aceptado o primer cobro en Caja, lo que haya pasado antes).
async function obtenerFechaInicioTratamientoGeneral() {
  const [{ data: presupuestos, error: e1 }, { data: cobros, error: e2 }] = await Promise.all([
    supabase.from("presupuestos").select("paciente_id, fecha_aceptacion").eq("estado", "Aceptado"),
    supabase.from("caja_general").select("paciente_id, fecha"),
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  const fechaInicio = new Map();
  const actualizar = (id, fecha) => {
    if (!id || !fecha) return;
    const actual = fechaInicio.get(id);
    if (!actual || fecha < actual) fechaInicio.set(id, fecha);
  };
  for (const p of presupuestos) actualizar(p.paciente_id, p.fecha_aceptacion);
  for (const c of cobros) actualizar(c.paciente_id, c.fecha);
  return fechaInicio;
}

// En Ortodoncia ya está la fecha de instalación cargada aparte.
async function obtenerFechaInicioTratamientoOrtodoncia() {
  const { data, error } = await supabase.from("pacientes_ortodoncia").select("id, estado_paciente, fecha_instalacion");
  if (error) throw error;

  const fechaInicio = new Map();
  for (const p of data) {
    if (p.estado_paciente !== "Consulta") fechaInicio.set(p.id, p.fecha_instalacion || null);
  }
  return fechaInicio;
}

// Registro completo de pacientes cuya primera consulta cayó en el mes
// elegido, con el profesional que los atendió y si ya empezaron
// tratamiento — pensado para que la Dueña pueda repartir el % de cada
// profesional según las consultas que efectivamente se transformaron en
// tratamiento.
export async function obtenerRegistroPacientesDelMes(anio, mes) {
  const { fechaInicio, fechaFin } = rangoDelMes(anio, mes);

  const [
    primerTurnoGeneral,
    primerTurnoOrtodoncia,
    fechaInicioGeneral,
    fechaInicioOrtodoncia,
    idsConHistoricoPrevio,
    montoGeneral,
    montoOrtodoncia,
  ] = await Promise.all([
    obtenerPrimerTurnoConProfesionalGeneral(),
    obtenerPrimerTurnoConProfesionalOrtodoncia(),
    obtenerFechaInicioTratamientoGeneral(),
    obtenerFechaInicioTratamientoOrtodoncia(),
    obtenerIdsPacientesConHistoricoPrevio(),
    obtenerMontoCobradoPorPaciente("caja_general", "pago"),
    obtenerMontoCobradoPorPaciente("caja_ortodoncia", "importe"),
  ]);

  const filas = [];
  for (const t of primerTurnoGeneral.values()) {
    if (t.fecha < fechaInicio || t.fecha > fechaFin) continue;
    // Ya tenía un plan con pagos históricos (de antes de la app) — su
    // primer turno EN LA APP no es su primera consulta de verdad.
    if (idsConHistoricoPrevio.has(t.pacienteId)) continue;
    filas.push({
      pacienteId: t.pacienteId,
      paciente: t.paciente,
      especialidad: "General",
      profesionalId: t.profesionalId,
      profesional: t.profesional,
      fechaConsulta: t.fecha,
      empezoTratamiento: fechaInicioGeneral.has(t.pacienteId),
      fechaEmpezo: fechaInicioGeneral.get(t.pacienteId) || null,
      montoCobrado: montoGeneral.get(t.pacienteId) || 0,
    });
  }
  for (const t of primerTurnoOrtodoncia.values()) {
    if (t.fecha < fechaInicio || t.fecha > fechaFin) continue;
    filas.push({
      pacienteId: t.pacienteId,
      paciente: t.paciente,
      especialidad: "Ortodoncia",
      profesionalId: t.profesionalId,
      profesional: t.profesional,
      fechaConsulta: t.fecha,
      empezoTratamiento: fechaInicioOrtodoncia.has(t.pacienteId),
      fechaEmpezo: fechaInicioOrtodoncia.get(t.pacienteId) || null,
      montoCobrado: montoOrtodoncia.get(t.pacienteId) || 0,
    });
  }

  filas.sort((a, b) => (a.fechaConsulta < b.fechaConsulta ? -1 : a.fechaConsulta > b.fechaConsulta ? 1 : 0));
  return filas;
}
