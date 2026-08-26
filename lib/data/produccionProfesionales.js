import { supabase } from "@/lib/supabaseClient";

export async function obtenerProduccionPorProfesional(fechaInicio, fechaFin) {
  const [
    { data: cobrosGeneral, error: errorGeneral },
    { data: cobrosOrto, error: errorOrto },
    { data: facturacionOS, error: errorOS },
    { data: profesionales, error: errorProf },
  ] = await Promise.all([
    supabase
      .from("caja_general")
      .select("fecha, pago, prestaciones, profesional_atencion_id, paciente:pacientes(apellido_y_nombre)")
      .gte("fecha", fechaInicio)
      .lte("fecha", fechaFin),
    supabase
      .from("caja_ortodoncia")
      .select("fecha, importe, concepto, ortodoncista_id, paciente:pacientes_ortodoncia(nombre)")
      .gte("fecha", fechaInicio)
      .lte("fecha", fechaFin),
    supabase
      .from("facturacion_obras_sociales")
      .select("fecha, valor_os, obra_social, prestacion, profesional_id")
      .gte("fecha", fechaInicio)
      .lte("fecha", fechaFin),
    supabase.from("profesionales").select("id, nombre, especialidad, porcentaje_honorarios_copago, porcentaje_honorarios_os"),
  ]);
  if (errorGeneral) throw errorGeneral;
  if (errorOrto) throw errorOrto;
  if (errorOS) throw errorOS;
  if (errorProf) throw errorProf;

  const porProfesional = {};
  function obtenerEntrada(profesionalId) {
    if (!porProfesional[profesionalId]) {
      const prof = profesionales.find((p) => p.id === profesionalId);
      porProfesional[profesionalId] = {
        profesionalId,
        nombre: prof?.nombre ?? "(sin asignar)",
        especialidad: prof?.especialidad ?? "—",
        porcentajeCopago: Number(prof?.porcentaje_honorarios_copago ?? 30),
        porcentajeOS: Number(prof?.porcentaje_honorarios_os ?? 20),
        cantidadAtenciones: 0,
        totalCopago: 0,
        totalValorOS: 0,
        detalle: [],
      };
    }
    return porProfesional[profesionalId];
  }

  for (const c of cobrosGeneral || []) {
    const entrada = obtenerEntrada(c.profesional_atencion_id || "sin-asignar");
    entrada.cantidadAtenciones += 1;
    entrada.totalCopago += Number(c.pago);
    const conceptoTexto = (c.prestaciones || []).map((p) => p.prestacion).join(", ") || "Plan de financiación";
    entrada.detalle.push({
      fecha: c.fecha,
      paciente: c.paciente?.apellido_y_nombre ?? "—",
      concepto: conceptoTexto,
      monto: Number(c.pago),
      tipo: "Copago/Particular",
    });
  }

  for (const c of cobrosOrto || []) {
    const entrada = obtenerEntrada(c.ortodoncista_id || "sin-asignar");
    entrada.cantidadAtenciones += 1;
    entrada.totalCopago += Number(c.importe);
    entrada.detalle.push({
      fecha: c.fecha,
      paciente: c.paciente?.nombre ?? "—",
      concepto: c.concepto,
      monto: Number(c.importe),
      tipo: "Ortodoncia",
    });
  }

  for (const f of facturacionOS || []) {
    if (!f.profesional_id) continue;
    const entrada = obtenerEntrada(f.profesional_id);
    entrada.totalValorOS += Number(f.valor_os || 0);
    entrada.detalle.push({
      fecha: f.fecha,
      paciente: "—",
      concepto: `${f.prestacion} (${f.obra_social})`,
      monto: Number(f.valor_os || 0),
      tipo: "Obra social (a cobrar del intermediario)",
    });
  }

  const filas = Object.values(porProfesional).map((f) => {
    const honorariosCopago = f.totalCopago * (f.porcentajeCopago / 100);
    const honorariosOS = f.totalValorOS * (f.porcentajeOS / 100);
    return {
      ...f,
      honorariosCopago,
      honorariosOS,
      aLiquidar: honorariosCopago + honorariosOS,
      detalle: f.detalle.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0)),
    };
  });

  filas.sort((a, b) => b.aLiquidar - a.aLiquidar);
  return filas;
}
