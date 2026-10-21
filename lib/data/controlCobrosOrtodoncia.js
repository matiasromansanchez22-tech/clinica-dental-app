import { supabase } from "@/lib/supabaseClient";
import { fechaDeHoyISO } from "@/lib/agenda";
import { ESTADOS_ASISTENCIA, situacionDelTurno } from "@/lib/data/seguimientoOrtodoncia";

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

function valorConAumento(valorControl, proximoAumento, fechaTurno, porcentaje) {
  const base = Number(valorControl) || 0;
  if (!base) return 0;
  if (proximoAumento && proximoAumento < fechaTurno) return Math.round((base * (1 + porcentaje / 100)) / 100) * 100;
  return base;
}

export async function obtenerControlCobrosOrtodoncia(mesISO) {
  const hoy = fechaDeHoyISO();
  const { desde, hasta } = rangoDelMes(mesISO);
  const anio = Number(mesISO.slice(0, 4));
  const colMes = MESES[Number(mesISO.slice(5)) - 1];

  const [turnos, cobros, pacientes, config, grilla] = await Promise.all([
    traerTodo(() =>
      supabase
        .from("turnos_ortodoncia")
        .select("id, fecha, hora_inicio, concepto, estado, presencia, asistencia, paciente_id, ortodoncista:profesionales!ortodoncista_id(nombre)")
        .gte("fecha", desde)
        .lte("fecha", hasta)
        .eq("estado", "Agendado")
    ),
    traerTodo(() =>
      supabase
        .from("caja_ortodoncia")
        .select("id, fecha, concepto, importe, cantidad_controles_abonados, paciente_id")
        .gte("fecha", desde)
        .lte("fecha", hasta)
    ),
    traerTodo(() =>
      supabase
        .from("pacientes_ortodoncia")
        .select("id, nombre, valor_control, proximo_aumento, ortodoncista:profesionales!ortodoncista_id(nombre)")
    ),
    supabase.from("configuracion_ortodoncia").select("valor").eq("clave", "aumento_porcentaje").maybeSingle(),
    traerTodo(() => supabase.from("controles_ortodoncia").select(`paciente_id, ${colMes}`).eq("anio", anio)),
  ]);
  const porcentaje = Number(config.data?.valor ?? 25);
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
    const valorUnitario = valorConAumento(p?.valor_control, p?.proximo_aumento, fechaRef, porcentaje);
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

    let tipo;
    let diferencia = 0;
    if (!valorUnitario && (asistidos.length || porVenir.length)) tipo = TIPOS_CONTROL.SIN_VALOR;
    else if (asistidos.length > 0) {
      if (!cubierto) {
        tipo = TIPOS_CONTROL.SIN_PAGO;
        diferencia = esperado;
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

    filas.push({
      id,
      paciente: p?.nombre ?? "(paciente)",
      ortodoncista: p?.ortodoncista?.nombre ?? suyosTurnos[0]?.ortodoncista?.nombre ?? "Sin asignar",
      turnos: suyosTurnos.map((t) => ({ fecha: t.fecha, hora: (t.hora_inicio || "").slice(0, 5), situacion: situacionDelTurno(t, hoy) })),
      asistio: asistidos.length,
      porVenir: porVenir.length,
      valorUnitario,
      esperado,
      cobrado: cobradoControl,
      cobradoTotal: suyosCobros.reduce((a, c) => a + Number(c.importe || 0), 0),
      coberturaPorGrilla: !hayCobro && marcadoEnGrilla.has(id),
      tipo,
      diferencia,
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
