import { supabase } from "@/lib/supabaseClient";
import { fechaDeHoyISO, sumarDias } from "@/lib/agenda";
import { SEGMENTOS, obtenerSeguimientoOrtodoncia } from "@/lib/data/seguimientoOrtodoncia";
import { obtenerGestionRetomar } from "@/lib/data/retomarOrtodoncia";

// Limpieza de pacientes de Ortodoncia: pacientes que figuran como "Activo" pero parecen haber dejado de venir.
// Se agrupan por qué tan claro es el caso, y la dueña los pasa en bloque a Inactivo / Abandonó / Finalizado / Consulta.
// Nunca entra un paciente con turno por venir, ni se cambia uno que ya tiene turno o una visita reciente en el momento de aplicar.

export const GRUPOS_LIMPIEZA = [
  {
    clave: "no-siguen",
    titulo: "Ya dijeron que no siguen",
    detalle: "En Retomar figuran «Ya no es paciente» o «No quiere seguir». Son los casos más claros.",
    estadoSugerido: "Inactivo",
  },
  {
    clave: "nunca-arranco",
    titulo: "Nunca arrancaron el tratamiento",
    detalle: "Sin visitas ni pagos y sin datos de instalación: parecen consultas que nunca empezaron.",
    estadoSugerido: "Consulta",
  },
  {
    clave: "sin-movimiento",
    titulo: "Sin visitas ni pagos (con tratamiento anterior)",
    detalle: "Tienen datos de tratamiento pero ninguna visita ni pago desde que la app registra (26/08/2026). Conviene confirmar antes.",
    estadoSugerido: "Inactivo",
  },
  {
    clave: "solo-cuaderno",
    titulo: "Solo figuran en el cuaderno",
    detalle: "Su último pago está en la grilla del cuaderno y no tienen ninguna visita en la app desde entonces.",
    estadoSugerido: "Inactivo",
  },
  {
    clave: "se-alejaron",
    titulo: "Vinieron hace 1 a 3 meses",
    detalle: "Vinieron hace poco: lo normal es escribirles desde Retomar y no darlos de baja todavía.",
    estadoSugerido: "Inactivo",
  },
];

export const ESTADOS_DESTINO = ["Inactivo", "Abandonó", "Finalizado", "Consulta"];

// Nombres que en realidad son bloqueos de la agenda (feriados, reservados), no pacientes.
const NOMBRE_DE_BLOQUEO = /feriado|bloque|reservad|no atiende/i;

function grupoDe(p, gestion) {
  const g = gestion[p.id]?.estado;
  if (g === "Ya no es paciente" || g === "No quiere seguir") return "no-siguen";
  if (p.segmento === SEGMENTOS.SIN_MOVIMIENTO) return p.posibleConsulta ? "nunca-arranco" : "sin-movimiento";
  if (p.segmento === SEGMENTOS.SOLO_CUADERNO) return "solo-cuaderno";
  if (p.segmento === SEGMENTOS.SE_ALEJO) return "se-alejaron";
  return null;
}

// Pacientes Activos sin turno por venir que caen en algún grupo.
export async function obtenerCandidatosLimpieza() {
  const [pacientes, gestionResp] = await Promise.all([obtenerSeguimientoOrtodoncia(), obtenerGestionRetomar()]);
  const gestion = gestionResp.porPaciente;
  const filas = [];
  for (const p of pacientes) {
    if (p.estado !== "Activo" || p.proximoTurno || NOMBRE_DE_BLOQUEO.test(p.nombre)) continue;
    const grupo = grupoDe(p, gestion);
    if (!grupo) continue;
    filas.push({
      id: p.id,
      nombre: p.nombre.trim(),
      whatsapp: p.whatsapp,
      ortodoncista: p.ortodoncista,
      ultimaVisita: p.ultimaVisita,
      ultimoMesPago: p.ultimoMesPago,
      fechaInstalacion: p.fechaInstalacion,
      retomarEstado: gestion[p.id]?.estado || null,
      retomarNota: gestion[p.id]?.nota || null,
      grupo,
    });
  }
  return filas.sort((a, b) => (a.ultimaVisita || "").localeCompare(b.ultimaVisita || "") || a.nombre.localeCompare(b.nombre, "es"));
}

async function enLotes(ids, consultaPorLote) {
  const filas = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await consultaPorLote(ids.slice(i, i + 100));
    if (error) throw error;
    filas.push(...(data || []));
  }
  return filas;
}

// Pasa a los pacientes elegidos al estado nuevo. Justo antes de aplicar vuelve a mirar la base: si alguno ya tiene un turno
// por venir o vino/pagó en los últimos 30 días (la lista pudo quedar abierta), se lo saltea y se avisa.
export async function aplicarEstadoEnLote(ids, estado) {
  if (!ESTADOS_DESTINO.includes(estado)) throw new Error("Estado no válido.");
  const hoy = fechaDeHoyISO();
  const hace30 = sumarDias(hoy, -30);
  const [turnos, cobros, vigentes] = await Promise.all([
    enLotes(ids, (lote) => supabase.from("turnos_ortodoncia").select("paciente_id, fecha, presencia").in("paciente_id", lote).eq("estado", "Agendado").gte("fecha", hace30)),
    enLotes(ids, (lote) => supabase.from("caja_ortodoncia").select("paciente_id, concepto").in("paciente_id", lote).gte("fecha", hace30)),
    enLotes(ids, (lote) => supabase.from("pacientes_ortodoncia").select("id, estado_paciente").in("id", lote)),
  ]);
  const omitidos = {};
  for (const t of turnos) {
    if (t.fecha >= hoy) omitidos[t.paciente_id] = "tiene un turno por venir";
    else if (["En espera", "En consultorio", "Finalizado"].includes(t.presencia)) omitidos[t.paciente_id] ||= "vino en los últimos 30 días";
  }
  for (const c of cobros) if (c.concepto !== "Pago adelantado") omitidos[c.paciente_id] ||= "pagó en los últimos 30 días";
  for (const v of vigentes) if (v.estado_paciente !== "Activo") omitidos[v.id] ||= `ya figura como ${v.estado_paciente}`;
  const aCambiar = ids.filter((id) => !omitidos[id]);
  for (let i = 0; i < aCambiar.length; i += 100) {
    const { error } = await supabase
      .from("pacientes_ortodoncia")
      .update({ estado_paciente: estado })
      .in("id", aCambiar.slice(i, i + 100))
      .eq("estado_paciente", "Activo");
    if (error) throw error;
  }
  return { cambiados: aCambiar, omitidos: ids.filter((id) => omitidos[id]).map((id) => ({ id, motivo: omitidos[id] })) };
}

// Deshace un cambio recién hecho: vuelven a Activo solo los que siguen en el estado al que se los pasó.
export async function deshacerEstadoEnLote(ids, estado) {
  for (let i = 0; i < ids.length; i += 100) {
    const { error } = await supabase
      .from("pacientes_ortodoncia")
      .update({ estado_paciente: "Activo" })
      .in("id", ids.slice(i, i + 100))
      .eq("estado_paciente", estado);
    if (error) throw error;
  }
}
