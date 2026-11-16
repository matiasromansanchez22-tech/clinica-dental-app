import { supabase } from "@/lib/supabaseClient";

// Cuánto pagó el paciente por cada trabajo de laboratorio y cuánto queda limpio después del mecánico.
//
// Cómo se calcula (los pacientes pagan casi siempre en cuotas, con un plan de financiación):
//  1. Se busca el presupuesto aceptado del paciente que incluye ese trabajo (la corona, la incrustación, la prótesis...). El importe de
//     ese ítem es lo que se PACTÓ con el paciente (no el precio de lista del catálogo).
//  2. Lo cobrado se reparte en proporción: si el plan va pagado al 60 %, se toma el 60 % del importe de ese ítem. (Un plan puede
//     mezclar varios trabajos: perno, corona, provisorio, y cada uno recibe la parte que le corresponde.)
//  3. Si el paciente pagó sin plan (cobro directo de la prestación), se toma ese cobro.
//  4. Limpio = cobrado − lo que cobra el mecánico. Es ANTES de los honorarios del profesional.

const norm = (t) =>
  String(t || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

// Familia del trabajo (qué es) y su detalle (material / tipo), a partir de lo que dice el trabajo y la prestación vinculada.
const FAMILIAS = [
  ["corona", /corona/],
  ["incrustacion", /incrustaci/],
  ["protesis", /protesis|\bppr\b|dentadura|removible/],
  ["puente", /puente/],
  ["carilla", /carilla/],
];
const DETALLES = [
  ["cromo", /cromo|cobalto|metalic/],
  ["flexible", /flexible/],
  ["acrilica", /acril/],
  ["zirconio", /zirconi/],
  ["ceramage", /ceramage|porcelana|ceramica/],
  ["completa", /complet/],
  ["parcial", /parcial/],
];

function etiquetas(texto) {
  const t = norm(texto);
  const familia = FAMILIAS.find(([, re]) => re.test(t))?.[0] || null;
  const detalles = DETALLES.filter(([, re]) => re.test(t)).map(([k]) => k);
  return { t, familia, detalles };
}

// Ítems del presupuesto que corresponden a un trabajo: primero por nombre igual, después por familia (corona, incrustación...)
// afinando por detalle. Devuelve { items, confianza: "alta" | "media", aviso }.
export function itemsDelTrabajo(trabajo, presupuesto) {
  const items = presupuesto.prestaciones || [];
  const nombreCatalogo = norm(trabajo.catalogo?.prestacion);
  const nombreTrabajo = norm(trabajo.tipoTrabajo);
  const exactos = items.filter((i) => {
    const n = norm(i.prestacion);
    return n && (n === nombreCatalogo || n === nombreTrabajo);
  });
  if (exactos.length) return { items: exactos, confianza: "alta", aviso: null };

  const del = etiquetas(`${trabajo.catalogo?.prestacion || ""} ${trabajo.tipoTrabajo || ""}`);
  // Los trabajos que el mecánico anota solo como «Ceramage» son coronas de ceramage; se toma así, avisando para revisar.
  let avisoSupuesto = null;
  if (!del.familia && del.detalles.includes("ceramage")) {
    del.familia = "corona";
    avisoSupuesto = `Revisar: el trabajo dice «${trabajo.tipoTrabajo}»; se tomó como corona`;
  }
  if (!del.familia) return { items: [], confianza: null, aviso: null };
  const deFamilia = items.filter((i) => etiquetas(i.prestacion).familia === del.familia);
  if (!deFamilia.length) return { items: [], confianza: null, aviso: null };

  // Afinar por detalle (cromo, flexible, acrílica, zirconio, completa/parcial...)
  const detallesClave = del.detalles.filter((d) => ["cromo", "flexible", "acrilica", "zirconio", "completa", "parcial"].includes(d));
  const afinados = detallesClave.length
    ? deFamilia.filter((i) => {
        const d = etiquetas(i.prestacion).detalles;
        return detallesClave.every((k) => d.includes(k));
      })
    : deFamilia;
  if (afinados.length) return { items: afinados, confianza: avisoSupuesto ? "media" : "alta", aviso: avisoSupuesto };

  // Hay de la misma familia pero con otro material: se usa igual, marcándolo para revisar.
  const dicePresupuesto = deFamilia.map((i) => i.prestacion).join(" / ");
  return { items: deFamilia, confianza: "media", aviso: `Revisar: el presupuesto dice «${dicePresupuesto}»` };
}

const sumaImporte = (items) => items.reduce((s, i) => s + (Number(i.importe) || 0), 0);

// Calcula lo cobrado de un trabajo. presupuestos / planes / cobros son los del paciente.
export function calcularFinanzasDeTrabajo(trabajo, { presupuestos = [], planes = [], cobros = [] }) {
  const base = { pactado: null, cobrado: null, falta: null, plan: null, origen: null, aviso: null, presupuesto: null };

  // 1) Presupuestos aceptados que incluyen el trabajo; se elige el más cercano a la fecha en que arrancó el trabajo.
  const candidatos = presupuestos
    .filter((p) => p.estado === "Aceptado")
    .map((p) => ({ p, r: itemsDelTrabajo(trabajo, p) }))
    .filter((x) => x.r.items.length > 0);
  if (candidatos.length) {
    const ref = new Date(`${trabajo.fechaInicio}T12:00:00`).getTime();
    candidatos.sort((a, b) => Math.abs(new Date(`${a.p.fecha}T12:00:00`).getTime() - ref) - Math.abs(new Date(`${b.p.fecha}T12:00:00`).getTime() - ref));
    const { p, r } = candidatos[0];
    const pactado = sumaImporte(r.items);
    const plan = planes.find((pl) => pl.presupuesto_id === p.id && pl.estado_plan !== "Cancelado") || null;
    let cobrado = null;
    let planTexto = null;
    if (plan && Number(plan.total_tratamiento) > 0) {
      const fraccion = Math.min(1, Math.max(0, Number(plan.total_pagado) / Number(plan.total_tratamiento)));
      cobrado = Math.round(pactado * fraccion);
      planTexto = `${plan.numero_plan}: pagó ${Math.round(fraccion * 100)}% (cuotas ${plan.cuotas_pagadas}/${plan.cantidad_cuotas})`;
    } else if (p.modalidad_pago === "Contado") {
      // Contado sin plan registrado: no hay forma segura de saber qué se cobró de este presupuesto.
      planTexto = "Presupuesto de contado sin plan: revisar el cobro";
    }
    return {
      ...base,
      pactado,
      cobrado,
      falta: cobrado === null ? null : Math.max(0, pactado - cobrado),
      plan: planTexto,
      origen: "presupuesto",
      aviso: r.aviso,
      presupuesto: p.numero,
    };
  }

  // 2) Sin presupuesto: cobro directo de la prestación (ej. "Incrustación de zirconio" cobrada en caja).
  const nombre = norm(trabajo.catalogo?.prestacion || trabajo.tipoTrabajo);
  const directos = cobros.filter((c) => (c.prestaciones || []).some((i) => norm(i.prestacion) === nombre));
  if (directos.length) {
    const pactado = directos.reduce((s, c) => s + (c.prestaciones || []).filter((i) => norm(i.prestacion) === nombre).reduce((x, i) => x + (Number(i.valor) || 0) * (Number(i.cantidad) || 1), 0), 0);
    const cobrado = directos.reduce((s, c) => s + (Number(c.pago) || 0), 0);
    const saldo = directos.reduce((s, c) => s + (Number(c.saldo_pendiente) || 0), 0);
    return { ...base, pactado, cobrado, falta: saldo, plan: null, origen: "cobro", aviso: null, presupuesto: null };
  }
  return base;
}

export const lineaLimpio = ({ cobrado, pactado }, costo) => ({
  hoy: cobrado !== null && costo > 0 ? cobrado - costo : null,
  final: pactado !== null && costo > 0 ? pactado - costo : null,
});

async function traerPorPacientes(tabla, columnas, ids, extra) {
  const filas = [];
  for (let i = 0; i < ids.length; i += 150) {
    let q = supabase.from(tabla).select(columnas).in("paciente_id", ids.slice(i, i + 150));
    if (extra) q = extra(q);
    const { data, error } = await q;
    if (error) throw error;
    filas.push(...data);
  }
  return filas;
}

// Para una lista de trabajos (ya mapeados con mapearTrabajo), devuelve { [trabajoId]: finanzas }.
export async function obtenerFinanzasDeTrabajos(trabajos) {
  const generales = trabajos.filter((t) => t.tipoPaciente !== "Ortodoncia" && t.pacienteId);
  const ids = [...new Set(generales.map((t) => t.pacienteId))];
  if (ids.length === 0) return {};
  const [presupuestos, planes, cobros] = await Promise.all([
    traerPorPacientes("presupuestos", "id, numero, paciente_id, estado, prestaciones, total, modalidad_pago, fecha", ids),
    traerPorPacientes("planes_financiacion", "id, numero_plan, paciente_id, presupuesto_id, estado_plan, total_tratamiento, total_pagado, saldo_pendiente, cuotas_pagadas, cantidad_cuotas", ids),
    traerPorPacientes("caja_general", "id, paciente_id, fecha, pago, saldo_pendiente, prestaciones, tipo_documento", ids),
  ]);
  const por = (lista) => {
    const m = {};
    for (const f of lista) (m[f.paciente_id] ||= []).push(f);
    return m;
  };
  const pp = por(presupuestos);
  const pl = por(planes);
  const pc = por(cobros);
  const resultado = {};
  for (const t of generales) {
    resultado[t.id] = calcularFinanzasDeTrabajo(t, { presupuestos: pp[t.pacienteId] || [], planes: pl[t.pacienteId] || [], cobros: pc[t.pacienteId] || [] });
  }
  return resultado;
}
