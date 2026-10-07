// Meses que se usaron para probar la app y no cuentan como reales: no
// aparecen en alertas, no suman en los totales del año ni en el acumulado, y
// no se pueden cerrar. Los datos no se borran, quedan como historial.
export const MESES_DE_PRUEBA = ["2026-09"];

export function esMesDePrueba(anio, mes) {
  return MESES_DE_PRUEBA.includes(`${anio}-${String(mes).padStart(2, "0")}`);
}

export function esFechaDePrueba(fechaISO) {
  return MESES_DE_PRUEBA.includes(String(fechaISO).slice(0, 7));
}
