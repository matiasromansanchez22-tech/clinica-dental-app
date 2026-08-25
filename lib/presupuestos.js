export function calcularTotalPrestaciones(prestaciones) {
  return redondear(prestaciones.reduce((acc, p) => acc + (Number(p.importe) || 0), 0));
}

export function calcularImportePrestacion(catalogoItem, cantidad, tipoPrecio) {
  if (!catalogoItem) return 0;
  const valorUnitario = tipoPrecio === "Efectivo" ? catalogoItem.valor_efectivo : catalogoItem.valor_lista;
  return redondear((Number(cantidad) || 0) * (Number(valorUnitario) || 0));
}

export function calcularAnticipoSugerido(total, modalidad, config) {
  if (modalidad === "Contado") return redondear(total * ((config.anticipo_contado_pct ?? 100) / 100));
  if (modalidad === "Financiado") return redondear(total * ((config.anticipo_financiado_pct ?? 40) / 100));
  return 0;
}

export function redondear(numero) {
  return Math.round((Number(numero) + Number.EPSILON) * 100) / 100;
}
