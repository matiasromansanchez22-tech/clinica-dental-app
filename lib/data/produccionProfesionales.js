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
      .select(
        "fecha, pago, prestaciones, precio_anterior, profesional_atencion_id, paciente:pacientes(apellido_y_nombre)"
      )
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

  // Regla del negocio (definida con Matías): se liquida por el valor de
  // catálogo de cada prestación efectivamente cargada, no por lo que
  // terminó pagando el paciente en ese cobro — así un descuento o una
  // financiación no le cambia al profesional lo que le corresponde por lo
  // que hizo, y de paso incentiva a cargar bien detallado qué se hizo.
  // Los pagos de cuota de un plan de financiación no traen prestaciones
  // propias (ya se definieron en el presupuesto), así que ahí se sigue
  // usando lo efectivamente cobrado en esa cuota. Excepción temporal
  // (mientras se termina de acomodar la lista de precios nueva): un cobro
  // marcado "precio anterior" también se liquida por lo cobrado, aunque
  // tenga prestaciones cargadas, porque el valor de catálogo ya no
  // coincide con lo que realmente se le cobró al paciente.
  for (const c of cobrosGeneral || []) {
    const entrada = obtenerEntrada(c.profesional_atencion_id || "sin-asignar");
    entrada.cantidadAtenciones += 1;
    const prestaciones = c.prestaciones || [];
    if (prestaciones.length > 0 && !c.precio_anterior) {
      for (const p of prestaciones) {
        const valorPrestacion = Number(p.valor || 0) * Number(p.cantidad || 1);
        entrada.totalCopago += valorPrestacion;
        entrada.detalle.push({
          fecha: c.fecha,
          paciente: c.paciente?.apellido_y_nombre ?? "—",
          concepto: p.prestacion + (Number(p.cantidad) > 1 ? ` x${p.cantidad}` : ""),
          monto: valorPrestacion,
          tipo: "Copago/Particular",
        });
      }
    } else {
      const conceptoTexto = prestaciones.length > 0
        ? `${prestaciones.map((p) => p.prestacion).join(", ")} (precio anterior)`
        : "Plan de financiación";
      entrada.totalCopago += Number(c.pago);
      entrada.detalle.push({
        fecha: c.fecha,
        paciente: c.paciente?.apellido_y_nombre ?? "—",
        concepto: conceptoTexto,
        monto: Number(c.pago),
        tipo: "Copago/Particular",
      });
    }
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

  // Regla del negocio: el copago/particular se liquida en el día, la obra
  // social se liquida a mes vencido (recién cuando la clínica cobra del
  // intermediario) — por eso "aLiquidar" (lo que se paga hoy) NO incluye
  // los honorarios de obra social, que quedan aparte como "pendiente".
  const filas = Object.values(porProfesional).map((f) => {
    const honorariosCopago = f.totalCopago * (f.porcentajeCopago / 100);
    const honorariosOS = f.totalValorOS * (f.porcentajeOS / 100);
    return {
      ...f,
      honorariosCopago,
      honorariosOS,
      aLiquidar: honorariosCopago,
      detalle: f.detalle.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0)),
    };
  });

  filas.sort((a, b) => b.aLiquidar - a.aLiquidar);
  return filas;
}
