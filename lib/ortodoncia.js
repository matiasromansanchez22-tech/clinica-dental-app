import { fechaDeHoyISO } from "@/lib/agenda";
import { calcularEdad } from "@/lib/pacientes";

export { calcularEdad };

// Compartido entre el cobro y el "marcar como hecho" en Agenda, para que
// las opciones sean siempre las mismas en los dos lugares.
export const CONCEPTOS_ORTODONCIA = [
  "Control",
  "Reposición de bracket",
  "Instalación (contado)",
  "Instalación (2 cuotas)",
  "Desinstalación",
  "Consulta de ortodoncia",
  "Urgencia",
];

export const TIPOS_BRACKET_ORTODONCIA = ["Metálico", "Porcelana"];

// Los conceptos que se pueden elegir al crear un turno nuevo (distinto de
// CONCEPTOS_ORTODONCIA de arriba, que es para lo que se cobra/marca como
// hecho) — algunos de estos valores exactos disparan reglas de negocio en
// NuevoTurnoOrtodonciaModal (ej. "Instalación superior"/"Instalación
// inferior" arrancan el tratamiento solos), por eso viven acá compartidos
// en vez de duplicados: así "próxima prestación" (QueSeHizoHoyOrtodoncia)
// puede pre-cargar el turno siguiente con un valor que el modal reconoce.
export const CONCEPTOS_TURNO_ORTODONCIA = [
  "Consulta de ortodoncia",
  "Control",
  "Instalación superior",
  "Instalación inferior",
  "Reposición",
  "Retiro",
  "Urgencia",
];

// ---------- Precios de instalación (catálogo de Ortodoncia) ----------
//
// "tipoBrackets" tiene que venir tal cual se guarda en la ficha del
// paciente ("Metalicos"/"Porcelana", sin tilde) — es una lista distinta
// de TIPOS_BRACKET_ORTODONCIA de arriba (esa es para una reposición
// puntual, no para el tipo de brackets que tiene instalado el paciente).

export function precioInstalacionSugerido(tipoBrackets, formaPagoInstalacion, config) {
  if (!tipoBrackets || !formaPagoInstalacion) return null;
  const tipo = tipoBrackets === "Metalicos" ? "metalica" : "porcelana";
  const forma = formaPagoInstalacion === "Contado" ? "contado" : "2_cuotas";
  return config[`precio_instalacion_${tipo}_${forma}`] || null;
}

export function cuotaControlSugerida(tipoBrackets, config) {
  if (!tipoBrackets) return null;
  return config[tipoBrackets === "Metalicos" ? "cuota_control_metalico" : "cuota_control_porcelana"] || null;
}

const CONCEPTO_INSTALACION_CONTADO = "Instalación (contado)";
const CONCEPTO_INSTALACION_CUOTAS = "Instalación (2 cuotas)";

// A partir de la forma de pago que quedó anotada en la ficha del paciente
// y de los cobros de "Instalación..." que ya tiene registrados en Caja,
// arma el estado de la instalación — se calcula solo, nadie lo tiene que
// tildar a mano. Devuelve null si ese paciente todavía no tiene una forma
// de pago de instalación definida (no aplica).
export function calcularEstadoInstalacion(formaPagoInstalacion, cobrosInstalacion) {
  if (!formaPagoInstalacion) return null;
  if (formaPagoInstalacion === "Contado") {
    const pagada = cobrosInstalacion.some((c) => c.concepto === CONCEPTO_INSTALACION_CONTADO);
    return pagada
      ? { completa: true, texto: "Instalación pagada" }
      : { completa: false, texto: "Instalación sin cobrar" };
  }
  const cuotas = cobrosInstalacion.filter((c) => c.concepto === CONCEPTO_INSTALACION_CUOTAS);
  if (cuotas.length >= 2) return { completa: true, texto: "Instalación pagada (2 cuotas)" };
  if (cuotas.length === 1) {
    return { completa: false, texto: "Pendiente 2ª cuota", montoCuota: Number(cuotas[0].importe) };
  }
  return { completa: false, texto: "Instalación sin cobrar" };
}

function diasEntre(fechaFinISO, fechaInicioISO) {
  const [a1, m1, d1] = fechaInicioISO.split("-").map(Number);
  const [a2, m2, d2] = fechaFinISO.split("-").map(Number);
  const inicio = new Date(a1, m1 - 1, d1);
  const fin = new Date(a2, m2 - 1, d2);
  return Math.round((fin - inicio) / (1000 * 60 * 60 * 24));
}

// Regla crítica (doc 4.2): semáforo de aumento de cuota.
// 🔴 ya venció · 🟡 vence en los próximos 30 días · 🟢 al día.
export function calcularEstadoAumento(proximoAumentoISO) {
  if (!proximoAumentoISO) return { emoji: "⚪", texto: "Sin definir", color: "text-gray-400" };
  const dias = diasEntre(proximoAumentoISO, fechaDeHoyISO());
  if (dias < 0) return { emoji: "🔴", texto: "Aumentar", color: "text-red-600" };
  if (dias <= 30) return { emoji: "🟡", texto: "Próximo aumento", color: "text-amber-600" };
  return { emoji: "🟢", texto: "Al día", color: "text-emerald-600" };
}

// Regla del doc 4.2: cada N meses (configurable) desde el último aumento,
// calcular la próxima fecha, respetando correctamente los cambios de mes
// (ej. si el último aumento fue el 31 de enero, el próximo cae el 31 de
// julio, o el último día del mes destino si tuviera menos días).
export function calcularProximoAumento(ultimoAumentoISO, mesesEntreAumentos) {
  if (!ultimoAumentoISO) return null;
  const [anio, mes, dia] = ultimoAumentoISO.split("-").map(Number);
  const mesesTotales = mes - 1 + Number(mesesEntreAumentos);
  const anioDestino = anio + Math.floor(mesesTotales / 12);
  const mesDestino = ((mesesTotales % 12) + 12) % 12; // 0-indexado
  const ultimoDiaDelMes = new Date(anioDestino, mesDestino + 1, 0).getDate();
  const diaDestino = Math.min(dia, ultimoDiaDelMes);
  const m = String(mesDestino + 1).padStart(2, "0");
  const d = String(diaDestino).padStart(2, "0");
  return `${anioDestino}-${m}-${d}`;
}
