// Regla (actualizada 2026-08-26): el copago se fija como un % del valor
// particular (valor_efectivo) de la prestación, salvo que la obra social
// tenga una excepción manual fija sobre el Valor OS (ej. IAPOS = 200%).
// El porcentaje general y las excepciones son configurables, no quedan
// fijas en el código.
export function calcularCopagoSugerido(valorOS, valorEfectivo, obraSocial, porcentajeParticular, excepciones) {
  const excepcion = excepciones.find(
    (e) => e.obra_social.trim().toLowerCase() === (obraSocial || "").trim().toLowerCase()
  );
  if (excepcion) {
    return { copago: redondear(valorOS * (excepcion.porcentaje / 100)), porcentajeAplicado: excepcion.porcentaje, origen: "excepcion" };
  }

  if (!valorEfectivo) return { copago: 0, porcentajeAplicado: 0, origen: "sin_valor_particular" };

  return {
    copago: redondear(valorEfectivo * (porcentajeParticular / 100)),
    porcentajeAplicado: porcentajeParticular,
    origen: "particular",
  };
}

function redondear(numero) {
  return Math.round((Number(numero) + Number.EPSILON) * 100) / 100;
}
