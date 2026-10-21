import { supabase } from "@/lib/supabaseClient";
import { fechaDeHoyISO } from "@/lib/agenda";
import { ESTADOS_ASISTENCIA, situacionDelTurno } from "@/lib/data/seguimientoOrtodoncia";
import { obtenerParesDuplicados } from "@/lib/data/posiblesDuplicados";
import { obtenerControlCobrosOrtodoncia, TIPOS_CONTROL } from "@/lib/data/controlCobrosOrtodoncia";

// Pantalla "Qué revisar": junta en una lista todo lo raro que puede significar un error de carga. Cada alerta se puede dar
// por revisada con una nota (queda guardada en revisiones_control y no vuelve a aparecer).

const DIAS_ATRAS = 30;
const DIAS_SIN_SALDO_REAL = 7;
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function restarDias(fechaISO, dias) {
  const d = new Date(`${fechaISO}T12:00:00`);
  d.setDate(d.getDate() - dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function diasEntre(a, b) {
  return Math.round((new Date(`${a}T12:00:00`) - new Date(`${b}T12:00:00`)) / 86400000);
}

async function traerTodo(consulta) {
  const filas = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await consulta().range(desde, desde + 999);
    if (error) throw error;
    filas.push(...data);
    if (data.length < 1000) break;
  }
  return filas;
}

export async function obtenerRevisiones() {
  const { data, error } = await supabase.from("revisiones_control").select("clave");
  if (error) return new Set(); // falta correr la migración 166: sin revisiones guardadas
  return new Set(data.map((r) => r.clave));
}

export async function marcarComoRevisado({ clave, tipo, nota }) {
  const { error } = await supabase.from("revisiones_control").insert({ clave, tipo, nota: nota?.trim() || null });
  if (error) throw error;
}

// Pacientes de Ortodoncia que vinieron (a cualquier turno) y no tienen ningún cobro ese mes ni el mes figura pago anticipado
// en la grilla. Si la grilla dice "Pago" pero no hay cobro en caja, también se marca: alguien tildó sin cargar el cobro.
async function pacientesQueVinieronSinCobro(hoy, revisadas) {
  const desde = restarDias(hoy, DIAS_ATRAS);
  const turnos = await traerTodo(() =>
    supabase
      .from("turnos_ortodoncia")
      .select("id, fecha, concepto, estado, presencia, asistencia, paciente_id, ortodoncista:profesionales!ortodoncista_id(nombre)")
      .eq("estado", "Agendado")
      .gte("fecha", desde)
      .lt("fecha", hoy)
  );
  const vinieron = turnos.filter((t) => t.paciente_id && situacionDelTurno(t, hoy) === ESTADOS_ASISTENCIA.ASISTIO);
  if (vinieron.length === 0) return [];

  const mesDe = (t) => t.fecha.slice(0, 7);
  const meses = [...new Set(vinieron.map(mesDe))];
  const desdeCobros = `${meses.sort()[0]}-01`;
  const [cobros, pacientes] = await Promise.all([
    traerTodo(() => supabase.from("caja_ortodoncia").select("paciente_id, fecha").gte("fecha", desdeCobros)),
    traerTodo(() => supabase.from("pacientes_ortodoncia").select("id, nombre, ortodoncista:profesionales!ortodoncista_id(nombre)")),
  ]);
  const anios = [...new Set(meses.map((m) => Number(m.slice(0, 4))))];
  const grilla = {};
  for (const anio of anios) {
    const filas = await traerTodo(() => supabase.from("controles_ortodoncia").select(`paciente_id, ${MESES.join(", ")}`).eq("anio", anio));
    for (const f of filas) grilla[`${f.paciente_id}:${anio}`] = f;
  }
  const nombrePaciente = Object.fromEntries(pacientes.map((p) => [p.id, p]));
  const conCobro = new Set(cobros.map((c) => `${c.paciente_id}:${c.fecha.slice(0, 7)}`));

  const porClave = {};
  for (const t of vinieron) {
    const mes = mesDe(t);
    const clave = `sin_cobro:${t.paciente_id}:${mes}`;
    if (revisadas.has(clave) || conCobro.has(`${t.paciente_id}:${mes}`)) continue;
    const marca = grilla[`${t.paciente_id}:${mes.slice(0, 4)}`]?.[MESES[Number(mes.slice(5)) - 1]] || null;
    if (marca && /anticipado/i.test(marca)) continue; // pagó por adelantado: está cubierto
    const fila = (porClave[clave] ||= {
      clave,
      paciente: nombrePaciente[t.paciente_id]?.nombre ?? "(paciente)",
      ortodoncista: nombrePaciente[t.paciente_id]?.ortodoncista?.nombre ?? t.ortodoncista?.nombre ?? "Sin asignar",
      mes,
      turnos: [],
      grilla: marca,
    });
    fila.turnos.push({ fecha: t.fecha, concepto: t.concepto });
  }
  return Object.values(porClave).sort((a, b) => b.turnos[0].fecha.localeCompare(a.turnos[0].fecha));
}

async function cuentasSinSaldoReciente(hoy) {
  const [cuentas, movs] = await Promise.all([
    supabase.from("cuentas_dinero").select("id, nombre").order("orden"),
    supabase.from("movimientos_cuentas").select("cuenta_id, fecha").eq("tipo", "Saldo real"),
  ]);
  if (cuentas.error || movs.error) return []; // falta correr la migración 165
  return cuentas.data
    .map((c) => {
      const fechas = movs.data.filter((m) => m.cuenta_id === c.id).map((m) => m.fecha).sort();
      const ultimo = fechas[fechas.length - 1] || null;
      return { cuenta: c.nombre, ultimo, dias: ultimo ? diasEntre(hoy, ultimo) : null };
    })
    .filter((c) => c.ultimo === null || c.dias > DIAS_SIN_SALDO_REAL);
}

async function reservasEnNegativo() {
  const { data, error } = await supabase.from("movimientos_personales").select("cuenta, tipo, monto").eq("panel", "Consultorio");
  if (error) return [];
  const saldos = { Efectivo: 0, Banco: 0 };
  for (const m of data) saldos[m.cuenta] += (m.tipo === "Ingreso" ? 1 : -1) * Number(m.monto);
  return Object.entries(saldos).filter(([, s]) => s < -0.5).map(([cuenta, saldo]) => ({ cuenta, saldo }));
}

async function resumenControlCobros(hoy) {
  const { filas, resumen } = await obtenerControlCobrosOrtodoncia(hoy.slice(0, 7));
  return {
    deMenos: resumen.deMenos.cantidad,
    cobroSinVisita: resumen.cobroSinVisita.cantidad,
    deMasSinExplicar: filas.filter((f) => f.tipo === TIPOS_CONTROL.DE_MAS && Math.abs(f.sinExplicar) >= 1).length,
  };
}

// `liviano`: sin el resumen del Control de cobros (para el numerito del menú, que se calcula en cada carga).
export async function obtenerAlertas({ liviano = false } = {}) {
  const hoy = fechaDeHoyISO();
  const revisadas = await obtenerRevisiones();
  const [pares, sinCobro, cuentas, reservas, controlCobros] = await Promise.all([
    obtenerParesDuplicados(restarDias(hoy, DIAS_ATRAS)).catch(() => []),
    pacientesQueVinieronSinCobro(hoy, revisadas).catch(() => []),
    cuentasSinSaldoReciente(hoy).catch(() => []),
    reservasEnNegativo().catch(() => []),
    liviano ? Promise.resolve(null) : resumenControlCobros(hoy).catch(() => null),
  ]);
  const duplicados = pares.filter((p) => !revisadas.has(p.clave));
  const cobrosPorRevisar = controlCobros ? controlCobros.deMenos + controlCobros.cobroSinVisita + controlCobros.deMasSinExplicar : 0;
  return {
    duplicados,
    sinCobro,
    cuentas,
    reservas,
    controlCobros,
    total: duplicados.length + sinCobro.length + cuentas.length + reservas.length + cobrosPorRevisar,
  };
}
