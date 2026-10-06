"use client";

import { DENOMINACIONES, totalContado } from "@/lib/billetes";

function pesos(n) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

// Contador de billetes: se carga cuántos billetes hay de cada valor y suma
// solo. Compara contra el efectivo que tendría que haber ("esperado").
export default function ContadorBilletes({
  conteo,
  onChange,
  esperado = null,
  etiquetaEsperado = "Efectivo que figura en tus cobros",
  deshabilitado,
}) {
  const contado = totalContado(conteo);
  const hayEsperado = esperado !== null && esperado !== undefined;
  const diferencia = contado - (hayEsperado ? esperado : 0);
  const hayConteo = contado > 0;

  function cambiarCantidad(denominacion, cantidad) {
    const limpia = Math.max(0, Math.floor(Number(cantidad) || 0));
    onChange({ ...conteo, billetes: { ...conteo.billetes, [denominacion]: limpia } });
  }

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-sm font-semibold text-brand-brown">💵 Contar el efectivo</h2>
        {hayConteo && !deshabilitado && (
          <button
            type="button"
            onClick={() => onChange({ billetes: {}, monedas: "" })}
            className="text-xs text-gray-400 hover:text-red-600"
          >
            Empezar de nuevo
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-gray-500">
        Contá los billetes de la caja y anotá cuántos hay de cada valor — el total se suma solo.
      </p>

      <div className="mt-3 flex flex-col gap-1.5">
        {DENOMINACIONES.map((d) => {
          const cantidad = Number(conteo.billetes?.[d]) || 0;
          return (
            <div key={d} className="flex items-center gap-2 text-sm">
              <span className="w-20 font-medium text-gray-800 tabular-nums">{pesos(d)}</span>
              <span className="text-gray-400">×</span>
              <button
                type="button"
                onClick={() => cambiarCantidad(d, cantidad - 1)}
                disabled={deshabilitado || cantidad === 0}
                aria-label={`Restar un billete de ${pesos(d)}`}
                className="h-8 w-8 rounded-md border border-gray-300 text-base leading-none hover:bg-gray-50 disabled:opacity-40"
              >
                −
              </button>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                value={cantidad === 0 ? "" : cantidad}
                placeholder="0"
                disabled={deshabilitado}
                onChange={(e) => cambiarCantidad(d, e.target.value)}
                aria-label={`Cantidad de billetes de ${pesos(d)}`}
                className="w-16 rounded-md border border-gray-300 px-2 py-1 text-center tabular-nums"
              />
              <button
                type="button"
                onClick={() => cambiarCantidad(d, cantidad + 1)}
                disabled={deshabilitado}
                aria-label={`Sumar un billete de ${pesos(d)}`}
                className="h-8 w-8 rounded-md border border-gray-300 text-base leading-none hover:bg-gray-50 disabled:opacity-40"
              >
                +
              </button>
              <span className="ml-auto text-gray-600 tabular-nums">{cantidad > 0 ? pesos(d * cantidad) : ""}</span>
            </div>
          );
        })}
        <div className="flex items-center gap-2 text-sm">
          <span className="w-20 font-medium text-gray-800">Monedas y otros</span>
          <input
            type="number"
            min={0}
            inputMode="numeric"
            value={conteo.monedas}
            placeholder="Monto en $"
            disabled={deshabilitado}
            onChange={(e) => onChange({ ...conteo, monedas: e.target.value })}
            aria-label="Monto en monedas y otros billetes"
            className="ml-[3.25rem] w-32 rounded-md border border-gray-300 px-2 py-1 tabular-nums"
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-3 text-sm">
        <div>
          <p className="text-xs text-gray-500">Total contado</p>
          <p className="text-lg font-semibold text-gray-900 tabular-nums">{pesos(contado)}</p>
        </div>
        {hayEsperado && (
          <div>
            <p className="text-xs text-gray-500">{etiquetaEsperado}</p>
            <p className="text-lg font-semibold text-gray-900 tabular-nums">{pesos(esperado)}</p>
          </div>
        )}
      </div>

      {hayConteo &&
        hayEsperado &&
        (Math.round(diferencia) === 0 ? (
          <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
            ✓ Coincide: no sobra ni falta nada.
          </p>
        ) : diferencia > 0 ? (
          <p className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
            Sobran {pesos(diferencia)} respecto de lo esperado.
          </p>
        ) : (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
            Faltan {pesos(-diferencia)} respecto de lo esperado.
          </p>
        ))}
    </div>
  );
}
