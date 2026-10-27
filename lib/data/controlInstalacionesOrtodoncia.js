import { supabase } from "@/lib/supabaseClient";
import { fechaDeHoyISO } from "@/lib/agenda";
import { horaLocalDe } from "@/lib/diaHora";

// Control de instalaciones de Ortodoncia: para cada paciente que se instaló (o tiene la instalación agendada) desde que arrancó
// la app, cuánto pagó de la instalación y cuánto debería haber pagado según el precio de lista.
//
// Reglas:
//  · "Pagado" suma los cobros de instalación (contado o en cuotas) y los pagos adelantados del paciente.
//  · El precio de lista sale de la configuración de Ortodoncia según el tipo de brackets y la forma de pago de la ficha
//    (contado, o 2 cuotas × el valor de la cuota).
//  · Una instalación en 2 cuotas se considera completa si hay pagos en 2 fechas distintas, o si lo pagado llega al 95% del precio.
//  · Una instalación se considera HECHA solo con evidencia real: un cobro de instalación, un turno de instalación marcado como presente
//    (y que lo que el profesional marcó que hizo ese día no sea otra cosa, como un Control), o la fecha de instalación de la ficha si es
//    posterior al arranque de la app (la fecha del 24/8, día del arranque, no se toma: suele ser un valor puesto al cargar la ficha).
//  · Los pacientes que ya estaban instalados antes de la app (fecha de instalación anterior) y vuelven por otra arcada no se
//    cuentan como instalación nueva; los de "continuación de otra clínica" tienen su propio pago y quedan aparte.

export const INICIO_APP_INSTALACIONES = "2026-08-24";

export const ESTADOS_INSTALACION = {
  SIN_PAGO: "Instalada y sin pago registrado",
  SEGUNDA_CUOTA: "2ª cuota pendiente",
  PRIMERA_CUOTA: "Pagó la 1ª cuota (en término)",
  DE_MENOS: "Pagó de menos",
  COMPLETA: "Pagada completa",
  COMPLETA_MENOS: "Completa, pero por menos del precio de lista",
  AGENDADA: "Instalación agendada",
  SIN_REFERENCIA: "Pagó (sin precio de referencia)",
  REVISADA: "Revisada por las dueñas",
};

// Resultados que las dueñas pueden anotar al revisar un caso (migración 162).
export const RESULTADOS_REVISION = [
  "Ya estaba instalado antes de la app",
  "No se instaló",
  "Pago registrado afuera",
  "Descuento autorizado",
  "Es ortopedia (otro tratamiento)",
];

export async function guardarRevisionInstalacion(pacienteId, resultado, nota) {
  if (!resultado) {
    const { error } = await supabase.from("revision_instalaciones_ortodoncia").delete().eq("paciente_id", pacienteId);
    if (error) throw error;
    return null;
  }
  const { data, error } = await supabase
    .from("revision_instalaciones_ortodoncia")
    .upsert({ paciente_id: pacienteId, resultado, nota: nota || null, updated_at: new Date().toISOString() }, { onConflict: "paciente_id" })
    .select("paciente_id, resultado, nota")
    .single();
  if (error) throw error;
  return data;
}

const CONCEPTOS_PAGO = ["Instalación (contado)", "Instalación (2 cuotas)", "Pago adelantado"];
const PRESENCIAS = ["En espera", "En consultorio", "Finalizado"];

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

function diasEntre(desdeISO, hastaISO) {
  return Math.round((new Date(`${hastaISO}T00:00:00`) - new Date(`${desdeISO}T00:00:00`)) / 86400000);
}

function precioDeLista(tipoBrackets, forma, cfg) {
  if (!tipoBrackets || !forma) return null;
  const tipo = /porcelana/i.test(tipoBrackets) ? "porcelana" : "metalica";
  if (/contado/i.test(forma)) return Number(cfg[`precio_instalacion_${tipo}_contado`]) || null;
  const cuota = Number(cfg[`precio_instalacion_${tipo}_2_cuotas`]) || null;
  return cuota ? cuota * 2 : null;
}

export async function obtenerControlInstalacionesOrtodoncia(desdeISO = INICIO_APP_INSTALACIONES) {
  const hoy = fechaDeHoyISO();
  const [pacientes, turnos, cobros, configFilas, realizadas, perfilesFilas] = await Promise.all([
    traerTodo(() =>
      supabase
        .from("pacientes_ortodoncia")
        .select("id, nombre, fecha_instalacion, tipo_brackets, forma_pago_instalacion, origen_paciente, ortodoncista:profesionales!ortodoncista_id(nombre)")
    ),
    traerTodo(() =>
      supabase
        .from("turnos_ortodoncia")
        .select("paciente_id, fecha, hora_inicio, consultorio, concepto, presencia")
        .in("concepto", ["Instalación superior", "Instalación inferior"])
        .eq("estado", "Agendado")
    ),
    traerTodo(() =>
      supabase.from("caja_ortodoncia").select("paciente_id, fecha, concepto, importe, medio_pago, created_at, usuario_id, descuento_referido, descuento_fidelidad").in("concepto", CONCEPTOS_PAGO)
    ),
    traerTodo(() => supabase.from("configuracion_ortodoncia").select("clave, valor")),
    // Lo que el profesional marcó que hizo en cada visita: sirve para no tomar como instalación un turno donde en realidad hizo un Control.
    traerTodo(() =>
      supabase.from("prestaciones_realizadas_agenda").select("paciente_ortodoncia_id, fecha, prestacion").not("paciente_ortodoncia_id", "is", null)
    ),
    supabase.from("perfiles").select("id, nombre").then((r) => r.data || []),
  ]);
  const nombreDePerfil = Object.fromEntries(perfilesFilas.map((p) => [p.id, p.nombre]));
  const cfg = Object.fromEntries(configFilas.map((c) => [c.clave, c.valor]));
  // Revisiones manuales (si todavía no se corrió la migración 162, simplemente no hay).
  const { data: revisionesFilas, error: errorRevisiones } = await supabase
    .from("revision_instalaciones_ortodoncia")
    .select("paciente_id, resultado, nota");
  const revisionDe = Object.fromEntries((errorRevisiones ? [] : revisionesFilas).map((r) => [r.paciente_id, r]));
  const pacientePorId = Object.fromEntries(pacientes.map((p) => [p.id, p]));

  const ids = new Set([
    ...turnos.filter((t) => t.fecha >= desdeISO).map((t) => t.paciente_id),
    ...cobros.filter((c) => c.fecha >= desdeISO && c.concepto !== "Pago adelantado").map((c) => c.paciente_id),
    ...pacientes.filter((p) => p.fecha_instalacion && p.fecha_instalacion > desdeISO && p.fecha_instalacion <= "2027-12-31").map((p) => p.id),
    ...cobros.filter((c) => c.fecha >= desdeISO && c.concepto === "Pago adelantado").map((c) => c.paciente_id),
  ]);

  const filas = [];
  let continuaciones = 0;
  let ortopedia = 0;
  let anteriores = 0;
  for (const id of ids) {
    const p = pacientePorId[id];
    if (!p) continue;
    // Ortopedia es otro tratamiento con otro precio: no entra en el control de instalaciones de brackets.
    if (/ortopedia/i.test(p.nombre || "")) {
      ortopedia += 1;
      continue;
    }
    if (p.origen_paciente === "Continuación de otra clínica") {
      continuaciones += 1;
      continue;
    }
    const suyosTurnos = turnos.filter((t) => t.paciente_id === id);
    const suyosCobros = cobros.filter((c) => c.paciente_id === id && c.fecha >= desdeISO);
    const cobrosInstalacion = suyosCobros.filter((c) => c.concepto !== "Pago adelantado");
    // Instalado antes de la app: no se cuenta como instalación nueva (a menos que haya pagado una instalación en este período).
    if (p.fecha_instalacion && p.fecha_instalacion < desdeISO && cobrosInstalacion.length === 0) {
      anteriores += 1;
      continue;
    }
    const turnosHechos = suyosTurnos.filter((t) => {
      if (!(t.fecha <= hoy && PRESENCIAS.includes(t.presencia) && t.fecha >= desdeISO)) return false;
      const ese = realizadas.filter((r) => r.paciente_ortodoncia_id === id && r.fecha === t.fecha);
      return ese.length === 0 || ese.some((r) => /^Instalaci/i.test(r.prestacion || ""));
    });
    const fechaDeFichaValida = Boolean(p.fecha_instalacion && p.fecha_instalacion > desdeISO && p.fecha_instalacion <= hoy);
    const turnosAgendados = suyosTurnos.filter((t) => t.fecha >= hoy && t.fecha >= desdeISO).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const hecha = turnosHechos.length > 0 || cobrosInstalacion.length > 0 || fechaDeFichaValida;
    const evidencia = [
      turnosHechos.length > 0 ? `turno de instalación marcado como presente (${turnosHechos.map((t) => t.fecha.slice(8) + "/" + t.fecha.slice(5, 7)).join(", ")})` : null,
      cobrosInstalacion.length > 0 ? "cobro de instalación" : null,
      fechaDeFichaValida && turnosHechos.length === 0 && cobrosInstalacion.length === 0 ? "solo la fecha de instalación de la ficha" : null,
    ].filter(Boolean);
    const fechaInstalacion =
      turnosHechos.map((t) => t.fecha).sort()[0] ||
      (fechaDeFichaValida ? p.fecha_instalacion : null) ||
      cobrosInstalacion.map((c) => c.fecha).sort()[0] ||
      turnosAgendados[0]?.fecha ||
      null;

    const pagado = suyosCobros.reduce((a, c) => a + Number(c.importe || 0), 0);
    // Plan de referidos: el descuento autorizado cuenta como cubierto (se compara contra el precio de lista).
    const descuentoReferido = suyosCobros.reduce((a, c) => a + Number(c.descuento_referido || 0) + Number(c.descuento_fidelidad || 0), 0);
    const pagadoConDescuento = pagado + descuentoReferido;
    const fechasDePago = new Set(suyosCobros.map((c) => c.fecha));
    const referencia = precioDeLista(p.tipo_brackets, p.forma_pago_instalacion, cfg);
    const esContado = /contado/i.test(p.forma_pago_instalacion || "");
    const dias = fechaInstalacion && hecha ? diasEntre(fechaInstalacion, hoy) : null;

    let estado;
    if (revisionDe[id]) estado = ESTADOS_INSTALACION.REVISADA;
    else if (!hecha) estado = ESTADOS_INSTALACION.AGENDADA;
    else if (pagado === 0) estado = ESTADOS_INSTALACION.SIN_PAGO;
    else if (!referencia) estado = ESTADOS_INSTALACION.SIN_REFERENCIA;
    else if (esContado) estado = pagadoConDescuento >= referencia * 0.95 ? ESTADOS_INSTALACION.COMPLETA : ESTADOS_INSTALACION.DE_MENOS;
    else if (pagadoConDescuento >= referencia * 0.95) estado = ESTADOS_INSTALACION.COMPLETA;
    else if (fechasDePago.size >= 2) estado = ESTADOS_INSTALACION.COMPLETA_MENOS;
    else estado = dias > 30 ? ESTADOS_INSTALACION.SEGUNDA_CUOTA : ESTADOS_INSTALACION.PRIMERA_CUOTA;

    filas.push({
      id,
      paciente: p.nombre,
      ortodoncista: p.ortodoncista?.nombre ?? "Sin asignar",
      fechaInstalacion,
      hecha,
      evidencia,
      diasDesdeInstalacion: dias,
      tipoBrackets: p.tipo_brackets || null,
      formaPago: p.forma_pago_instalacion || null,
      referencia,
      pagado,
      descuentoReferido,
      falta: referencia ? Math.max(0, referencia - pagadoConDescuento) : 0,
      // El turno de instalación que se marcó como presente (día y hora), para ubicarlo en la agenda.
      turnoInstalacion: turnosHechos.length > 0 ? { fecha: turnosHechos[0].fecha, hora: (turnosHechos[0].hora_inicio || "").slice(0, 5), consultorio: turnosHechos[0].consultorio } : null,
      pagos: suyosCobros
        .map((c) => ({
          fecha: c.fecha,
          hora: horaLocalDe(c.created_at),
          concepto: c.concepto,
          importe: Number(c.importe || 0),
          medio: c.medio_pago,
          cargadoPor: nombreDePerfil[c.usuario_id] || null,
        }))
        .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora)),
      estado,
      revision: revisionDe[id] || null,
    });
  }

  const orden = Object.values(ESTADOS_INSTALACION);
  filas.sort((a, b) => orden.indexOf(a.estado) - orden.indexOf(b.estado) || (b.fechaInstalacion || "").localeCompare(a.fechaInstalacion || ""));
  const de = (e) => filas.filter((f) => f.estado === e);
  const suma = (lista, campo) => lista.reduce((a, f) => a + f[campo], 0);
  // Las revisadas como "ya estaba instalado" o "no se instaló" no cuentan como instalaciones nuevas.
  const hechas = filas.filter((f) => f.hecha && !(f.revision && ["Ya estaba instalado antes de la app", "No se instaló", "Es ortopedia (otro tratamiento)"].includes(f.revision.resultado)));
  return {
    filas,
    continuaciones,
    ortopedia,
    anteriores,
    resumen: {
      instalaciones: hechas.length,
      agendadas: de(ESTADOS_INSTALACION.AGENDADA).length,
      revisadas: de(ESTADOS_INSTALACION.REVISADA).length,
      sinPago: de(ESTADOS_INSTALACION.SIN_PAGO).length,
      segundaCuota: { cantidad: de(ESTADOS_INSTALACION.SEGUNDA_CUOTA).length, monto: suma(de(ESTADOS_INSTALACION.SEGUNDA_CUOTA), "falta") },
      deMenos: { cantidad: de(ESTADOS_INSTALACION.DE_MENOS).length, monto: suma(de(ESTADOS_INSTALACION.DE_MENOS), "falta") },
      completaMenos: { cantidad: de(ESTADOS_INSTALACION.COMPLETA_MENOS).length, monto: suma(de(ESTADOS_INSTALACION.COMPLETA_MENOS), "falta") },
      completas: de(ESTADOS_INSTALACION.COMPLETA).length,
      sinFormaDePago: hechas.filter((f) => !f.formaPago).length,
      sinTipoBrackets: hechas.filter((f) => !f.tipoBrackets).length,
      pagadoTotal: suma(hechas, "pagado"),
      referenciaTotal: hechas.reduce((a, f) => a + (f.referencia || 0), 0),
      pagadoAgendadas: suma(filas.filter((f) => !f.hecha), "pagado"),
    },
  };
}
