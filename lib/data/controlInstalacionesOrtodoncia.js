import { supabase } from "@/lib/supabaseClient";
import { fechaDeHoyISO } from "@/lib/agenda";

// Control de instalaciones de Ortodoncia: para cada paciente que se instaló (o tiene la instalación agendada) desde que arrancó
// la app, cuánto pagó de la instalación y cuánto debería haber pagado según el precio de lista.
//
// Reglas:
//  · "Pagado" suma los cobros de instalación (contado o en cuotas) y los pagos adelantados del paciente.
//  · El precio de lista sale de la configuración de Ortodoncia según el tipo de brackets y la forma de pago de la ficha
//    (contado, o 2 cuotas × el valor de la cuota).
//  · Una instalación en 2 cuotas se considera completa si hay pagos en 2 fechas distintas, o si lo pagado llega al 95% del precio.
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
};

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
  const [pacientes, turnos, cobros, configFilas] = await Promise.all([
    traerTodo(() =>
      supabase
        .from("pacientes_ortodoncia")
        .select("id, nombre, fecha_instalacion, tipo_brackets, forma_pago_instalacion, origen_paciente, ortodoncista:profesionales!ortodoncista_id(nombre)")
    ),
    traerTodo(() =>
      supabase
        .from("turnos_ortodoncia")
        .select("paciente_id, fecha, concepto, presencia")
        .in("concepto", ["Instalación superior", "Instalación inferior"])
        .eq("estado", "Agendado")
    ),
    traerTodo(() =>
      supabase.from("caja_ortodoncia").select("paciente_id, fecha, concepto, importe").in("concepto", CONCEPTOS_PAGO)
    ),
    traerTodo(() => supabase.from("configuracion_ortodoncia").select("clave, valor")),
  ]);
  const cfg = Object.fromEntries(configFilas.map((c) => [c.clave, c.valor]));
  const pacientePorId = Object.fromEntries(pacientes.map((p) => [p.id, p]));

  const ids = new Set([
    ...turnos.filter((t) => t.fecha >= desdeISO).map((t) => t.paciente_id),
    ...cobros.filter((c) => c.fecha >= desdeISO && c.concepto !== "Pago adelantado").map((c) => c.paciente_id),
    ...pacientes.filter((p) => p.fecha_instalacion && p.fecha_instalacion >= desdeISO && p.fecha_instalacion <= "2027-12-31").map((p) => p.id),
    ...cobros.filter((c) => c.fecha >= desdeISO && c.concepto === "Pago adelantado").map((c) => c.paciente_id),
  ]);

  const filas = [];
  let continuaciones = 0;
  let anteriores = 0;
  for (const id of ids) {
    const p = pacientePorId[id];
    if (!p) continue;
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
    const turnosHechos = suyosTurnos.filter((t) => t.fecha <= hoy && PRESENCIAS.includes(t.presencia) && t.fecha >= desdeISO);
    const turnosAgendados = suyosTurnos.filter((t) => t.fecha >= hoy && t.fecha >= desdeISO).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const hecha =
      turnosHechos.length > 0 ||
      cobrosInstalacion.length > 0 ||
      Boolean(p.fecha_instalacion && p.fecha_instalacion >= desdeISO && p.fecha_instalacion <= hoy);
    const fechaInstalacion =
      turnosHechos.map((t) => t.fecha).sort()[0] ||
      (p.fecha_instalacion && p.fecha_instalacion >= desdeISO ? p.fecha_instalacion : null) ||
      cobrosInstalacion.map((c) => c.fecha).sort()[0] ||
      turnosAgendados[0]?.fecha ||
      null;

    const pagado = suyosCobros.reduce((a, c) => a + Number(c.importe || 0), 0);
    const fechasDePago = new Set(suyosCobros.map((c) => c.fecha));
    const referencia = precioDeLista(p.tipo_brackets, p.forma_pago_instalacion, cfg);
    const esContado = /contado/i.test(p.forma_pago_instalacion || "");
    const dias = fechaInstalacion && hecha ? diasEntre(fechaInstalacion, hoy) : null;

    let estado;
    if (!hecha) estado = ESTADOS_INSTALACION.AGENDADA;
    else if (pagado === 0) estado = ESTADOS_INSTALACION.SIN_PAGO;
    else if (!referencia) estado = ESTADOS_INSTALACION.SIN_REFERENCIA;
    else if (esContado) estado = pagado >= referencia * 0.95 ? ESTADOS_INSTALACION.COMPLETA : ESTADOS_INSTALACION.DE_MENOS;
    else if (pagado >= referencia * 0.95) estado = ESTADOS_INSTALACION.COMPLETA;
    else if (fechasDePago.size >= 2) estado = ESTADOS_INSTALACION.COMPLETA_MENOS;
    else estado = dias > 30 ? ESTADOS_INSTALACION.SEGUNDA_CUOTA : ESTADOS_INSTALACION.PRIMERA_CUOTA;

    filas.push({
      id,
      paciente: p.nombre,
      ortodoncista: p.ortodoncista?.nombre ?? "Sin asignar",
      fechaInstalacion,
      hecha,
      diasDesdeInstalacion: dias,
      tipoBrackets: p.tipo_brackets || null,
      formaPago: p.forma_pago_instalacion || null,
      referencia,
      pagado,
      falta: referencia ? Math.max(0, referencia - pagado) : 0,
      pagos: suyosCobros.map((c) => ({ fecha: c.fecha, concepto: c.concepto, importe: Number(c.importe || 0) })).sort((a, b) => a.fecha.localeCompare(b.fecha)),
      estado,
    });
  }

  const orden = Object.values(ESTADOS_INSTALACION);
  filas.sort((a, b) => orden.indexOf(a.estado) - orden.indexOf(b.estado) || (b.fechaInstalacion || "").localeCompare(a.fechaInstalacion || ""));
  const de = (e) => filas.filter((f) => f.estado === e);
  const suma = (lista, campo) => lista.reduce((a, f) => a + f[campo], 0);
  const hechas = filas.filter((f) => f.hecha);
  return {
    filas,
    continuaciones,
    anteriores,
    resumen: {
      instalaciones: hechas.length,
      agendadas: de(ESTADOS_INSTALACION.AGENDADA).length,
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
