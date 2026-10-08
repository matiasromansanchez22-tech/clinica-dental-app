"use client";

function pesos(n) {
  return `$${Math.round(Number(n) || 0).toLocaleString("es-AR")}`;
}

// Explica de dónde sale el efectivo que TIENE QUE HABER en la caja al cerrar el turno:
// lo cobrado en efectivo, menos lo que ya se pagó en efectivo (profesionales, gastos) y
// más/menos las transferencias de efectivo entre cajas.
export default function DetalleEfectivoEsperado({ cobradoEfectivo, movimientos, descontadoEnOtroCierre = 0, esperado }) {
  const hayMovimientos = movimientos && (movimientos.salidas.length > 0 || movimientos.entradas.length > 0);
  return (
    <div className="mt-4 rounded-md border border-brand-brown/30 bg-brand-tan/20 px-4 py-3 text-sm">
      <p className="text-xs font-semibold uppercase text-brand-brown">💵 Efectivo que tiene que haber en la caja</p>
      <div className="mt-1.5 flex flex-col gap-0.5">
        <div className="flex justify-between">
          <span className="text-gray-700">Cobrado en efectivo por vos</span>
          <span className="tabular-nums">{pesos(cobradoEfectivo)}</span>
        </div>
        {movimientos?.entradas.map((e, i) => (
          <div key={`e${i}`} className="flex justify-between text-emerald-700">
            <span>+ {e.etiqueta}</span>
            <span className="tabular-nums">{pesos(e.monto)}</span>
          </div>
        ))}
        {movimientos?.salidas.map((s, i) => (
          <div key={`s${i}`} className="flex justify-between text-red-700">
            <span>− {s.etiqueta}</span>
            <span className="tabular-nums">{pesos(s.monto)}</span>
          </div>
        ))}
        {descontadoEnOtroCierre !== 0 && (
          <div className="flex justify-between text-gray-500">
            <span>Ya contado en el cierre de otro turno de hoy</span>
            <span className="tabular-nums">{pesos(-descontadoEnOtroCierre)}</span>
          </div>
        )}
        <div className="mt-1 flex justify-between border-t border-brand-brown/30 pt-1 font-bold text-gray-900">
          <span>Tiene que haber</span>
          <span className="tabular-nums">{pesos(esperado)}</span>
        </div>
      </div>
      {!hayMovimientos && (
        <p className="mt-1 text-[11px] text-gray-500">Hoy no hubo pagos ni gastos en efectivo en esta caja.</p>
      )}
    </div>
  );
}
