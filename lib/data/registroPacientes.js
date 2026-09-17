import { supabase } from "@/lib/supabaseClient";

function rangoDelMes(anio, mes) {
  const inicio = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const ultimoDia = new Date(anio, mes, 0).getDate();
  const fin = `${anio}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
  return { fechaInicio: inicio, fechaFin: fin };
}

// La fecha de alta de cada paciente de General — en la práctica es la
// fecha real de su primera consulta, porque la ficha se crea en el
// momento de agendarle el primer turno (no se recicla una ficha vieja
// para un paciente nuevo). Así quedan afuera automáticamente todos los
// que ya estaban cargados de antes (migración inicial u otros pacientes
// viejos), sin depender del "tipo de atención" del turno (que no es
// confiable).
async function obtenerAltaPacientesGeneral() {
  const { data, error } = await supabase.from("pacientes").select("id, apellido_y_nombre, created_at");
  if (error) throw error;
  return new Map(
    data.map((p) => [p.id, { pacienteId: p.id, paciente: p.apellido_y_nombre, fecha: p.created_at.slice(0, 10) }])
  );
}

// El primer turno de cada paciente (no cancelado ni reprogramado), con el
// profesional que lo atendió — para saber quién se hizo cargo de la
// consulta, no solo cuántas hubo. Acá sí se incluyen turnos a futuro:
// como el mes de "primera consulta" en General lo define la fecha de
// alta (no la del turno), un paciente nuevo con el turno agendado para
// más adelante tiene que seguir apareciendo con ese profesional y esa
// fecha, en vez de quedar como "sin turno". Al venir ordenado por fecha
// ascendente, la primera fila que aparece por paciente ya es la más
// vieja.
async function obtenerPrimerTurnoConProfesionalGeneral() {
  const { data, error } = await supabase
    .from("turnos_general")
    .select(
      `paciente_id, fecha, profesional_de_turno_id,
       paciente:pacientes(apellido_y_nombre),
       profesional_de_turno:profesionales!profesional_de_turno_id(nombre)`
    )
    .eq("estado", "Agendado")
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

// Un cobro cuya ÚNICA prestación facturada es la consulta/diagnóstico
// inicial no cuenta como "arrancó tratamiento" — es solo el pago de haber
// venido a consultar (aunque se haya cobrado tarde, o quedado anotado en
// una planilla vieja antes de cargarlo en Caja). El personal elige la
// prestación al cargar el cobro, así que ese dato sí es confiable.
function esCobroSoloConsulta(prestaciones) {
  if (!prestaciones || prestaciones.length !== 1) return false;
  return (prestaciones[0].prestacion || "").toLowerCase().includes("consulta");
}

// Plata cobrada en Caja a cada paciente, sumando todo lo que pagó hasta
// hoy — la base real para calcular cuánto le corresponde a cada
// profesional según el % que se le vaya a dar. En General, el pago de
// solo la consulta queda afuera (eso ya se cuenta aparte en "Valor
// consultas", así no se cuenta dos veces); en Ortodoncia no aplica ese
// filtro porque ahí no hay una columna de prestaciones para distinguirlo.
async function obtenerMontoCobradoPorPaciente(tabla, columnaMonto, { excluirSoloConsulta } = {}) {
  const columnas = excluirSoloConsulta ? `paciente_id, ${columnaMonto}, prestaciones` : `paciente_id, ${columnaMonto}`;
  const { data, error } = await supabase.from(tabla).select(columnas);
  if (error) throw error;
  const monto = new Map();
  for (const f of data) {
    if (!f.paciente_id) continue;
    if (excluirSoloConsulta && esCobroSoloConsulta(f.prestaciones)) continue;
    monto.set(f.paciente_id, (monto.get(f.paciente_id) || 0) + Number(f[columnaMonto] || 0));
  }
  return monto;
}

// Fecha en que cada paciente de Odontología General empezó de verdad
// (presupuesto aceptado o primer cobro en Caja que sea más que la
// consulta, lo que haya pasado antes).
async function obtenerFechaInicioTratamientoGeneral() {
  const [{ data: presupuestos, error: e1 }, { data: cobros, error: e2 }] = await Promise.all([
    supabase.from("presupuestos").select("paciente_id, fecha_aceptacion").eq("estado", "Aceptado"),
    supabase.from("caja_general").select("paciente_id, fecha, prestaciones"),
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
  for (const c of cobros) {
    if (!esCobroSoloConsulta(c.prestaciones)) actualizar(c.paciente_id, c.fecha);
  }
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

// Precio actual de la consulta particular de Odontología General (catálogo
// "Consulta odontológica inicial") — sirve para calcular cuánto generó
// cada profesional solo por atender consultas, además de lo que generó en
// tratamientos.
export async function obtenerValorConsultaGeneral() {
  const { data, error } = await supabase
    .from("catalogo_prestaciones")
    .select("valor_efectivo")
    .eq("id", "OG-0054")
    .maybeSingle();
  if (error) throw error;
  return data?.valor_efectivo || 0;
}

// Registro completo de pacientes cuya primera consulta cayó en el mes
// elegido, con el profesional que los atendió y si ya empezaron
// tratamiento — pensado para que la Dueña pueda repartir el % de cada
// profesional según las consultas que efectivamente se transformaron en
// tratamiento.
export async function obtenerRegistroPacientesDelMes(anio, mes) {
  const { fechaInicio, fechaFin } = rangoDelMes(anio, mes);

  const [
    altaGeneral,
    primerTurnoGeneral,
    primerTurnoOrtodoncia,
    fechaInicioGeneral,
    fechaInicioOrtodoncia,
    montoGeneral,
    montoOrtodoncia,
  ] = await Promise.all([
    obtenerAltaPacientesGeneral(),
    obtenerPrimerTurnoConProfesionalGeneral(),
    obtenerPrimerTurnoConProfesionalOrtodoncia(),
    obtenerFechaInicioTratamientoGeneral(),
    obtenerFechaInicioTratamientoOrtodoncia(),
    obtenerMontoCobradoPorPaciente("caja_general", "pago", { excluirSoloConsulta: true }),
    obtenerMontoCobradoPorPaciente("caja_ortodoncia", "importe"),
  ]);

  const filas = [];
  for (const alta of altaGeneral.values()) {
    if (alta.fecha < fechaInicio || alta.fecha > fechaFin) continue;
    // El profesional y la fecha exacta de la consulta salen de su primer
    // turno real (si todavía no tiene ninguno cargado, queda "sin
    // asignar" en vez de desaparecer del registro).
    const turno = primerTurnoGeneral.get(alta.pacienteId);
    filas.push({
      pacienteId: alta.pacienteId,
      paciente: alta.paciente,
      especialidad: "General",
      profesionalId: turno?.profesionalId ?? null,
      profesional: turno?.profesional ?? "(sin turno cargado)",
      fechaConsulta: turno?.fecha ?? alta.fecha,
      empezoTratamiento: fechaInicioGeneral.has(alta.pacienteId),
      fechaEmpezo: fechaInicioGeneral.get(alta.pacienteId) || null,
      montoCobrado: montoGeneral.get(alta.pacienteId) || 0,
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
