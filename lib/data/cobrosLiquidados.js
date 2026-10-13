import { supabase } from "@/lib/supabaseClient";
import { fechaDeHoyISO, sumarDias } from "@/lib/agenda";

const DIAS_ATRAS = 60;

// Cobros de un profesional (los que atendió él/ella) que todavía no se marcaron como
// liquidados, de los últimos 60 días, para tildar cuáles cubre un pago. Mira las dos
// cajas: General (profesional que atendió) y Ortodoncia (ortodoncista).
//   devuelve [{ clave: "g:<id>" | "o:<id>", tipo, id, fecha, paciente, detalle, cobertura, monto }]
export async function obtenerCobrosPendientesDeLiquidar(profesionalId) {
  const desde = sumarDias(fechaDeHoyISO(), -DIAS_ATRAS);
  const [general, orto, liquidados] = await Promise.all([
    supabase
      .from("caja_general")
      .select("id, fecha, pago, cobertura, modalidad, id_documento, numero_cuota, prestaciones, paciente:pacientes(apellido_y_nombre)")
      .eq("profesional_atencion_id", profesionalId)
      .gte("fecha", desde)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("caja_ortodoncia")
      .select("id, fecha, importe, concepto, paciente:pacientes_ortodoncia(nombre)")
      .eq("ortodoncista_id", profesionalId)
      .gte("fecha", desde)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.from("cobros_liquidados").select("caja_general_id, caja_ortodoncia_id"),
  ]);
  for (const r of [general, orto, liquidados]) if (r.error) throw r.error;

  const yaGeneral = new Set(liquidados.data.map((l) => l.caja_general_id).filter(Boolean));
  const yaOrto = new Set(liquidados.data.map((l) => l.caja_ortodoncia_id).filter(Boolean));

  const filas = [
    ...general.data
      .filter((c) => !yaGeneral.has(c.id))
      .map((c) => ({
        clave: `g:${c.id}`,
        tipo: "general",
        id: c.id,
        fecha: c.fecha,
        paciente: c.paciente?.apellido_y_nombre?.trim() ?? "(sin paciente)",
        detalle:
          c.modalidad === "Plan de financiación"
            ? `Plan ${c.id_documento} · ${c.numero_cuota === "Anticipo" ? "Anticipo" : c.numero_cuota == null ? "Pago del plan" : `Cuota ${c.numero_cuota}`}`
            : (c.prestaciones || []).map((p) => p.prestacion).join(", ") || "—",
        cobertura: c.cobertura || "—",
        monto: Number(c.pago),
      })),
    ...orto.data
      .filter((c) => !yaOrto.has(c.id))
      .map((c) => ({
        clave: `o:${c.id}`,
        tipo: "ortodoncia",
        id: c.id,
        fecha: c.fecha,
        paciente: c.paciente?.nombre?.trim() ?? "(sin paciente)",
        detalle: c.concepto || "—",
        cobertura: "Ortodoncia",
        monto: Number(c.importe),
      })),
  ];
  return filas.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
}

// Deja marcados como liquidados los cobros elegidos, atados al pago que los cubre.
// `cobros`: [{ tipo: "general" | "ortodoncia", id }]
//   tratamientoSaldado: con este pago se saldó todo el tratamiento ("Tratamiento saldado ✓")
export async function marcarCobrosLiquidados(pagoId, cobros, { tratamientoSaldado = false } = {}) {
  if (!pagoId || !cobros?.length) return;
  const filas = cobros.map((c) => ({
    pago_profesional_id: pagoId,
    ...(c.tipo === "ortodoncia" ? { caja_ortodoncia_id: c.id } : { caja_general_id: c.id }),
    ...(tratamientoSaldado ? { tratamiento_saldado: true } : {}),
  }));
  const { error } = await supabase.from("cobros_liquidados").insert(filas);
  if (error) throw error;
}

// Para mostrar "Liquidado ✓" en una lista de cobros: devuelve un mapa
// { [idDelCobro]: { fecha, profesional, pagoId } }.
//   tipo: "general" | "ortodoncia"
export async function obtenerLiquidacionesDeCobros(tipo, ids) {
  if (!ids?.length) return {};
  const columna = tipo === "ortodoncia" ? "caja_ortodoncia_id" : "caja_general_id";
  const mapa = {};
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase
      .from("cobros_liquidados")
      .select(`${columna}, pago_profesional_id, tratamiento_saldado, pago:pagos_profesionales(fecha, monto, profesional:profesionales(nombre))`)
      .in(columna, ids.slice(i, i + 200));
    if (error) throw error;
    for (const f of data) {
      mapa[f[columna]] = {
        tratamientoSaldado: Boolean(f.tratamiento_saldado),
        pagoId: f.pago_profesional_id,
        fecha: f.pago?.fecha ?? null,
        profesional: f.pago?.profesional?.nombre ?? null,
      };
    }
  }
  return mapa;
}

// Todas las marcas de liquidado, para cruzar con una lista grande de cobros (Buscar cobros):
// { general: { [idCobro]: { fecha, profesional, pagoId } }, ortodoncia: { ... } }.
export async function obtenerTodasLasLiquidaciones() {
  const resultado = { general: {}, ortodoncia: {} };
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase
      .from("cobros_liquidados")
      .select("caja_general_id, caja_ortodoncia_id, pago_profesional_id, tratamiento_saldado, pago:pagos_profesionales(fecha, profesional:profesionales(nombre))")
      .range(desde, desde + 999);
    if (error) throw error;
    for (const f of data) {
      const info = { tratamientoSaldado: Boolean(f.tratamiento_saldado), pagoId: f.pago_profesional_id, fecha: f.pago?.fecha ?? null, profesional: f.pago?.profesional?.nombre ?? null };
      if (f.caja_general_id) resultado.general[f.caja_general_id] = info;
      if (f.caja_ortodoncia_id) resultado.ortodoncia[f.caja_ortodoncia_id] = info;
    }
    if (data.length < 1000) break;
  }
  return resultado;
}

// Los cobros que cubre cada pago (para el Historial de pagos): { [pagoId]: [{ paciente, detalle, monto }] }.
export async function obtenerCobrosDePagos(pagoIds) {
  if (!pagoIds?.length) return {};
  const mapa = {};
  for (let i = 0; i < pagoIds.length; i += 100) {
    const { data, error } = await supabase
      .from("cobros_liquidados")
      .select(
        `pago_profesional_id, tratamiento_saldado,
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
            detalle:
              g.modalidad === "Plan de financiación"
                ? `Plan ${g.id_documento} · ${g.numero_cuota === "Anticipo" ? "Anticipo" : g.numero_cuota == null ? "Pago del plan" : `Cuota ${g.numero_cuota}`}`
                : (g.prestaciones || []).map((p) => p.prestacion).join(", ") || "—",
            monto: Number(g.pago),
          }
        : o
          ? { fecha: o.fecha, paciente: o.paciente?.nombre?.trim() ?? "(sin paciente)", detalle: o.concepto || "—", monto: Number(o.importe) }
          : null;
      if (!item) continue;
      (mapa[f.pago_profesional_id] ||= []).push({ ...item, tratamientoSaldado: Boolean(f.tratamiento_saldado) });
    }
  }
  return mapa;
}

// Saca la marca de liquidado de un cobro (por si se tildó por error).
export async function desmarcarCobroLiquidado(tipo, cobroId) {
  const columna = tipo === "ortodoncia" ? "caja_ortodoncia_id" : "caja_general_id";
  const { error } = await supabase.from("cobros_liquidados").delete().eq(columna, cobroId);
  if (error) throw error;
}
