import { obtenerHonorariosPorCobro } from "@/lib/data/produccionProfesionales";
import { COLUMNAS_CAJA_GENERAL, COLUMNAS_CAJA_ORTODONCIA, cobrosPorIds, detalleDeCobroGeneral, filasDeCobros } from "@/lib/data/cobrosLiquidados";

// Diferencia que se tolera (redondeos) para dar un cobro por completo.
const TOLERANCIA = 500;

// Todos los cobros de un período (Caja General + Caja Ortodoncia) con lo que le corresponde a cada profesional y su estado de
// liquidación: "liquidado", "parcial" (se le pagó una parte) o "pendiente".
// Los honorarios salen de la MISMA cuenta que Producción. Un cobro puede aparecer más de una vez si se reparte entre dos
// profesionales (una cuota de plan que mezcla especialidades): una fila por profesional.
//   devuelve [{ clave, tipo, grupo ("particular" | "obra_social"), profesionalId, profesional, fecha, paciente, detalle,
//               cobertura, monto, honorarios, liquidado, falta, estado, fechaLiquidacion, calculo, lineas }]
export async function obtenerCobrosConEstadoDeLiquidacion(desde, hasta) {
  const honorarios = await obtenerHonorariosPorCobro(desde, hasta);
  const idsG = Object.keys(honorarios).filter((k) => k.startsWith("g:")).map((k) => k.slice(2));
  const idsO = Object.keys(honorarios).filter((k) => k.startsWith("o:")).map((k) => k.slice(2));
  const columnas =
    "caja_general_id, caja_ortodoncia_id, parcial, honorarios, monto_pagado, tratamiento_saldado, pago_profesional_id, profesional_id, created_at, pago:pagos_profesionales(fecha)";
  const [general, orto, filasG, filasO] = await Promise.all([
    cobrosPorIds("caja_general", COLUMNAS_CAJA_GENERAL, idsG),
    cobrosPorIds("caja_ortodoncia", COLUMNAS_CAJA_ORTODONCIA, idsO),
    filasDeCobros("caja_general_id", idsG, columnas),
    filasDeCobros("caja_ortodoncia_id", idsO, columnas),
  ]);

  const agrupar = (filas, columna) => {
    const mapa = {};
    for (const f of filas) (mapa[f[columna]] ||= []).push(f);
    return mapa;
  };
  const liqG = agrupar(filasG, "caja_general_id");
  const liqO = agrupar(filasO, "caja_ortodoncia_id");

  // Estado a partir de lo calculado y de lo que se anotó en los pagos de ESE profesional.
  function estadoDe(todasLasFilas, profesionalId, honorariosCalculados) {
    const filas = (todasLasFilas || []).filter((f) => !f.profesional_id || f.profesional_id === profesionalId);
    const honorariosAnotados = Number([...filas].reverse().find((f) => f.honorarios != null)?.honorarios ?? 0);
    const honorarios = Math.round(honorariosAnotados || honorariosCalculados);
    if (filas.length === 0) return { estado: "pendiente", honorarios, liquidado: 0, falta: honorarios, fechaLiquidacion: null };
    const completa = filas.find((f) => !f.parcial);
    const ultima = filas[filas.length - 1];
    if (completa) return { estado: "liquidado", honorarios, liquidado: honorarios, falta: 0, fechaLiquidacion: completa.pago?.fecha ?? null };
    const pagado = filas.reduce((a, f) => a + Number(f.monto_pagado || 0), 0);
    const falta = Math.max(0, honorarios - pagado);
    if (falta <= TOLERANCIA) return { estado: "liquidado", honorarios, liquidado: honorarios, falta: 0, fechaLiquidacion: ultima.pago?.fecha ?? null };
    return { estado: "parcial", honorarios, liquidado: pagado, falta, fechaLiquidacion: ultima.pago?.fecha ?? null };
  }

  // Una fila por profesional con honorarios en cada cobro.
  const filasDelCobro = (clave, base, liquidaciones) => {
    const porProfesional = {};
    for (const l of honorarios[clave] || []) (porProfesional[l.profesionalId] ||= []).push(l);
    return Object.entries(porProfesional)
      .map(([profesionalId, lineas]) => ({ profesionalId, lineas, total: lineas.reduce((a, l) => a + l.honorarios, 0) }))
      .filter((p) => p.total > 0) // los cobros sin honorarios (estampilla, etc.) no se liquidan al profesional
      .map((p) => ({
        ...base,
        clave: `${clave}|${p.profesionalId}`,
        profesionalId: p.profesionalId,
        profesional: p.lineas[0].profesional,
        lineas: p.lineas.map((l) => ({ concepto: l.concepto, calculo: l.calculo })),
        calculo: p.lineas.map((l) => l.calculo).join(" + "),
        // Lo que corresponde HOY según la cuenta de Producción (puede diferir de lo anotado al liquidar si cambió algo después).
        calculado: Math.round(p.total),
        ...estadoDe(liquidaciones, p.profesionalId, p.total),
      }));
  };

  const filas = [
    ...general.flatMap((c) =>
      filasDelCobro(
        `g:${c.id}`,
        {
          tipo: "general",
          // Obra social: el copago de un paciente que se atendió por su obra social. Si pagó como particular, va con los particulares.
          grupo: c.tipo === "Obra Social" ? "obra_social" : "particular",
          fecha: c.fecha,
          paciente: c.paciente?.apellido_y_nombre?.trim() ?? "(sin paciente)",
          detalle: detalleDeCobroGeneral(c),
          cobertura: c.cobertura || "—",
          monto: Number(c.pago),
        },
        liqG[c.id]
      )
    ),
    ...orto.flatMap((c) =>
      filasDelCobro(
        `o:${c.id}`,
        {
          tipo: "ortodoncia",
          grupo: "particular",
          fecha: c.fecha,
          paciente: c.paciente?.nombre?.trim() ?? "(sin paciente)",
          detalle: c.concepto || "—",
          cobertura: "Ortodoncia",
          monto: Number(c.importe),
        },
        liqO[c.id]
      )
    ),
  ];
  return filas.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.paciente.localeCompare(b.paciente, "es")));
}

// Cobrado por adelantado que todavía no se pudo ubicar en ningún tratamiento (falta cargar el turno): no se le liquida a nadie.
//   devuelve [{ fecha, paciente, monto }]
export async function obtenerCobradoSinAsignar(desde, hasta) {
  const honorarios = await obtenerHonorariosPorCobro(desde, hasta);
  const cobros = Object.entries(honorarios)
    .filter(([clave, lineas]) => clave.startsWith("g:") && lineas.some((l) => l.origen === "sin_asignar"))
    .map(([clave, lineas]) => ({ id: clave.slice(2), monto: lineas.filter((l) => l.origen === "sin_asignar").reduce((a, l) => a + l.base, 0) }));
  if (cobros.length === 0) return [];
  const datos = await cobrosPorIds("caja_general", COLUMNAS_CAJA_GENERAL, cobros.map((c) => c.id));
  return cobros
    .map((c) => {
      const cobro = datos.find((x) => x.id === c.id);
      return { fecha: cobro?.fecha, paciente: cobro?.paciente?.apellido_y_nombre?.trim() ?? "(sin paciente)", monto: c.monto };
    })
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
}
