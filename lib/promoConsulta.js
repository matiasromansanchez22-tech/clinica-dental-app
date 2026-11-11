// Promoción "consulta de ortodoncia totalmente bonificada" (sin cargo) hasta una fecha. Se guarda en la configuración de Ortodoncia
// con la clave promo_consulta_bonificada_hasta, como número AAAAMMDD (ej. 20261130 = hasta el 30/11/2026 inclusive). Si vale 0 o no
// existe, no hay promoción. Vale para las consultas cuya fecha de turno es hasta ese día. Lo usan la página pública, el asistente,
// Recepción y el cobro en Caja, así todos dicen lo mismo.

export const CLAVE_PROMO_CONSULTA = "promo_consulta_bonificada_hasta";

// 20261130 → "2026-11-30" (o null si no hay promoción cargada)
export function promoConsultaHasta(valor) {
  const n = Math.round(Number(valor) || 0);
  if (n < 20000101) return null;
  const t = String(n);
  return `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`;
}

// "2026-11-30" → 20261130
export const promoConsultaComoNumero = (fechaISO) => Number(String(fechaISO || "").replace(/-/g, "")) || 0;

// ¿Una consulta con turno ese día está bonificada?
export const consultaBonificadaEl = (fechaISO, hastaISO) => Boolean(hastaISO) && Boolean(fechaISO) && fechaISO <= hastaISO;

// "2026-11-30" → "30/11"
export function textoCortoDeFecha(fechaISO) {
  const [, m, d] = String(fechaISO).split("-");
  return `${d}/${m}`;
}

// La fecha de hoy en Argentina (sirve igual en el navegador y en el servidor).
export const hoyEnArgentina = () => new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
