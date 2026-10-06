export const DENOMINACIONES = [20000, 10000, 2000, 1000, 500, 200, 100];

export const CONTEO_VACIO = { billetes: {}, monedas: "" };

export function totalContado(conteo) {
  const deBilletes = DENOMINACIONES.reduce((acc, d) => acc + d * (Number(conteo?.billetes?.[d]) || 0), 0);
  return deBilletes + (Number(conteo?.monedas) || 0);
}

// Lo que se guarda en la base cuando se contó algo; null si no se contó.
export function conteoParaGuardar(conteo) {
  const contado = totalContado(conteo);
  if (contado <= 0) return null;
  return { efectivoContado: contado, billetes: conteo.billetes, monedas: Number(conteo.monedas) || 0 };
}

export function conteoDesdeCierre(cierre) {
  const guardado = cierre?.conteo_billetes;
  if (!guardado) return CONTEO_VACIO;
  return { billetes: guardado.billetes || {}, monedas: guardado.monedas ? String(guardado.monedas) : "" };
}
