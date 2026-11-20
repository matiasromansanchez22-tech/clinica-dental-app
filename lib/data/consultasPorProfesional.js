import { supabase } from "@/lib/supabaseClient";
import { filasDeCobros } from "@/lib/data/cobrosLiquidados";

// Consultas de Odontología General cobradas en un período, con lo que le corresponde al profesional por cada una y si ya se le liquidó.
// Regla de la dirección: las consultas se liquidan al 15% del valor de la consulta (aparte del % general de cada profesional).
export const PORCENTAJE_CONSULTAS = 15;

const esConsulta = (p) => /consulta/i.test(p?.prestacion || "");

async function cobrosDelPeriodo(desde, hasta) {
  const filas = [];
  for (let d = 0; ; d += 1000) {
    const { data, error } = await supabase
      .from("caja_general")
      .select("id, fecha, prestaciones, profesional_atencion_id, paciente_id, paciente:pacientes(apellido_y_nombre), profesional:profesionales!profesional_atencion_id(nombre)")
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha")
      .range(d, d + 999);
    if (error) throw error;
    filas.push(...data);
    if (data.length < 1000) break;
  }
  return filas;
}

async function enLotes(ids, consultaPorLote) {
  const filas = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await consultaPorLote(ids.slice(i, i + 100));
    if (error) throw error;
    filas.push(...data);
  }
  return filas;
}

const dm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

// Con qué siguió el paciente después de la consulta: el primer tratamiento cargado desde ese día, o el presupuesto que quedó armado.
function tratamientoDespues(c, practicas, presupuestos) {
  const hechas = practicas.filter((p) => p.paciente_id === c.paciente_id && p.fecha >= c.fecha && !/consulta/i.test(p.prestacion || ""));
  const indicado = [...practicas].reverse().find((p) => p.paciente_id === c.paciente_id && p.fecha === c.fecha && p.proxima_prestacion_nombre)?.proxima_prestacion_nombre || null;
  if (hechas.length) {
    const nombres = [...new Set(hechas.map((p) => p.prestacion))];
    return { estado: "empezo", texto: `${nombres.slice(0, 3).join(", ")}${nombres.length > 3 ? ` y ${nombres.length - 3} más` : ""} (desde el ${dm(hechas[0].fecha)})`, indicado };
  }
  const suyos = presupuestos.filter((p) => p.paciente_id === c.paciente_id && p.fecha >= c.fecha);
  const items = (lista) => [...new Set(lista.flatMap((p) => (p.prestaciones || []).map((i) => i.prestacion)).filter(Boolean))].slice(0, 3).join(", ");
  const aceptados = suyos.filter((p) => p.estado === "Aceptado");
  if (aceptados.length) return { estado: "aceptado", texto: `Presupuesto aceptado (${items(aceptados) || "—"}), todavía sin práctica cargada`, indicado };
  const pendientes = suyos.filter((p) => p.estado === "Pendiente");
  if (pendientes.length) return { estado: "presupuesto", texto: `Solo presupuesto sin aceptar: ${items(pendientes) || "—"}`, indicado };
  return { estado: "no", texto: "No empezó ningún tratamiento", indicado };
}

//   devuelve [{ id, fecha, paciente, profesionalId, profesional, tipo, cobrado, soloConsulta, marcadaSinHonorarios, corresponde,
//               estado: "liquidada" | "parcial" | "sin", fechaLiquidacion, pagado, falta, deMas }]
export async function obtenerConsultasDelPeriodo(desde, hasta) {
  const cobros = (await cobrosDelPeriodo(desde, hasta)).filter((c) => (c.prestaciones || []).some(esConsulta));
  const ids = cobros.map((c) => c.id);
  const liquidaciones = ids.length
    ? await filasDeCobros("caja_general_id", ids, "caja_general_id, parcial, honorarios, monto_pagado, profesional_id, created_at, pago:pagos_profesionales(fecha)")
    : [];

  const pacienteIds = [...new Set(cobros.map((c) => c.paciente_id).filter(Boolean))];
  const [practicas, presupuestos] = await Promise.all([
    enLotes(pacienteIds, (lote) => supabase.from("prestaciones_realizadas_agenda").select("paciente_id, fecha, prestacion, proxima_prestacion_nombre").in("paciente_id", lote).gte("fecha", desde).order("fecha")),
    enLotes(pacienteIds, (lote) => supabase.from("presupuestos").select("paciente_id, fecha, estado, prestaciones").in("paciente_id", lote).neq("estado", "Anulado")),
  ]);

  return cobros.map((c) => {
    const lineas = (c.prestaciones || []).filter(esConsulta);
    const cobrado = lineas.reduce((a, p) => a + Number(p.valor || 0) * Number(p.cantidad || 1), 0);
    const soloConsulta = (c.prestaciones || []).every(esConsulta);
    const corresponde = cobrado * (PORCENTAJE_CONSULTAS / 100);
    const filas = liquidaciones.filter((l) => l.caja_general_id === c.id && (!l.profesional_id || l.profesional_id === c.profesional_atencion_id));
    const completa = filas.find((f) => !f.parcial);
    let estado = "sin";
    let pagado = 0;
    let fechaLiquidacion = null;
    if (completa) {
      estado = "liquidada";
      fechaLiquidacion = completa.pago?.fecha ?? null;
      // Si el cobro tenía otras prestaciones, lo pagado mezcla todo: no se puede aislar lo de la consulta.
      pagado = soloConsulta ? Number(completa.honorarios || 0) : null;
    } else if (filas.length) {
      estado = "parcial";
      pagado = filas.reduce((a, f) => a + Number(f.monto_pagado || 0), 0);
      fechaLiquidacion = filas[filas.length - 1].pago?.fecha ?? null;
    }
    const falta = estado === "liquidada" && pagado === null ? 0 : Math.max(0, corresponde - (pagado || 0));
    const deMas = pagado !== null && pagado > corresponde + 1 ? pagado - corresponde : 0;
    return {
      id: c.id,
      fecha: c.fecha,
      paciente: c.paciente?.apellido_y_nombre?.replace(/\s+/g, " ").trim() ?? "(sin nombre)",
      profesionalId: c.profesional_atencion_id ?? "sin-asignar",
      profesional: c.profesional?.nombre ?? "(sin asignar)",
      tipo: [...new Set(lineas.map((p) => p.prestacion))].join(" + "),
      cobrado,
      soloConsulta,
      marcadaSinHonorarios: lineas.some((p) => p.sinHonorarios),
      corresponde,
      estado,
      fechaLiquidacion,
      pagado,
      falta,
      deMas,
      despues: tratamientoDespues(c, practicas, presupuestos),
    };
  });
}

// Por profesional: cantidad, cobrado, lo que corresponde, lo ya liquidado, lo que falta y lo pagado de más.
export function resumenPorProfesional(consultas) {
  const mapa = new Map();
  for (const c of consultas) {
    if (!mapa.has(c.profesionalId)) {
      mapa.set(c.profesionalId, { id: c.profesionalId, nombre: c.profesional, filas: [], cantidad: 0, cobrado: 0, corresponde: 0, falta: 0, deMas: 0, sinHonorarios: 0, montoSinHonorarios: 0, empezaron: 0 });
    }
    const r = mapa.get(c.profesionalId);
    r.filas.push(c);
    r.cantidad += 1;
    r.cobrado += c.cobrado;
    r.corresponde += c.corresponde;
    r.falta += c.falta;
    r.deMas += c.deMas;
    if (c.despues.estado === "empezo" || c.despues.estado === "aceptado") r.empezaron += 1;
    if (c.marcadaSinHonorarios && c.estado === "sin") {
      r.sinHonorarios += 1;
      r.montoSinHonorarios += c.falta;
    }
  }
  return [...mapa.values()]
    .map((r) => ({ ...r, filas: [...r.filas].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.paciente.localeCompare(b.paciente, "es")) }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}
