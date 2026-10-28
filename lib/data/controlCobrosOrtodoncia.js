import { supabase } from "@/lib/supabaseClient";
import { fechaDeHoyISO } from "@/lib/agenda";
import { ESTADOS_ASISTENCIA, situacionDelTurno } from "@/lib/data/seguimientoOrtodoncia";
import { horaLocalDe } from "@/lib/diaHora";
import { REDONDEO_CUOTA, calcularCuotaConAumento, cuotaControlSugerida } from "@/lib/ortodoncia";

// Control de cobros de Ortodoncia: compara los turnos de Control del mes con lo que debería haberse cobrado y lo que
// realmente se registró en caja. Sirve para ver si hay plata que no se está registrando (pacientes que vinieron y no figura
// el pago) o que se cobró de menos.
//
// Reglas:
//  · Se mira a cada paciente con turnos de "Control" agendados en el mes.
//  · Lo que debería cobrarse por control es el valor de control de su ficha; si ya le tocaba el aumento (próximo aumento
//    anterior a la fecha del turno), la cuota con aumento redondeada a la centena (igual que en Caja).
//  · Un mes está "cubierto" si el paciente tiene algún cobro ese mes (Control, instalación, continuación, etc.: a veces el turno
//    figura como Control pero lo que se cobra es una cuota de la instalación), o si la grilla de Controles lo marca pago
//    (cubre los pagos adelantados).

export const TIPOS_CONTROL = {
  SIN_PAGO: "Vino y no figura el pago",
  DE_MENOS: "Cobrado de menos",
  DE_MAS: "Cobrado de más",
  OK: "Cobrado bien",
  POR_VENIR: "Por venir",
  NO_VINO: "No vino (o sin marcar)",
  COBRO_SIN_VISITA: "Cobró pero no figura que vino",
  SIN_VALOR: "Sin valor de control en la ficha",
};

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

async function traerTodo(consulta) {
  const filas = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await consulta().range(desde, desde + 999);
    if (error) throw error;
    filas.push(...data);
    if (data.length < 1000) break;
  }
  return filas;
}

function rangoDelMes(mesISO) {
  const [anio, mes] = mesISO.split("-").map(Number);
  return { desde: `${mesISO}-01`, hasta: `${mesISO}-${String(new Date(anio, mes, 0).getDate()).padStart(2, "0")}` };
}

function valorConAumento(valorControl, proximoAumento, fechaTurno, porcentaje, tope = null) {
  const base = Number(valorControl) || 0;
  if (!base) return 0;
  if (proximoAumento && proximoAumento < fechaTurno) return calcularCuotaConAumento(base, porcentaje, tope);
  return base;
}

export async function obtenerControlCobrosOrtodoncia(mesISO) {
  const hoy = fechaDeHoyISO();
  const { desde, hasta } = rangoDelMes(mesISO);
  const anio = Number(mesISO.slice(0, 4));
  const colMes = MESES[Number(mesISO.slice(5)) - 1];

  const [turnos, cobros, pacientes, config, grilla, perfilesFilas] = await Promise.all([
    traerTodo(() =>
      supabase
        .from("turnos_ortodoncia")
        .select("id, fecha, hora_inicio, consultorio, concepto, estado, presencia, asistencia, paciente_id, ortodoncista:profesionales!ortodoncista_id(nombre)")
        .gte("fecha", desde)
        .lte("fecha", hasta)
        .eq("estado", "Agendado")
    ),
    traerTodo(() =>
      supabase
        .from("caja_ortodoncia")
        .select("id, fecha, concepto, importe, cantidad_controles_abonados, paciente_id, medio_pago, created_at, usuario_id, bracket_reposicion, cantidad_brackets, observaciones, descuento_referido, descuento_fidelidad")
        .gte("fecha", desde)
        .lte("fecha", hasta)
    ),
    traerTodo(() =>
      supabase
        .from("pacientes_ortodoncia")
        .select("id, nombre, valor_control, tipo_brackets, ultimo_aumento, proximo_aumento, origen_paciente, ortodoncista:profesionales!ortodoncista_id(nombre)")
    ),
    supabase.from("configuracion_ortodoncia").select("clave, valor"),
    traerTodo(() => supabase.from("controles_ortodoncia").select(`paciente_id, ${colMes}`).eq("anio", anio)),
    // Quién cargó cada cobro (si el rol no puede leer los perfiles, simplemente no se muestra el nombre).
    supabase.from("perfiles").select("id, nombre").then((r) => r.data || []),
  ]);
  const nombreDePerfil = Object.fromEntries(perfilesFilas.map((p) => [p.id, p.nombre]));
  const cfg = Object.fromEntries((config.data || []).map((c) => [c.clave, Number(c.valor)]));
  const porcentaje = Number(cfg.aumento_porcentaje ?? 25);
  // Saldo a favor aplicado a cada cobro (explica cobros por menos del valor).
  const idsCobros = cobros.map((c) => c.id);
  const saldoAplicado = {};
  for (let i = 0; i < idsCobros.length; i += 100) {
    const { data: lote } = await supabase
      .from("saldos_a_favor")
      .select("caja_ortodoncia_id, monto")
      .in("caja_ortodoncia_id", idsCobros.slice(i, i + 100))
      .lt("monto", 0);
    for (const s of lote || []) saldoAplicado[s.caja_ortodoncia_id] = (saldoAplicado[s.caja_ortodoncia_id] || 0) + Math.abs(Number(s.monto));
  }
  const pacientePorId = Object.fromEntries(pacientes.map((p) => [p.id, p]));
  const marcadoEnGrilla = new Set(grilla.filter((g) => g[colMes]).map((g) => g.paciente_id));

  // Un registro por paciente que tenga un turno de Control en el mes o un cobro de Control en el mes.
  const CONCEPTOS_DE_CONTROL = ["Control", "Continuación de ortodoncia"];
  const idsPacientes = new Set([
    ...turnos.filter((t) => t.concepto === "Control").map((t) => t.paciente_id),
    ...cobros.filter((c) => CONCEPTOS_DE_CONTROL.includes(c.concepto)).map((c) => c.paciente_id),
  ]);
  const filas = [];
  for (const id of idsPacientes) {
    if (!id) continue;
    const p = pacientePorId[id];
    const suyosTurnos = turnos.filter((t) => t.paciente_id === id && t.concepto === "Control");
    const suyosCobros = cobros.filter((c) => c.paciente_id === id);
    const asistidos = suyosTurnos.filter((t) => situacionDelTurno(t, hoy) === ESTADOS_ASISTENCIA.ASISTIO);
    const porVenir = suyosTurnos.filter((t) => situacionDelTurno(t, hoy) === ESTADOS_ASISTENCIA.POR_VENIR);
    const noVino = suyosTurnos.filter((t) => [ESTADOS_ASISTENCIA.NO_ASISTIO, ESTADOS_ASISTENCIA.SIN_MARCAR].includes(situacionDelTurno(t, hoy)));
    const fechaRef = (suyosTurnos[0] || { fecha: hoy }).fecha;
    const valorUnitario = valorConAumento(p?.valor_control, p?.proximo_aumento, fechaRef, porcentaje, cuotaControlSugerida(p?.tipo_brackets, cfg));
    const cobrosControl = suyosCobros.filter((c) => c.concepto === "Control");
    const cobradoControl = cobrosControl.reduce((a, c) => a + Number(c.importe || 0), 0);
    // Si en un mismo cobro pagó varios controles (adelanto), cubre más meses que este: no es "cobrado de más".
    const controlesAbonados = cobrosControl.reduce((a, c) => a + (Number(c.cantidad_controles_abonados) || 1), 0);
    const hayCobro = suyosCobros.length > 0;
    // Vino en el mes a otra prestación que no es Control (consulta, instalación, etc.): el cobro es de esa visita.
    const vinoAOtraPrestacion = turnos.some(
      (t) => t.paciente_id === id && t.concepto !== "Control" && situacionDelTurno(t, hoy) === ESTADOS_ASISTENCIA.ASISTIO
    );
    const cubierto = hayCobro || marcadoEnGrilla.has(id);
    // Lo que "debería" cobrarse: los controles a los que vino (y, si no vino ninguno, los que faltan venir).
    const cantidadEsperada = asistidos.length || porVenir.length || (hayCobro ? 1 : 0);
    const esperado = valorUnitario * (asistidos.length || porVenir.length);

    // El día en que se aplicó el aumento, una diferencia de hasta la mitad del redondeo ($2.500) se debe al redondeo de la cuota nueva.
    const dentroDelRedondeo =
      Boolean(p?.ultimo_aumento) && suyosTurnos.some((t) => t.fecha === p.ultimo_aumento) && Math.abs(cobradoControl - esperado) <= REDONDEO_CUOTA / 2;

    let tipo;
    let diferencia = 0;
    if (!valorUnitario && (asistidos.length || porVenir.length)) tipo = TIPOS_CONTROL.SIN_VALOR;
    else if (asistidos.length > 0) {
      if (!cubierto) {
        tipo = TIPOS_CONTROL.SIN_PAGO;
        diferencia = esperado;
      } else if (dentroDelRedondeo && controlesAbonados <= asistidos.length) {
        tipo = TIPOS_CONTROL.OK;
      } else if (cobradoControl > 0 && controlesAbonados <= asistidos.length && cobradoControl < esperado - 1) {
        tipo = TIPOS_CONTROL.DE_MENOS;
        diferencia = esperado - cobradoControl;
      } else if (cobradoControl > esperado + 1 && controlesAbonados <= asistidos.length) {
        tipo = TIPOS_CONTROL.DE_MAS;
        diferencia = cobradoControl - esperado;
      } else tipo = TIPOS_CONTROL.OK;
    } else if (porVenir.length > 0) tipo = TIPOS_CONTROL.POR_VENIR;
    else if (hayCobro) tipo = vinoAOtraPrestacion ? TIPOS_CONTROL.OK : TIPOS_CONTROL.COBRO_SIN_VISITA;
    else tipo = TIPOS_CONTROL.NO_VINO;

    // A qué se debe la diferencia: brackets cobrados, cargo extra anotado en el cobro y saldo a favor aplicado.
    const explicacion = [];
    if (tipo === TIPOS_CONTROL.DE_MAS || tipo === TIPOS_CONTROL.DE_MENOS) {
      for (const c of cobrosControl) {
        if (c.bracket_reposicion && Number(c.cantidad_brackets) > 0) {
          const precio = Number(cfg[/porcelana/i.test(c.bracket_reposicion) ? "precio_bracket_porcelana" : "precio_bracket_metalico"]) || 0;
          if (precio) explicacion.push({ texto: `${c.cantidad_brackets} bracket${c.cantidad_brackets > 1 ? "s" : ""} ${c.bracket_reposicion.toLowerCase()} despegado${c.cantidad_brackets > 1 ? "s" : ""}`, monto: precio * Number(c.cantidad_brackets) });
        }
        const extra = /Cargo extra:\s*(.*?)\s*\(\$([\d.,]+)\)/i.exec(c.observaciones || "");
        if (extra) explicacion.push({ texto: `Cargo extra${extra[1] ? `: ${extra[1]}` : ""}`, monto: Number(extra[2].replace(/[.,]/g, "")) || 0 });
        if (saldoAplicado[c.id]) explicacion.push({ texto: "Saldo a favor aplicado", monto: -saldoAplicado[c.id] });
        // Plan de referidos: el descuento autorizado explica que se haya cobrado menos.
        if (Number(c.descuento_referido) > 0) explicacion.push({ texto: "Descuento por referido", monto: -Number(c.descuento_referido) });
        if (Number(c.descuento_fidelidad) > 0) explicacion.push({ texto: "Descuento por tarjeta de fidelidad", monto: -Number(c.descuento_fidelidad) });
      }
    }
    const explicado = explicacion.reduce((a, e) => a + e.monto, 0);
    // En "cobrado de más" lo explicado suma; en "de menos" el saldo aplicado resta de lo que falta.
    const sinExplicar = tipo === TIPOS_CONTROL.DE_MAS ? diferencia - explicado : tipo === TIPOS_CONTROL.DE_MENOS ? diferencia + explicado : 0;

    filas.push({
      id,
      paciente: p?.nombre ?? "(paciente)",
      ortodoncista: p?.ortodoncista?.nombre ?? suyosTurnos[0]?.ortodoncista?.nombre ?? "Sin asignar",
      turnos: suyosTurnos
        .map((t) => ({
          fecha: t.fecha,
          hora: (t.hora_inicio || "").slice(0, 5),
          consultorio: t.consultorio,
          ortodoncista: t.ortodoncista?.nombre ?? null,
          situacion: situacionDelTurno(t, hoy),
        }))
        .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora)),
      // Cada cobro del mes con su día, la hora en que se cargó y quién lo cargó.
      cobros: suyosCobros
        .map((c) => ({
          fecha: c.fecha,
          hora: horaLocalDe(c.created_at),
          concepto: c.concepto,
          importe: Number(c.importe || 0),
          medio: c.medio_pago,
          cargadoPor: nombreDePerfil[c.usuario_id] || null,
        }))
        .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora)),
      asistio: asistidos.length,
      porVenir: porVenir.length,
      valorUnitario,
      esperado,
      cobrado: cobradoControl,
      cobradoTotal: suyosCobros.reduce((a, c) => a + Number(c.importe || 0), 0),
      coberturaPorGrilla: !hayCobro && marcadoEnGrilla.has(id),
      tipo,
      diferencia,
      explicacion,
      sinExplicar,
      esContinuacion: p?.origen_paciente === "Continuación de otra clínica",
    });
  }

  const suma = (lista, campo) => lista.reduce((a, f) => a + f[campo], 0);
  const deTipo = (t) => filas.filter((f) => f.tipo === t);
  const resumen = {
    turnosControl: turnos.filter((t) => t.concepto === "Control").length,
    asistieron: suma(filas, "asistio"),
    porVenir: suma(filas, "porVenir"),
    esperadoAsistidos: suma(filas.filter((f) => f.asistio > 0), "esperado"),
    esperadoPorVenir: suma(filas.filter((f) => f.asistio === 0 && f.porVenir > 0), "esperado"),
    cobradoControles: cobros.filter((c) => c.concepto === "Control").reduce((a, c) => a + Number(c.importe || 0), 0),
    cobradoTotalControles: cobros.reduce((a, c) => a + Number(c.importe || 0), 0),
    sinPago: { cantidad: deTipo(TIPOS_CONTROL.SIN_PAGO).length, monto: suma(deTipo(TIPOS_CONTROL.SIN_PAGO), "diferencia") },
    deMenos: { cantidad: deTipo(TIPOS_CONTROL.DE_MENOS).length, monto: suma(deTipo(TIPOS_CONTROL.DE_MENOS), "diferencia") },
    deMas: { cantidad: deTipo(TIPOS_CONTROL.DE_MAS).length, monto: suma(deTipo(TIPOS_CONTROL.DE_MAS), "diferencia") },
    cobroSinVisita: { cantidad: deTipo(TIPOS_CONTROL.COBRO_SIN_VISITA).length, monto: suma(deTipo(TIPOS_CONTROL.COBRO_SIN_VISITA), "cobradoTotal") },
    sinValor: deTipo(TIPOS_CONTROL.SIN_VALOR).length,
    mesCerrado: hasta < hoy,
  };
  const orden = Object.values(TIPOS_CONTROL);
  filas.sort(
    (a, b) =>
      orden.indexOf(a.tipo) - orden.indexOf(b.tipo) || b.diferencia - a.diferencia || a.paciente.localeCompare(b.paciente, "es")
  );
  return { filas, resumen };
}
