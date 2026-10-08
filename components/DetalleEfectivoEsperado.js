"use client";

function pesos(n) {
  return `$${Math.round(Number(n) || 0).toLocaleString("es-AR")}`;
}

function Renglon({ titulo, monto, signo, color, detalle }) {
  const contenido = (
    <>
      <span className="text-gray-800">
        {signo} {titulo}
        {detalle?.length > 0 && <span className="ml-1 text-[11px] text-gray-400">(ver detalle)</span>}
      </span>
      <span className={`tabular-nums ${color}`}>{pesos(monto)}</span>
    </>
  );
  if (!detalle || detalle.length === 0) {
    return <div className="flex justify-between">{contenido}</div>;
  }
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none justify-between">{contenido}</summary>
      <ul className="mb-1 ml-4 mt-0.5 flex flex-col gap-0.5 border-l-2 border-gray-200 pl-3 text-xs text-gray-600">
        {detalle.map((d, i) => (
          <li key={i} className="flex justify-between">
            <span>{d.etiqueta}</span>
            <span className="tabular-nums">{pesos(d.monto)}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

// Explica de dónde sale el efectivo que TIENE QUE HABER en la caja al cerrar el turno, en
// pocos renglones: lo cobrado en efectivo, menos lo pagado en efectivo (pagos a
// profesionales y gastos), más/menos las transferencias de efectivo entre cajas. El detalle
// de cada uno se ve tocando el renglón.
export default function DetalleEfectivoEsperado({ cobradoEfectivo, movimientos, descontadoEnOtroCierre = 0, esperado }) {
  const pagosYGastos = (movimientos?.salidas || []).filter((s) => s.tipo !== "transferencia");
  const transferencias = [
    ...(movimientos?.entradas || []).map((e) => ({ ...e, monto: e.monto })),
    ...(movimientos?.salidas || []).filter((s) => s.tipo === "transferencia").map((s) => ({ ...s, monto: -s.monto })),
  ];
  const totalPagosYGastos = pagosYGastos.reduce((a, s) => a + s.monto, 0);
  const totalTransferencias = transferencias.reduce((a, t) => a + t.monto, 0);

  return (
    <div className="mt-4 rounded-md border border-brand-brown/30 bg-brand-tan/20 px-4 py-3 text-sm">
      <p className="text-xs font-semibold uppercase text-brand-brown">💵 Efectivo que tiene que haber en la caja</p>
      <div className="mt-2 flex flex-col gap-1">
        <Renglon titulo="Cobrado en efectivo" signo="" monto={cobradoEfectivo} color="text-gray-900" />
        {totalPagosYGastos > 0 && (
          <Renglon titulo="Pagos y gastos en efectivo" signo="−" monto={totalPagosYGastos} color="text-red-700" detalle={pagosYGastos} />
        )}
        {transferencias.length > 0 && (
          <Renglon
            titulo="Transferencias de efectivo entre cajas"
            signo={totalTransferencias >= 0 ? "+" : "−"}
            monto={Math.abs(totalTransferencias)}
            color={totalTransferencias >= 0 ? "text-emerald-700" : "text-red-700"}
            detalle={transferencias.map((t) => ({ etiqueta: t.etiqueta, monto: Math.abs(t.monto) }))}
          />
        )}
        {descontadoEnOtroCierre !== 0 && (
          <div className="flex justify-between text-gray-500">
            <span>Ya contado en el cierre de otro turno de hoy</span>
            <span className="tabular-nums">{pesos(-descontadoEnOtroCierre)}</span>
          </div>
        )}
        <div className="mt-1 flex justify-between border-t-2 border-brand-brown/40 pt-1.5 text-base font-bold text-gray-900">
          <span>= Tiene que haber</span>
          <span className="tabular-nums">{pesos(esperado)}</span>
        </div>
      </div>
      {totalPagosYGastos === 0 && transferencias.length === 0 && (
        <p className="mt-1 text-[11px] text-gray-500">Hoy no hubo pagos, gastos ni transferencias en efectivo en esta caja.</p>
      )}
    </div>
  );
}
