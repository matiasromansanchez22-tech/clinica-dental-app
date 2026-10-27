import { supabase } from "@/lib/supabaseClient";
import { fechaDeHoyISO } from "@/lib/agenda";

// Tarjeta de fidelidad de Ortodoncia (ver migración 176).
//  · Cada control al que el paciente asiste suma una visita seguida.
//  · A las 5 visitas seguidas: 50% de descuento en el control siguiente. A las 10: el control siguiente es sin costo,
//    y la tarjeta vuelve a empezar.
//  · Faltar sin avisar ("No asistió") vuelve la racha a cero. Un turno cancelado o reprogramado no la rompe ni suma.
//    Un turno ya pasado que nadie marcó tampoco suma ni rompe (se muestra como aviso para que se marque).
//  · Los premios se guardan en cuanto se alcanzan, así una falta posterior no los borra.

export const CONFIG_FIDELIDAD_POR_DEFECTO = {
  fidelidad_visitas_descuento: 5,
  fidelidad_porcentaje_descuento: 50,
  fidelidad_visitas_control_gratis: 10,
  fidelidad_vigencia_dias: 90,
  fidelidad_desde: 20261027,
};

const PRESENCIAS_QUE_VINO = ["En espera", "En consultorio", "Finalizado"];

export function fechaDesdeConfig(cfg) {
  const n = String(Math.round(Number(cfg.fidelidad_desde) || CONFIG_FIDELIDAD_POR_DEFECTO.fidelidad_desde));
  return `${n.slice(0, 4)}-${n.slice(4, 6)}-${n.slice(6, 8)}`;
}

function sumarDias(fechaISO, dias) {
  const d = new Date(`${fechaISO}T12:00:00`);
  d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function obtenerConfigFidelidad() {
  const { data, error } = await supabase.from("configuracion_ortodoncia").select("clave, valor").like("clave", "fidelidad_%");
  if (error) throw error;
  const cfg = { ...CONFIG_FIDELIDAD_POR_DEFECTO };
  for (const f of data) cfg[f.clave] = Number(f.valor);
  return cfg;
}

// Qué pasó con un turno de control: "asistio", "falto" o null (no cuenta ni rompe).
function resultadoDelTurno(t) {
  if (t.asistencia === "No asistió") return "falto";
  if (PRESENCIAS_QUE_VINO.includes(t.presencia)) return "asistio";
  return null;
}

// A partir de los turnos de control de UN paciente (cualquier orden), calcula la racha y los premios que ganó.
//  · progreso: visitas seguidas de la tarjeta actual (0 a cantidad-1).
//  · premios: [{ nivel, tipo, inicioRacha, habilitadoEn }] — los que se alcanzaron desde `desde`.
//  · sinMarcar: turnos ya pasados que nadie marcó (si se marcan, la racha puede cambiar).
export function calcularRacha(turnosControl, cfg, hoy = fechaDeHoyISO()) {
  const desde = fechaDesdeConfig(cfg);
  const visitasDescuento = cfg.fidelidad_visitas_descuento;
  const visitasGratis = cfg.fidelidad_visitas_control_gratis;
  const ordenados = turnosControl
    .filter((t) => t.fecha >= desde && t.fecha <= hoy)
    .sort((a, b) => (a.fecha + (a.hora_inicio || "")).localeCompare(b.fecha + (b.hora_inicio || "")));

  let progreso = 0;
  let inicioRacha = null;
  let ultimaFecha = null;
  let completoUltima = false;
  let sinMarcar = 0;
  const premios = [];
  for (const t of ordenados) {
    const r = resultadoDelTurno(t);
    if (!r) {
      if (t.estado !== "Cancelado" && t.estado !== "Reprogramado" && t.asistencia !== "Canceló" && t.fecha < hoy) sinMarcar += 1;
      continue;
    }
    if (r === "falto") {
      progreso = 0;
      inicioRacha = null;
      completoUltima = false;
      continue;
    }
    if (ultimaFecha === t.fecha) continue; // dos controles el mismo día cuentan una vez
    ultimaFecha = t.fecha;
    if (progreso === 0) inicioRacha = t.fecha;
    completoUltima = false;
    progreso += 1;
    if (progreso === visitasDescuento) premios.push({ nivel: visitasDescuento, tipo: "Descuento en un control", inicioRacha, habilitadoEn: t.fecha });
    if (progreso === visitasGratis) {
      premios.push({ nivel: visitasGratis, tipo: "Control sin costo", inicioRacha, habilitadoEn: t.fecha });
      progreso = 0;
      inicioRacha = null;
      completoUltima = true;
    }
  }
  return { progreso, premios, completoUltima, ultimaVisita: ultimaFecha, sinMarcar, visitasDescuento, visitasGratis };
}

const SELECT_PREMIO = "id, paciente_id, nivel, tipo, inicio_racha, habilitado_en, vence, estado, monto, aplicado_en";

function mapearPremio(f) {
  return {
    id: f.id,
    pacienteId: f.paciente_id,
    nivel: f.nivel,
    tipo: f.tipo,
    inicioRacha: f.inicio_racha,
    habilitadoEn: f.habilitado_en,
    vence: f.vence,
    estado: f.estado,
    monto: f.monto,
    aplicadoEn: f.aplicado_en,
  };
}

async function guardarPremiosNuevos(filasPorPaciente, cfg) {
  const filas = [];
  for (const [pacienteId, premios] of filasPorPaciente) {
    for (const p of premios) {
      filas.push({
        paciente_id: pacienteId,
        nivel: p.nivel,
        tipo: p.tipo,
        inicio_racha: p.inicioRacha,
        habilitado_en: p.habilitadoEn,
        vence: sumarDias(p.habilitadoEn, cfg.fidelidad_vigencia_dias),
      });
    }
  }
  if (filas.length === 0) return;
  const { error } = await supabase.from("fidelidad_ortodoncia").upsert(filas, { onConflict: "paciente_id,nivel,inicio_racha", ignoreDuplicates: true });
  if (error) throw error;
}

async function marcarVencidos(premios) {
  const hoy = fechaDeHoyISO();
  const vencidos = premios.filter((p) => p.estado === "Habilitado" && p.vence && p.vence < hoy);
  if (vencidos.length === 0) return;
  await supabase.from("fidelidad_ortodoncia").update({ estado: "Vencido" }).in("id", vencidos.map((p) => p.id));
  vencidos.forEach((p) => (p.estado = "Vencido"));
}

// Estado de la tarjeta de un paciente. Deja anotados los premios que alcanzó y todavía no estaban guardados.
export async function obtenerFidelidadDePaciente(pacienteId, cfgConocida) {
  const cfg = cfgConocida || (await obtenerConfigFidelidad());
  const { data: turnos, error } = await supabase
    .from("turnos_ortodoncia")
    .select("fecha, hora_inicio, estado, presencia, asistencia")
    .eq("paciente_id", pacienteId)
    .eq("concepto", "Control")
    .gte("fecha", fechaDesdeConfig(cfg));
  if (error) throw error;
  const racha = calcularRacha(turnos, cfg);
  await guardarPremiosNuevos([[pacienteId, racha.premios]], cfg);
  const { data, error: e2 } = await supabase.from("fidelidad_ortodoncia").select(SELECT_PREMIO).eq("paciente_id", pacienteId).order("habilitado_en");
  if (e2) throw e2;
  const premios = data.map(mapearPremio);
  await marcarVencidos(premios);
  return { cfg, racha, premios };
}

// Premio de la tarjeta que se puede usar en un control cobrado en `fecha`: tiene que estar habilitado, vigente y
// haberse ganado en una visita anterior a la fecha del cobro. Si hay más de uno, el que más descuenta.
export function premioUsable(premios, fecha) {
  const vigentes = premios.filter((p) => p.estado === "Habilitado" && p.habilitadoEn < fecha && (!p.vence || p.vence >= fecha));
  const peso = (p) => (p.tipo === "Control sin costo" ? 0 : 1);
  vigentes.sort((a, b) => peso(a) - peso(b) || a.habilitadoEn.localeCompare(b.habilitadoEn));
  return vigentes[0] || null;
}

// Cuánto vale el premio para un control de esa cuota (redondeado a $100).
export function montoDescuentoFidelidad(premio, cuota, cfg) {
  if (!premio || !cuota) return 0;
  if (premio.tipo === "Control sin costo") return Math.round(Number(cuota));
  return Math.round((Number(cuota) * Number(cfg.fidelidad_porcentaje_descuento || 50)) / 100 / 100) * 100;
}

// Después de guardar un cobro con descuento: el premio queda como aplicado (no se puede usar dos veces).
export async function marcarFidelidadAplicada({ premioId, monto, cajaOrtodonciaId, fecha }) {
  const { error } = await supabase
    .from("fidelidad_ortodoncia")
    .update({ estado: "Aplicado", monto, aplicado_en: fecha, cobro_id: cajaOrtodonciaId })
    .eq("id", premioId);
  if (error) throw error;
}

async function traerTodo(tabla, columnas, filtrar = (q) => q) {
  const filas = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await filtrar(supabase.from(tabla).select(columnas)).range(desde, desde + 999);
    if (error) throw error;
    filas.push(...data);
    if (data.length < 1000) break;
  }
  return filas;
}

// Todos los pacientes con tarjeta en curso (para la pantalla de Fidelidad). También deja anotados los premios nuevos.
export async function obtenerFidelidadTodos() {
  const cfg = await obtenerConfigFidelidad();
  const desde = fechaDesdeConfig(cfg);
  const [pacientes, turnos, premiosDb] = await Promise.all([
    traerTodo("pacientes_ortodoncia", "id, nombre, estado_paciente, whatsapp"),
    traerTodo("turnos_ortodoncia", "paciente_id, fecha, hora_inicio, estado, presencia, asistencia", (q) => q.eq("concepto", "Control").gte("fecha", desde)),
    traerTodo("fidelidad_ortodoncia", SELECT_PREMIO),
  ]);
  const turnosPorPaciente = new Map();
  for (const t of turnos) {
    if (!turnosPorPaciente.has(t.paciente_id)) turnosPorPaciente.set(t.paciente_id, []);
    turnosPorPaciente.get(t.paciente_id).push(t);
  }
  const rachas = new Map();
  const nuevos = [];
  const clave = (pid, nivel, inicio) => `${pid}|${nivel}|${inicio}`;
  const existentes = new Set(premiosDb.map((p) => clave(p.paciente_id, p.nivel, p.inicio_racha)));
  for (const [pid, ts] of turnosPorPaciente) {
    const r = calcularRacha(ts, cfg);
    rachas.set(pid, r);
    const faltan = r.premios.filter((p) => !existentes.has(clave(pid, p.nivel, p.inicioRacha)));
    if (faltan.length) nuevos.push([pid, faltan]);
  }
  let premiosFinal = premiosDb;
  if (nuevos.length > 0) {
    await guardarPremiosNuevos(nuevos, cfg);
    premiosFinal = await traerTodo("fidelidad_ortodoncia", SELECT_PREMIO);
  }
  const premios = premiosFinal.map(mapearPremio);
  await marcarVencidos(premios);
  const premiosPorPaciente = new Map();
  for (const p of premios) {
    if (!premiosPorPaciente.has(p.pacienteId)) premiosPorPaciente.set(p.pacienteId, []);
    premiosPorPaciente.get(p.pacienteId).push(p);
  }
  const filas = pacientes
    .filter((p) => rachas.has(p.id) || premiosPorPaciente.has(p.id))
    .map((p) => {
      const r = rachas.get(p.id) || calcularRacha([], cfg);
      return { pacienteId: p.id, paciente: p.nombre, activo: p.estado_paciente === "Activo", whatsapp: p.whatsapp, racha: r, premios: premiosPorPaciente.get(p.id) || [] };
    });
  return { cfg, filas };
}
