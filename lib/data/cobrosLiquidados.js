import { supabase } from "@/lib/supabaseClient";
import { fechaDeHoyISO, sumarDias } from "@/lib/agenda";
import { obtenerHonorariosPorCobro } from "@/lib/data/produccionProfesionales";

const DIAS_ATRAS = 60;
// Diferencia que se tolera (redondeos) para considerar que un cobro quedó completo.
const TOLERANCIA = 500;

export function detalleDeCobroGeneral(g) {
  return g.modalidad === "Plan de financiación"
    ? `Plan ${g.id_documento} · ${g.numero_cuota === "Anticipo" ? "Anticipo" : g.numero_cuota == null ? "Pago del plan" : `Cuota ${g.numero_cuota}`}`
    : (g.prestaciones || []).map((p) => p.prestacion).join(", ") || "—";
}

// Trae de a tandas las filas de cobros_liquidados de una lista de cobros (para no pasarse del largo de la consulta).
export async function filasDeCobros(columna, ids, columnas) {
  const filas = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase
      .from("cobros_liquidados")
      .select(columnas)
      .in(columna, ids.slice(i, i + 100))
      .order("created_at", { ascending: true });
    if (error) throw error;
    filas.push(...data);
  }
  return filas;
}

// Junta las filas de un mismo cobro: si alguna es "completa" el cobro quedó liquidado; si todas son
// parciales, queda pendiente y se calcula cuánto se le pagó y cuánto falta.
export function consolidarCobro(filas) {
  const completa = filas.find((f) => !f.parcial);
  const ultima = filas[filas.length - 1];
  const base = {
    pagoId: (completa || ultima).pago_profesional_id,
    fecha: (completa || ultima).pago?.fecha ?? null,
    profesional: (completa || ultima).pago?.profesional?.nombre ?? null,
  };
  if (completa) return { ...base, parcial: false, tratamientoSaldado: Boolean(completa.tratamiento_saldado) };
  const pagado = filas.reduce((a, f) => a + Number(f.monto_pagado || 0), 0);
  const honorarios = Number([...filas].reverse().find((f) => f.honorarios != null)?.honorarios ?? 0);
  return { ...base, parcial: true, tratamientoSaldado: false, pagado, honorarios, falta: Math.max(0, honorarios - pagado) };
}

// Trae por id los cobros de una tabla (en tandas, para no pasarse del largo de la consulta).
export async function cobrosPorIds(tabla, columnas, ids) {
  const filas = [];
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase.from(tabla).select(columnas).in("id", ids.slice(i, i + 100));
    if (error) throw error;
    filas.push(...data);
  }
  return filas;
}

export const COLUMNAS_CAJA_GENERAL =
  "id, fecha, pago, tipo, cobertura, modalidad, id_documento, numero_cuota, prestaciones, paciente:pacientes(apellido_y_nombre)";
export const COLUMNAS_CAJA_ORTODONCIA = "id, fecha, importe, concepto, paciente:pacientes_ortodoncia(nombre)";

// Cobros que todavía no se le liquidaron por completo a un profesional, de los últimos 60 días, para tildar cuáles cubre un
// pago. Los honorarios salen de la MISMA cuenta que Producción: un cobro aparece en la lista de cada profesional que tenga
// honorarios en él (una cuota de plan puede repartirse entre dos). Incluye los que se le pagaron solo en parte.
//   devuelve [{ clave: "g:<id>" | "o:<id>", tipo, id, fecha, paciente, detalle, cobertura, monto, honorarios, yaPagado,
//               falta, lineas: [{ concepto, calculo }], otrosProfesionales: [nombre] }]
export async function obtenerCobrosPendientesDeLiquidar(profesionalId) {
  const hoy = fechaDeHoyISO();
  const desde = sumarDias(hoy, -DIAS_ATRAS);
  const honorarios = await obtenerHonorariosPorCobro(desde, hoy);

  const suyas = {};
  for (const [clave, lineas] of Object.entries(honorarios)) {
    const mias = lineas.filter((l) => l.profesionalId === profesionalId && l.honorarios > 0);
    if (mias.length) suyas[clave] = mias;
  }
  const idsG = Object.keys(suyas).filter((k) => k.startsWith("g:")).map((k) => k.slice(2));
  const idsO = Object.keys(suyas).filter((k) => k.startsWith("o:")).map((k) => k.slice(2));
  const columnas = "caja_general_id, caja_ortodoncia_id, parcial, honorarios, monto_pagado, pago_profesional_id, profesional_id, created_at";
  const [general, orto, filasG, filasO] = await Promise.all([
    cobrosPorIds("caja_general", COLUMNAS_CAJA_GENERAL, idsG),
    cobrosPorIds("caja_ortodoncia", COLUMNAS_CAJA_ORTODONCIA, idsO),
    filasDeCobros("caja_general_id", idsG, columnas),
    filasDeCobros("caja_ortodoncia_id", idsO, columnas),
  ]);

  // Solo cuentan las marcas de liquidado de ESTE profesional.
  const agrupar = (filas, columna) => {
    const mapa = {};
    for (const f of filas) {
      if (f.profesional_id && f.profesional_id !== profesionalId) continue;
      (mapa[f[columna]] ||= []).push(f);
    }
    return mapa;
  };
  const liqG = agrupar(filasG, "caja_general_id");
  const liqO = agrupar(filasO, "caja_ortodoncia_id");

  // Para un cobro con pagos anteriores: lo que ya se le pagó y lo que falta.
  const situacion = (filas, honorariosCalculados) => {
    if (!filas) return { honorarios: honorariosCalculados, yaPagado: 0, falta: honorariosCalculados, pendiente: true };
    if (filas.some((f) => !f.parcial)) return { pendiente: false };
    const c = consolidarCobro(filas);
    const honorarios = c.honorarios || honorariosCalculados;
    const falta = Math.max(0, honorarios - c.pagado);
    return { honorarios, yaPagado: c.pagado, falta, pendiente: falta > TOLERANCIA };
  };
  const detalleExtra = (clave) => {
    const mias = suyas[clave];
    const otros = [...new Set((honorarios[clave] || []).filter((l) => l.profesionalId !== profesionalId && l.honorarios > 0).map((l) => l.profesional))];
    return { lineas: mias.map((l) => ({ concepto: l.concepto, calculo: l.calculo })), otrosProfesionales: otros };
  };
  const suma = (clave) => Math.round(suyas[clave].reduce((a, l) => a + l.honorarios, 0));

  const filas = [
    ...general
      .map((c) => ({ c, clave: `g:${c.id}`, s: situacion(liqG[c.id], suma(`g:${c.id}`)) }))
      .filter(({ s }) => s.pendiente && s.honorarios > 0)
      .map(({ c, clave, s }) => ({
        clave,
        tipo: "general",
        id: c.id,
        fecha: c.fecha,
        paciente: c.paciente?.apellido_y_nombre?.trim() ?? "(sin paciente)",
        detalle: detalleDeCobroGeneral(c),
        cobertura: c.cobertura || "—",
        monto: Number(c.pago),
        honorarios: s.honorarios,
        yaPagado: s.yaPagado,
        falta: s.falta,
        ...detalleExtra(clave),
      })),
    ...orto
      .map((c) => ({ c, clave: `o:${c.id}`, s: situacion(liqO[c.id], suma(`o:${c.id}`)) }))
      .filter(({ s }) => s.pendiente && s.honorarios > 0)
      .map(({ c, clave, s }) => ({
        clave,
        tipo: "ortodoncia",
        id: c.id,
        fecha: c.fecha,
        paciente: c.paciente?.nombre?.trim() ?? "(sin paciente)",
        detalle: c.concepto || "—",
        cobertura: "Ortodoncia",
        monto: Number(c.importe),
        honorarios: s.honorarios,
        yaPagado: s.yaPagado,
        falta: s.falta,
        ...detalleExtra(clave),
      })),
  ];
  return filas.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
}

// Deja marcados como liquidados los cobros elegidos, atados al pago que los cubre.
// `cobros`: [{ tipo: "general" | "ortodoncia", id, parcial, honorarios, montoPagado }]
//   parcial: este pago NO completa lo que le corresponde por ese cobro (queda pendiente lo que falta)
//   honorarios: lo que le corresponde por ese cobro · montoPagado: lo que se le pagó por él en este pago
//   tratamientoSaldado: con este pago se saldó todo el tratamiento ("Tratamiento saldado ✓")
export async function marcarCobrosLiquidados(pagoId, cobros, { tratamientoSaldado = false } = {}) {
  if (!pagoId || !cobros?.length) return;
  // El profesional de la marca es el del pago (a quién se le está liquidando).
  const { data: pago, error: errorPago } = await supabase.from("pagos_profesionales").select("profesional_id").eq("id", pagoId).single();
  if (errorPago) throw errorPago;
  const filas = cobros.map((c) => ({
    pago_profesional_id: pagoId,
    profesional_id: pago.profesional_id,
    ...(c.tipo === "ortodoncia" ? { caja_ortodoncia_id: c.id } : { caja_general_id: c.id }),
    ...(tratamientoSaldado && !c.parcial ? { tratamiento_saldado: true } : {}),
    parcial: Boolean(c.parcial),
    honorarios: c.honorarios ?? null,
    monto_pagado: c.montoPagado ?? null,
  }));
  const { error } = await supabase.from("cobros_liquidados").insert(filas);
  if (error) throw error;
}

const SELECT_LIQUIDACION =
  "pago_profesional_id, tratamiento_saldado, parcial, honorarios, monto_pagado, created_at, pago:pagos_profesionales(fecha, monto, profesional:profesionales(nombre))";

// Para mostrar "Liquidado ✓" (o "Parcial") en una lista de cobros: devuelve un mapa
// { [idDelCobro]: { fecha, profesional, pagoId, parcial, ... } }. Si el cobro se pagó solo en parte,
// `parcial` es true y trae `pagado`, `honorarios` y `falta`.
//   tipo: "general" | "ortodoncia"
export async function obtenerLiquidacionesDeCobros(tipo, ids) {
  if (!ids?.length) return {};
  const columna = tipo === "ortodoncia" ? "caja_ortodoncia_id" : "caja_general_id";
  const filas = await filasDeCobros(columna, ids, `${columna}, ${SELECT_LIQUIDACION}`);
  const porCobro = {};
  for (const f of filas) (porCobro[f[columna]] ||= []).push(f);
  return Object.fromEntries(Object.entries(porCobro).map(([id, lista]) => [id, consolidarCobro(lista)]));
}

// Todas las marcas de liquidado, para cruzar con una lista grande de cobros (Buscar cobros):
// { general: { [idCobro]: { fecha, profesional, pagoId, parcial } }, ortodoncia: { ... } }.
export async function obtenerTodasLasLiquidaciones() {
  const porGeneral = {};
  const porOrtodoncia = {};
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase
      .from("cobros_liquidados")
      .select(`caja_general_id, caja_ortodoncia_id, ${SELECT_LIQUIDACION}`)
      .order("created_at", { ascending: true })
      .range(desde, desde + 999);
    if (error) throw error;
    for (const f of data) {
      if (f.caja_general_id) (porGeneral[f.caja_general_id] ||= []).push(f);
      if (f.caja_ortodoncia_id) (porOrtodoncia[f.caja_ortodoncia_id] ||= []).push(f);
    }
    if (data.length < 1000) break;
  }
  const consolidar = (mapa) => Object.fromEntries(Object.entries(mapa).map(([id, lista]) => [id, consolidarCobro(lista)]));
  return { general: consolidar(porGeneral), ortodoncia: consolidar(porOrtodoncia) };
}

// Los cobros que cubre cada pago (para el Historial de pagos): { [pagoId]: [{ paciente, detalle, monto, ... }] }.
// Si el pago cubrió solo una parte de un cobro, `parcial` es true y trae `honorarios` y `montoPagado`.
export async function obtenerCobrosDePagos(pagoIds) {
  if (!pagoIds?.length) return {};
  const mapa = {};
  for (let i = 0; i < pagoIds.length; i += 100) {
    const { data, error } = await supabase
      .from("cobros_liquidados")
      .select(
        `pago_profesional_id, tratamiento_saldado, parcial, honorarios, monto_pagado,
         general:caja_general(fecha, pago, modalidad, id_documento, numero_cuota, prestaciones, paciente:pacientes(apellido_y_nombre)),
         ortodoncia:caja_ortodoncia(fecha, importe, concepto, paciente:pacientes_ortodoncia(nombre))`
      )
      .in("pago_profesional_id", pagoIds.slice(i, i + 100));
    if (error) throw error;
    for (const f of data) {
      const g = f.general;
      const o = f.ortodoncia;
      const item = g
        ? {
            fecha: g.fecha,
            paciente: g.paciente?.apellido_y_nombre?.trim() ?? "(sin paciente)",
            detalle: detalleDeCobroGeneral(g),
            monto: Number(g.pago),
          }
        : o
          ? { fecha: o.fecha, paciente: o.paciente?.nombre?.trim() ?? "(sin paciente)", detalle: o.concepto || "—", monto: Number(o.importe) }
          : null;
      if (!item) continue;
      (mapa[f.pago_profesional_id] ||= []).push({
        ...item,
        tratamientoSaldado: Boolean(f.tratamiento_saldado),
        parcial: Boolean(f.parcial),
        honorarios: f.honorarios != null ? Number(f.honorarios) : null,
        montoPagado: f.monto_pagado != null ? Number(f.monto_pagado) : null,
      });
    }
  }
  return mapa;
}

// Cobros que se le pagaron a un profesional solo en parte y todavía no se completaron, con lo que falta
// (de todos los tiempos). Para la pantalla de Liquidaciones por profesional.
//   devuelve [{ clave, profesionalId, paciente, detalle, fecha, honorarios, pagado, falta }]
export async function obtenerLiquidacionesParcialesPendientes() {
  const parciales = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase
      .from("cobros_liquidados")
      .select(
        `caja_general_id, caja_ortodoncia_id, parcial, honorarios, monto_pagado, pago_profesional_id, profesional_id, created_at,
         general:caja_general(fecha, pago, modalidad, id_documento, numero_cuota, prestaciones, profesional_atencion_id, paciente:pacientes(apellido_y_nombre)),
         ortodoncia:caja_ortodoncia(fecha, importe, concepto, ortodoncista_id, paciente:pacientes_ortodoncia(nombre))`
      )
      .eq("parcial", true)
      .order("created_at", { ascending: true })
      .range(desde, desde + 999);
    if (error) throw error;
    parciales.push(...data);
    if (data.length < 1000) break;
  }
  if (parciales.length === 0) return [];

  // Los cobros que después se completaron con un pago "total" ya no cuentan.
  const idsG = [...new Set(parciales.map((f) => f.caja_general_id).filter(Boolean))];
  const idsO = [...new Set(parciales.map((f) => f.caja_ortodoncia_id).filter(Boolean))];
  const [completasG, completasO] = await Promise.all([
    filasDeCobros("caja_general_id", idsG, "caja_general_id, parcial, profesional_id"),
    filasDeCobros("caja_ortodoncia_id", idsO, "caja_ortodoncia_id, parcial, profesional_id"),
  ]);
  const completos = new Set([
    ...completasG.filter((f) => !f.parcial).map((f) => `g:${f.caja_general_id}|${f.profesional_id || ""}`),
    ...completasO.filter((f) => !f.parcial).map((f) => `o:${f.caja_ortodoncia_id}|${f.profesional_id || ""}`),
  ]);

  const porCobro = new Map();
  for (const f of parciales) {
    const claveCobro = f.caja_general_id ? `g:${f.caja_general_id}` : `o:${f.caja_ortodoncia_id}`;
    const clave = `${claveCobro}|${f.profesional_id || ""}`;
    if (completos.has(clave)) continue;
    const g = f.general;
    const o = f.ortodoncia;
    const e = porCobro.get(clave) || {
      clave,
      profesionalId: f.profesional_id || (g ? g.profesional_atencion_id : o?.ortodoncista_id),
      paciente: g ? g.paciente?.apellido_y_nombre?.trim() ?? "(sin paciente)" : o?.paciente?.nombre?.trim() ?? "(sin paciente)",
      detalle: g ? detalleDeCobroGeneral(g) : o?.concepto || "—",
      fecha: g ? g.fecha : o?.fecha,
      honorarios: 0,
      pagado: 0,
    };
    e.pagado += Number(f.monto_pagado || 0);
    if (f.honorarios != null) e.honorarios = Number(f.honorarios);
    porCobro.set(clave, e);
  }
  return [...porCobro.values()]
    .map((e) => ({ ...e, falta: Math.max(0, e.honorarios - e.pagado) }))
    .filter((e) => e.falta > TOLERANCIA);
}

// Saca la marca de liquidado de un cobro (por si se tildó por error). Saca también sus pagos parciales.
export async function desmarcarCobroLiquidado(tipo, cobroId) {
  const columna = tipo === "ortodoncia" ? "caja_ortodoncia_id" : "caja_general_id";
  const { error } = await supabase.from("cobros_liquidados").delete().eq(columna, cobroId);
  if (error) throw error;
}
