import { fechaDeHoyISO } from "@/lib/agenda";
import { calcularEdad } from "@/lib/pacientes";

export { calcularEdad };

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
