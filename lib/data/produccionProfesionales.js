import { supabase } from "@/lib/supabaseClient";
import { obtenerTodosHonorariosEspecialidad } from "@/lib/data/profesionales";

export async function obtenerProduccionPorProfesional(fechaInicio, fechaFin) {
  const [
    { data: cobrosGeneral, error: errorGeneral },
    { data: cobrosOrto, error: errorOrto },
    { data: facturacionOS, error: errorOS },
    { data: profesionales, error: errorProf },
    excepcionesEspecialidad,
  ] = await Promise.all([
    supabase
      .from("caja_general")
      .select(
        "fecha, pago, prestaciones, precio_anterior, profesional_atencion_id, id_documento, tipo_documento, paciente:pacientes(apellido_y_nombre)"
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
      .select("fecha, valor_os, obra_social, prestacion, profesional_id, sin_honorarios")
      .gte("fecha", fechaInicio)
      .lte("fecha", fechaFin),
    supabase.from("profesionales").select("id, nombre, especialidad, porcentaje_honorarios_copago, porcentaje_honorarios_os"),
    // Tabla nueva (excepciones por especialidad) — si todavía no se corrió
    // esa migración, seguimos con el % general de cada profesional en vez
    // de romper toda la pantalla de Producción.
    obtenerTodosHonorariosEspecialidad().catch(() => []),
  ]);
  if (errorGeneral) throw errorGeneral;
  if (errorOrto) throw errorOrto;
  if (errorOS) throw errorOS;
  if (errorProf) throw errorProf;

  // Un pago de cuota de un plan de financiación no dice por sí solo qué
  // especialidad es (no trae prestaciones propias) — pero el presupuesto
  // original del plan sí sabe qué se incluyó. Si el plan mezcla
  // especialidades (ej. una corona + un tratamiento de periodoncia), cada
  // cuota se reparte proporcional al peso de cada especialidad en el total
  // del presupuesto, para poder aplicarle a cada parte el % que le
  // corresponde.
  const numerosPlanAUsar = [
    ...new Set(
      (cobrosGeneral || [])
        .filter((c) => c.tipo_documento === "Plan de financiación" && (c.prestaciones || []).length === 0 && c.id_documento)
        .map((c) => c.id_documento)
    ),
  ];

  const especialidadSharesPorPlan = {};
  if (numerosPlanAUsar.length > 0) {
    const [{ data: planes }, { data: catalogoCompleto }] = await Promise.all([
      supabase.from("planes_financiacion").select("numero_plan, presupuesto_id").in("numero_plan", numerosPlanAUsar),
      supabase.from("catalogo_prestaciones").select("id, especialidad"),
    ]);
    const especialidadPorCatalogoId = {};
    for (const c of catalogoCompleto || []) especialidadPorCatalogoId[c.id] = c.especialidad || "Sin especialidad";

    const presupuestoIdPorPlan = {};
    for (const p of planes || []) presupuestoIdPorPlan[p.numero_plan] = p.presupuesto_id;

    const presupuestoIds = [...new Set(Object.values(presupuestoIdPorPlan).filter(Boolean))];
    const { data: presupuestos } =
      presupuestoIds.length > 0
        ? await supabase.from("presupuestos").select("id, prestaciones").in("id", presupuestoIds)
        : { data: [] };
    const prestacionesPorPresupuesto = {};
    for (const p of presupuestos || []) prestacionesPorPresupuesto[p.id] = p.prestaciones || [];

    for (const numeroPlan of numerosPlanAUsar) {
      const prestacionesPresupuesto = prestacionesPorPresupuesto[presupuestoIdPorPlan[numeroPlan]] || [];
      const totalPresupuesto = prestacionesPresupuesto.reduce((a, p) => a + Number(p.importe || 0), 0);
      if (totalPresupuesto <= 0) continue;
      const porEspecialidad = {};
      for (const p of prestacionesPresupuesto) {
        const esp = especialidadPorCatalogoId[p.catalogoId] || "Sin especialidad";
        porEspecialidad[esp] = (porEspecialidad[esp] || 0) + Number(p.importe || 0);
      }
      especialidadSharesPorPlan[numeroPlan] = Object.entries(porEspecialidad).map(([especialidad, importe]) => ({
        especialidad: especialidad === "Sin especialidad" ? null : especialidad,
        share: importe / totalPresupuesto,
      }));
    }
  }

  // Por profesional, un mapa especialidad -> % de copago que reemplaza al
  // % general de esa persona (ej. Catalina: Periodoncia 50% en vez de su
  // 35% general de Prótesis Fija).
  const excepcionesPorProfesional = {};
  for (const e of excepcionesEspecialidad || []) {
    if (!excepcionesPorProfesional[e.profesional_id]) excepcionesPorProfesional[e.profesional_id] = {};
    excepcionesPorProfesional[e.profesional_id][e.especialidad] = Number(e.porcentaje_copago);
  }

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
        excepcionesEspecialidad: excepcionesPorProfesional[profesionalId] || {},
        cantidadAtenciones: 0,
        totalCopago: 0,
        totalValorOS: 0,
        detalle: [],
      };
    }
    return porProfesional[profesionalId];
  }

  // El % que corresponde a una prestación puntual: el de su especialidad
  // si el profesional tiene una excepción cargada para esa especialidad,
  // si no, el % general del profesional.
  function porcentajeCopagoDe(entrada, especialidad) {
    if (especialidad && entrada.excepcionesEspecialidad[especialidad] !== undefined) {
      return entrada.excepcionesEspecialidad[especialidad];
    }
    return entrada.porcentajeCopago;
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
        // Prestaciones administrativas (estampilla, consulta, etc.) marcadas
        // "sin honorarios": quedan detalladas (queda registrado quién la
        // hizo) pero no suman al total sobre el que se calcula el %.
        if (!p.sinHonorarios) entrada.totalCopago += valorPrestacion;
        entrada.detalle.push({
          fecha: c.fecha,
          paciente: c.paciente?.apellido_y_nombre ?? "—",
          concepto:
            p.prestacion + (Number(p.cantidad) > 1 ? ` x${p.cantidad}` : "") + (p.sinHonorarios ? " (sin honorarios)" : ""),
          monto: valorPrestacion,
          tipo: "Copago/Particular",
          sinHonorarios: Boolean(p.sinHonorarios),
          especialidad: p.especialidad || null,
        });
      }
    } else if (prestaciones.length === 0 && especialidadSharesPorPlan[c.id_documento]) {
      // Cuota de un plan cuyo presupuesto mezcla especialidades: se reparte
      // proporcional al peso de cada una en el total del presupuesto.
      const paciente = c.paciente?.apellido_y_nombre ?? "—";
      for (const { especialidad, share } of especialidadSharesPorPlan[c.id_documento]) {
        const monto = Number(c.pago) * share;
        entrada.totalCopago += monto;
        entrada.detalle.push({
          fecha: c.fecha,
          paciente,
          concepto: `Plan de financiación${especialidad ? ` — ${especialidad}` : ""}`,
          monto,
          tipo: "Copago/Particular",
          sinHonorarios: false,
          especialidad,
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
        sinHonorarios: false,
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
      sinHonorarios: false,
    });
  }

  for (const f of facturacionOS || []) {
    if (!f.profesional_id) continue;
    const entrada = obtenerEntrada(f.profesional_id);
    if (!f.sin_honorarios) entrada.totalValorOS += Number(f.valor_os || 0);
    entrada.detalle.push({
      fecha: f.fecha,
      paciente: "—",
      concepto: `${f.prestacion} (${f.obra_social})${f.sin_honorarios ? " (sin honorarios)" : ""}`,
      monto: Number(f.valor_os || 0),
      tipo: "Obra social (a cobrar del intermediario)",
      sinHonorarios: Boolean(f.sin_honorarios),
    });
  }

  // Regla del negocio: el copago/particular se liquida en el día, la obra
  // social se liquida a mes vencido (recién cuando la clínica cobra del
  // intermediario) — por eso "aLiquidar" (lo que se paga hoy) NO incluye
  // los honorarios de obra social, que quedan aparte como "pendiente".
  const filas = Object.values(porProfesional).map((f) => {
    const honorariosOS = f.totalValorOS * (f.porcentajeOS / 100);
    const detalleConHonorarios = f.detalle
      .map((d) => {
        if (d.sinHonorarios) return { ...d, montoHonorarios: 0 };
        const porcentaje =
          d.tipo === "Obra social (a cobrar del intermediario)" ? f.porcentajeOS : porcentajeCopagoDe(f, d.especialidad);
        return { ...d, montoHonorarios: d.monto * (porcentaje / 100) };
      })
      .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
    // Se suma el honorario ya calculado línea por línea (respetando la
    // excepción por especialidad de cada una) en vez de aplicar un único %
    // sobre el total — así conviven distintos % dentro del mismo profesional.
    const honorariosCopago = detalleConHonorarios
      .filter((d) => d.tipo !== "Obra social (a cobrar del intermediario)")
      .reduce((acc, d) => acc + d.montoHonorarios, 0);
    return {
      ...f,
      honorariosCopago,
      honorariosOS,
      aLiquidar: honorariosCopago,
      detalle: detalleConHonorarios,
    };
  });

  filas.sort((a, b) => b.aLiquidar - a.aLiquidar);
  return filas;
}
