import { supabase } from "@/lib/supabaseClient";
import { obtenerTodosHonorariosEspecialidad } from "@/lib/data/profesionales";
import { detalleDeCobroGeneral, filasDeCobros, honorariosDeCobroGeneral } from "@/lib/data/cobrosLiquidados";

// Diferencia que se tolera (redondeos) para dar un cobro por completo.
const TOLERANCIA = 500;

async function traerTodo(armarConsulta) {
  const filas = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await armarConsulta().range(desde, desde + 999);
    if (error) throw error;
    filas.push(...data);
    if (data.length < 1000) break;
  }
  return filas;
}

// Todos los cobros de un período (Caja General + Caja Ortodoncia), cada uno con su estado de
// liquidación al profesional que atendió: "liquidado", "parcial" (se le pagó una parte) o "pendiente".
//   devuelve [{ clave, tipo, grupo ("particular" | "obra_social"), profesionalId, profesional, fecha, paciente, detalle, cobertura, monto,
//               honorarios, liquidado, falta, estado, fechaLiquidacion }]
// "honorarios" es lo que le corresponde al profesional por ese cobro: el valor que se anotó al tildarlo en un
// pago o, si todavía no se tildó, una estimación con su % (y sus excepciones por especialidad).
export async function obtenerCobrosConEstadoDeLiquidacion(desde, hasta) {
  const [general, orto, profesionales, excepcionesLista] = await Promise.all([
    traerTodo(() =>
      supabase
        .from("caja_general")
        .select("id, fecha, pago, tipo, cobertura, modalidad, id_documento, numero_cuota, prestaciones, precio_anterior, profesional_atencion_id, paciente:pacientes(apellido_y_nombre)")
        .gte("fecha", desde)
        .lte("fecha", hasta)
        .order("fecha")
    ),
    traerTodo(() =>
      supabase
        .from("caja_ortodoncia")
        .select("id, fecha, importe, descuento_referido, descuento_fidelidad, concepto, ortodoncista_id, paciente:pacientes_ortodoncia(nombre)")
        .gte("fecha", desde)
        .lte("fecha", hasta)
        .order("fecha")
    ),
    supabase.from("profesionales").select("id, nombre, porcentaje_honorarios_copago").then(({ data, error }) => {
      if (error) throw error;
      return data;
    }),
    obtenerTodosHonorariosEspecialidad().catch(() => []),
  ]);

  const profPorId = Object.fromEntries(profesionales.map((p) => [p.id, p]));
  const excepcionesPorProf = {};
  for (const e of excepcionesLista) (excepcionesPorProf[e.profesional_id] ||= {})[e.especialidad] = Number(e.porcentaje_copago);

  const columnas =
    "caja_general_id, caja_ortodoncia_id, parcial, honorarios, monto_pagado, tratamiento_saldado, pago_profesional_id, created_at, pago:pagos_profesionales(fecha)";
  const [filasG, filasO] = await Promise.all([
    filasDeCobros("caja_general_id", general.map((c) => c.id), columnas),
    filasDeCobros("caja_ortodoncia_id", orto.map((c) => c.id), columnas),
  ]);
  const agrupar = (filas, columna) => {
    const mapa = {};
    for (const f of filas) (mapa[f[columna]] ||= []).push(f);
    return mapa;
  };
  const liqG = agrupar(filasG, "caja_general_id");
  const liqO = agrupar(filasO, "caja_ortodoncia_id");

  // Estado de un cobro a partir de lo estimado y de lo que se anotó en los pagos.
  function estadoDe(filas, honorariosEstimados) {
    const honorariosAnotados = Number([...(filas || [])].reverse().find((f) => f.honorarios != null)?.honorarios ?? 0);
    const honorarios = Math.round(honorariosAnotados || honorariosEstimados);
    if (!filas) return { estado: "pendiente", honorarios, liquidado: 0, falta: honorarios, fechaLiquidacion: null };
    const completa = filas.find((f) => !f.parcial);
    const ultima = filas[filas.length - 1];
    if (completa) return { estado: "liquidado", honorarios, liquidado: honorarios, falta: 0, fechaLiquidacion: completa.pago?.fecha ?? null };
    const pagado = filas.reduce((a, f) => a + Number(f.monto_pagado || 0), 0);
    const falta = Math.max(0, honorarios - pagado);
    if (falta <= TOLERANCIA) return { estado: "liquidado", honorarios, liquidado: honorarios, falta: 0, fechaLiquidacion: ultima.pago?.fecha ?? null };
    return { estado: "parcial", honorarios, liquidado: pagado, falta, fechaLiquidacion: ultima.pago?.fecha ?? null };
  }

  const nombreDe = (id) => (id ? profPorId[id]?.nombre ?? "(sin asignar)" : "(sin asignar)");
  const porcentajeDe = (id) => Number(profPorId[id]?.porcentaje_honorarios_copago ?? 30);

  const filas = [
    ...general.map((c) => {
      const id = c.profesional_atencion_id;
      const estimado = honorariosDeCobroGeneral(c, porcentajeDe(id), excepcionesPorProf[id] || {});
      return {
        clave: `g:${c.id}`,
        tipo: "general",
        // Obra social: el copago de un paciente que se atendió por su obra social. Si pagó como particular, va con los particulares.
        grupo: c.tipo === "Obra Social" ? "obra_social" : "particular",
        profesionalId: id || "sin-asignar",
        profesional: nombreDe(id),
        fecha: c.fecha,
        paciente: c.paciente?.apellido_y_nombre?.trim() ?? "(sin paciente)",
        detalle: detalleDeCobroGeneral(c),
        cobertura: c.cobertura || "—",
        monto: Number(c.pago),
        ...estadoDe(liqG[c.id], estimado),
      };
    }),
    ...orto.map((c) => {
      const id = c.ortodoncista_id;
      // Plan de referidos y tarjeta de fidelidad: los honorarios se calculan sobre el valor normal.
      const valorNormal = Number(c.importe) + Number(c.descuento_referido || 0) + Number(c.descuento_fidelidad || 0);
      return {
        clave: `o:${c.id}`,
        tipo: "ortodoncia",
        grupo: "particular",
        profesionalId: id || "sin-asignar",
        profesional: nombreDe(id),
        fecha: c.fecha,
        paciente: c.paciente?.nombre?.trim() ?? "(sin paciente)",
        detalle: c.concepto || "—",
        cobertura: "Ortodoncia",
        monto: Number(c.importe),
        ...estadoDe(liqO[c.id], (valorNormal * porcentajeDe(id)) / 100),
      };
    }),
  ];
  return filas.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.paciente.localeCompare(b.paciente, "es")));
}
