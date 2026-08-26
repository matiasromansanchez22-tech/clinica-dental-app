import { supabase } from "@/lib/supabaseClient";

export async function obtenerProduccionPorProfesional(fechaInicio, fechaFin) {
  const [{ data: cobrosGeneral, error: errorGeneral }, { data: cobrosOrto, error: errorOrto }, { data: profesionales, error: errorProf }] =
    await Promise.all([
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
      supabase.from("profesionales").select("id, nombre, especialidad, porcentaje_honorarios"),
    ]);
  if (errorGeneral) throw errorGeneral;
  if (errorOrto) throw errorOrto;
  if (errorProf) throw errorProf;

  const porProfesional = {};
  function obtenerEntrada(profesionalId) {
    if (!porProfesional[profesionalId]) {
      const prof = profesionales.find((p) => p.id === profesionalId);
      porProfesional[profesionalId] = {
        profesionalId,
        nombre: prof?.nombre ?? "(sin asignar)",
        especialidad: prof?.especialidad ?? "—",
        porcentajeHonorarios: Number(prof?.porcentaje_honorarios ?? 30),
        cantidadAtenciones: 0,
        totalFacturado: 0,
        detalle: [],
      };
    }
    return porProfesional[profesionalId];
  }

  for (const c of cobrosGeneral || []) {
    const entrada = obtenerEntrada(c.profesional_atencion_id || "sin-asignar");
    entrada.cantidadAtenciones += 1;
    entrada.totalFacturado += Number(c.pago);
    const conceptoTexto = (c.prestaciones || []).map((p) => p.prestacion).join(", ") || "Plan de financiación";
    entrada.detalle.push({
      fecha: c.fecha,
      paciente: c.paciente?.apellido_y_nombre ?? "—",
      concepto: conceptoTexto,
      monto: Number(c.pago),
    });
  }

  for (const c of cobrosOrto || []) {
    const entrada = obtenerEntrada(c.ortodoncista_id || "sin-asignar");
    entrada.cantidadAtenciones += 1;
    entrada.totalFacturado += Number(c.importe);
    entrada.detalle.push({
      fecha: c.fecha,
      paciente: c.paciente?.nombre ?? "—",
      concepto: c.concepto,
      monto: Number(c.importe),
    });
  }

  const filas = Object.values(porProfesional).map((f) => ({
    ...f,
    aLiquidar: f.totalFacturado * (f.porcentajeHonorarios / 100),
    detalle: f.detalle.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0)),
  }));

  filas.sort((a, b) => b.totalFacturado - a.totalFacturado);
  return filas;
}
