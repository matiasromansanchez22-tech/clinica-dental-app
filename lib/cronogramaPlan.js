// Arma el detalle de un plan de financiación renglón por renglón: Anticipo,
// Cuota 1, Cuota 2... Cada pago (de Caja o histórico) se va aplicando en orden de
// fecha: primero completa el anticipo, después la cuota 1, y así. Es la misma
// cuenta que usa el plan para saber cuántas cuotas van pagas (por montos), solo
// que mostrada paso por paso.
//
// plan: { anticipoAcordado, cantidadCuotas, valorCuota, totalTratamiento }
// pagos: [{ fecha, monto, medioPago, origen }] — en cualquier orden.
export function armarCronogramaPlan(plan, pagos) {
  const anticipo = Number(plan.anticipoAcordado) || 0;
  const cuotas = Number(plan.cantidadCuotas) || 0;
  const valorCuota = Number(plan.valorCuota) || 0;
  const total = Number(plan.totalTratamiento) || 0;

  const renglones = [];
  if (anticipo > 0) renglones.push({ clave: "anticipo", nombre: "Anticipo", monto: anticipo });
  if (cuotas > 0 && valorCuota > 0) {
    for (let i = 1; i <= cuotas; i++) {
      renglones.push({ clave: `cuota-${i}`, nombre: `Cuota ${i} de ${cuotas}`, monto: valorCuota });
    }
  } else {
    // Plan sin cuotas definidas: lo que queda después del anticipo va en un solo renglón.
    const resto = Math.max(total - anticipo, 0);
    if (resto > 0.009) renglones.push({ clave: "saldo", nombre: "Saldo", monto: resto });
  }

  // Si por redondeo los renglones no suman el total, el último absorbe la diferencia.
  const sumaRenglones = renglones.reduce((a, r) => a + r.monto, 0);
  if (renglones.length > 0 && total > 0 && Math.abs(sumaRenglones - total) > 0.5) {
    renglones[renglones.length - 1].monto += total - sumaRenglones;
  }

  for (const r of renglones) {
    r.pagado = 0;
    r.aportes = []; // qué pagos lo cubrieron
    r.completadoEl = null;
  }

  const ordenados = [...pagos].sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  let i = 0;
  for (const pago of ordenados) {
    let disponible = Number(pago.monto) || 0;
    while (disponible > 0.009 && i < renglones.length) {
      const r = renglones[i];
      const falta = r.monto - r.pagado;
      const aplica = Math.min(disponible, falta);
      if (aplica > 0.009) {
        r.pagado += aplica;
        r.aportes.push({ fecha: pago.fecha, monto: aplica, medioPago: pago.medioPago, origen: pago.origen });
      }
      disponible -= aplica;
      if (r.monto - r.pagado <= 0.009) {
        r.completadoEl = pago.fecha;
        i++;
      } else {
        break;
      }
    }
  }

  for (const r of renglones) {
    const falta = Math.max(r.monto - r.pagado, 0);
    r.falta = falta;
    r.estado = falta <= 0.009 ? "pagada" : r.pagado > 0.009 ? "parcial" : "pendiente";
  }

  const proximo = renglones.find((r) => r.estado !== "pagada") || null;
  return { renglones, proximo };
}

// Texto corto para decir qué sigue: "Cuota 2 de 2 — falta $122.000".
export function textoProximoPaso(cronograma) {
  const p = cronograma.proximo;
  if (!p) return null;
  const pesos = (n) => `$${Math.round(n).toLocaleString("es-AR")}`;
  return p.estado === "parcial"
    ? `${p.nombre}: pagó ${pesos(p.pagado)}, falta ${pesos(p.falta)}`
    : `${p.nombre} — ${pesos(p.falta)}`;
}
