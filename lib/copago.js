// Regla crítica (doc 3.3): el copago se calcula con una escala según el Valor OS,
// salvo que la obra social tenga una excepción manual fija (ej. IAPOS = 200%).
// La escala y las excepciones son configurables, no quedan fijas en el código.
export function calcularCopagoSugerido(valorOS, obraSocial, escalas, excepciones) {
  const excepcion = excepciones.find(
    (e) => e.obra_social.trim().toLowerCase() === (obraSocial || "").trim().toLowerCase()
  );
  if (excepcion) {
    return { copago: redondear(valorOS * (excepcion.porcentaje / 100)), porcentajeAplicado: excepcion.porcentaje, origen: "excepcion" };
  }

  const escalaOrdenada = [...escalas].sort((a, b) => a.orden - b.orden);
  const tramo = escalaOrdenada.find((e) => e.umbral_maximo === null || valorOS <= e.umbral_maximo);
  if (!tramo) return { copago: 0, porcentajeAplicado: 0, origen: "sin_escala" };

  return { copago: redondear(valorOS * (tramo.porcentaje / 100)), porcentajeAplicado: tramo.porcentaje, origen: "escala" };
}

function redondear(numero) {
  return Math.round((Number(numero) + Number.EPSILON) * 100) / 100;
}
