import { supabase } from "@/lib/supabaseClient";
import { obtenerTodosHonorariosEspecialidad } from "@/lib/data/profesionales";

function normalizarTexto(t) {
  return (t || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

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
        "id, fecha, pago, prestaciones, precio_anterior, profesional_atencion_id, paciente_id, id_documento, tipo_documento, paciente:pacientes(apellido_y_nombre)"
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
  // especialidades (ej. una corona + un tratamiento de periodoncia), hay
  // que repartir cada cuota entre ellas (ver "asignacionesPorCobro" más
  // abajo).
  const numerosPlanAUsar = [
    ...new Set(
      (cobrosGeneral || [])
        .filter((c) => c.tipo_documento === "Plan de financiación" && (c.prestaciones || []).length === 0 && c.id_documento)
        .map((c) => c.id_documento)
    ),
  ];

  // Cuenta corriente por plan: en vez de repartir cada cuota por el % que
  // cada especialidad representa en el plan ENTERO (lo que le daba crédito
  // a una especialidad aunque todavía no hubiera arrancado), cada
  // especialidad se activa recién desde la fecha de su primer turno
  // cargado, y el dinero cobrado se va usando en orden — primero para
  // cubrir lo más viejo. Si nunca hay un turno que identifique una
  // especialidad, se la trata como activa desde el arranque del plan (el
  // comportamiento de siempre), para no dejar plata sin asignar para
  // siempre por falta de un turno cargado.
  //
  // Esto necesita mirar la historia COMPLETA del plan (no solo el período
  // que se está mirando en pantalla) para saber cuánto se lleva cobrado y
  // cuánto se lleva asignado hasta el momento de cada cuota.
  const asignacionesPorCobro = {};
  if (numerosPlanAUsar.length > 0) {
    const [{ data: planes }, { data: catalogoCompleto }] = await Promise.all([
      supabase.from("planes_financiacion").select("numero_plan, presupuesto_id, fecha, paciente_id").in("numero_plan", numerosPlanAUsar),
      supabase.from("catalogo_prestaciones").select("id, especialidad"),
    ]);
    const especialidadPorCatalogoId = {};
    for (const c of catalogoCompleto || []) especialidadPorCatalogoId[c.id] = c.especialidad || "Sin especialidad";

    const infoPorPlan = {};
    for (const p of planes || []) infoPorPlan[p.numero_plan] = p;

    const presupuestoIds = [...new Set((planes || []).map((p) => p.presupuesto_id).filter(Boolean))];
    const pacienteIds = [...new Set((planes || []).map((p) => p.paciente_id).filter(Boolean))];

    const [{ data: presupuestos }, { data: todosLosCobrosDeEstosPlanes }, { data: turnosRelevantes }] = await Promise.all([
      presupuestoIds.length > 0
        ? supabase.from("presupuestos").select("id, prestaciones").in("id", presupuestoIds)
        : Promise.resolve({ data: [] }),
      // Toda la historia de cobros de estos planes, no solo la del período
      // visible — para saber cuánto se lleva cobrado hasta cada cuota.
      supabase
        .from("caja_general")
        .select("id, fecha, pago, id_documento, prestaciones")
        .eq("tipo_documento", "Plan de financiación")
        .in("id_documento", numerosPlanAUsar)
        .order("fecha", { ascending: true }),
      pacienteIds.length > 0
        ? supabase
            .from("turnos_general")
            .select("paciente_id, fecha, profesional_de_turno_id, prestaciones")
            .in("paciente_id", pacienteIds)
            .lte("fecha", fechaFin)
            .neq("estado", "Cancelado")
            .order("fecha", { ascending: true })
        : Promise.resolve({ data: [] }),
    ]);
    const prestacionesPorPresupuesto = {};
    for (const p of presupuestos || []) prestacionesPorPresupuesto[p.id] = p.prestaciones || [];

    for (const numeroPlan of numerosPlanAUsar) {
      const info = infoPorPlan[numeroPlan];
      if (!info) continue;
      const prestacionesPresupuesto = prestacionesPorPresupuesto[info.presupuesto_id] || [];
      if (prestacionesPresupuesto.length === 0) continue;

      const turnosPaciente = (turnosRelevantes || []).filter((t) => t.paciente_id === info.paciente_id);

      // Un segmento por cada PRESTACIÓN del presupuesto, no por especialidad
      // agrupada — si no, dos trabajos de la misma especialidad hechos por
      // profesionales distintos (ej. una corona la hizo Catalina y una
      // prótesis parcial la hizo Agustín, ambas "Prótesis") se mezclarían
      // en un solo bloque y se le acreditaría todo al primero.
      const segmentos = prestacionesPresupuesto
        .map((linea, indice) => {
          const especialidad = especialidadPorCatalogoId[linea.catalogoId] || null;
          const nombreNormalizado = normalizarTexto(linea.prestacion);
          let fechaEfectiva = info.fecha;
          let profesionalId = null;
          for (const t of turnosPaciente) {
            if (t.fecha < info.fecha) continue;
            const coincide = (t.prestaciones || []).some((p) => normalizarTexto(p.prestacion) === nombreNormalizado);
            if (coincide) {
              fechaEfectiva = t.fecha;
              profesionalId = t.profesional_de_turno_id;
              break;
            }
          }
          return {
            clave: indice,
            especialidad: especialidad === "Sin especialidad" ? null : especialidad,
            nombrePrestacion: linea.prestacion,
            valorCatalogo: Number(linea.importe || 0),
            fechaEfectiva,
            profesionalId,
          };
        })
        .filter((s) => s.valorCatalogo > 0);
      if (segmentos.length === 0) continue;

      const asignado = {};
      for (const s of segmentos) asignado[s.clave] = 0;
      let pool = 0;

      // Si algún cobro de este plan trae prestaciones propias (algo puntual
      // cargado aparte del plan), ese ya se liquida solo por esas
      // prestaciones más abajo — no se suma dos veces a la cuenta corriente.
      const cobrosDelPlan = (todosLosCobrosDeEstosPlanes || []).filter(
        (c) => c.id_documento === numeroPlan && (c.prestaciones || []).length === 0
      );
      for (const cobro of cobrosDelPlan) {
        const poolAntes = pool;
        pool += Number(cobro.pago);
        const activos = segmentos.filter((s) => s.fechaEfectiva <= cobro.fecha && asignado[s.clave] < s.valorCatalogo);
        const grupos = {};
        for (const s of activos) {
          if (!grupos[s.fechaEfectiva]) grupos[s.fechaEfectiva] = [];
          grupos[s.fechaEfectiva].push(s);
        }
        const asignacionesEsteCobro = [];
        for (const fecha of Object.keys(grupos).sort()) {
          if (pool <= 0) break;
          const grupo = grupos[fecha];
          const necesidadTotalGrupo = grupo.reduce((a, s) => a + (s.valorCatalogo - asignado[s.clave]), 0);
          if (necesidadTotalGrupo <= 0) continue;
          const usarParaGrupo = Math.min(pool, necesidadTotalGrupo);
          for (const s of grupo) {
            const necesidad = s.valorCatalogo - asignado[s.clave];
            if (necesidad <= 0) continue;
            const monto = usarParaGrupo * (necesidad / necesidadTotalGrupo);
            asignado[s.clave] += monto;
            pool -= monto;
            asignacionesEsteCobro.push({
              especialidad: s.especialidad,
              nombrePrestacion: s.nombrePrestacion,
              monto,
              profesionalId: s.profesionalId,
            });
          }
        }
        // Lo que de ESTA cuota queda sin poder ubicar en ninguna especialidad
        // activa (cobrado por adelantado, sin un tratamiento cargado todavía
        // que lo identifique) queda pendiente — se va a terminar de repartir
        // solo cuando se cargue el turno correspondiente y entre la próxima
        // cuota (el sobrante viejo de cuotas anteriores no se vuelve a
        // mostrar acá, solo lo que aportó esta cuota puntual).
        const sinAsignarDeEstaCuota = Math.max(0, pool - poolAntes);
        asignacionesPorCobro[cobro.id] = { asignaciones: asignacionesEsteCobro, sinAsignar: sinAsignarDeEstaCuota };
      }
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
    } else if (prestaciones.length === 0 && asignacionesPorCobro[c.id]) {
      // Cuota de un plan cuyo presupuesto mezcla especialidades: en vez de
      // repartir por el % que cada especialidad representa en el plan
      // entero, se le acredita a cada profesional según lo que ya tiene
      // efectivamente cobrado la cuenta corriente de esa especialidad
      // (ver el cálculo de "asignacionesPorCobro" más arriba) — así no se
      // le acredita a nadie una especialidad que todavía no arrancó.
      const paciente = c.paciente?.apellido_y_nombre ?? "—";
      const { asignaciones, sinAsignar } = asignacionesPorCobro[c.id];
      for (const { especialidad, nombrePrestacion, monto, profesionalId } of asignaciones) {
        const entradaEspecialidad = obtenerEntrada(profesionalId || c.profesional_atencion_id || "sin-asignar");
        entradaEspecialidad.totalCopago += monto;
        entradaEspecialidad.detalle.push({
          fecha: c.fecha,
          paciente,
          concepto: `Plan de financiación — ${nombrePrestacion}`,
          monto,
          tipo: "Copago/Particular",
          sinHonorarios: false,
          especialidad,
        });
      }
      // Plata de esta cuota que todavía no se pudo ubicar en ninguna
      // especialidad activa (el paciente pagó por adelantado y todavía no
      // se cargó el turno del tratamiento) — queda a la vista, sin
      // comisionarle a nadie, hasta que se pueda identificar.
      if (sinAsignar > 1) {
        const entradaSinAsignar = obtenerEntrada("sin-asignar");
        entradaSinAsignar.totalCopago += sinAsignar;
        entradaSinAsignar.detalle.push({
          fecha: c.fecha,
          paciente,
          concepto: "Plan de financiación — cobrado por adelantado, pendiente de identificar el tratamiento",
          monto: sinAsignar,
          tipo: "Copago/Particular",
          sinHonorarios: true,
          especialidad: null,
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
