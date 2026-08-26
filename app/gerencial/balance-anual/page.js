"use client";

import { useEffect, useState } from "react";
import SoloDuena from "@/components/SoloDuena";
import { fechaDeHoyISO } from "@/lib/agenda";
import { obtenerBalanceAnual } from "@/lib/data/balance";

const NOMBRES_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function formatoMoneda(monto) {
  return `$${Math.round(monto).toLocaleString("es-AR")}`;
}

function TarjetaResumen({ titulo, monto, tono }) {
  const colores = {
    ingreso: "border-brand-mint/50 bg-brand-mint/10 text-brand-green",
    egreso: "border-red-200 bg-red-50 text-red-800",
    balancePositivo: "border-brand-brown/30 bg-brand-tan/20 text-brand-brown",
    balanceNegativo: "border-red-300 bg-red-100 text-red-900",
  };
  return (
    <div className={`rounded-lg border px-5 py-4 ${colores[tono]}`}>
      <p className="text-sm font-medium opacity-80">{titulo}</p>
      <p className="mt-1 text-2xl font-heading font-semibold">{formatoMoneda(monto)}</p>
    </div>
  );
}

function BalanceAnualContenido() {
  const anioActual = Number(fechaDeHoyISO().slice(0, 4));
  const mesActual = Number(fechaDeHoyISO().slice(5, 7));
  const [anio, setAnio] = useState(anioActual);
  const [balance, setBalance] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setCargando(true);
    obtenerBalanceAnual(anio)
      .then(setBalance)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [anio]);

  const maxAbs = balance
    ? Math.max(1, ...balance.meses.map((m) => Math.max(Math.abs(m.ingresos), Math.abs(m.egresos))))
    : 1;

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">Balance Anual</h1>
      <p className="mt-1 text-sm text-gray-500">
        Ingresos, egresos y ganancia mes a mes a lo largo del año, para ver la tendencia de la clínica.
      </p>

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={() => setAnio((a) => a - 1)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          ← Año anterior
        </button>
        <span className="font-heading w-20 text-center text-sm font-semibold text-brand-brown">{anio}</span>
        <button
          onClick={() => setAnio((a) => a + 1)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          Año siguiente →
        </button>
        <button
          onClick={() => setAnio(anioActual)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          Este año
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      {cargando ? (
        <p className="mt-6 text-sm text-gray-500">Cargando...</p>
      ) : (
        balance && (
          <>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <TarjetaResumen titulo={`Ingresos ${anio}`} monto={balance.ingresosTotal} tono="ingreso" />
              <TarjetaResumen titulo={`Egresos ${anio}`} monto={balance.egresosTotal} tono="egreso" />
              <TarjetaResumen
                titulo={`Balance ${anio}`}
                monto={balance.balanceTotal}
                tono={balance.balanceTotal >= 0 ? "balancePositivo" : "balanceNegativo"}
              />
            </div>

            <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-brand-brown text-white">
                    <th className="px-3 py-2 text-left font-semibold">Mes</th>
                    <th className="px-3 py-2 text-right font-semibold">Ingresos</th>
                    <th className="px-3 py-2 text-right font-semibold">Egresos</th>
                    <th className="px-3 py-2 text-right font-semibold">Balance</th>
                    <th className="px-3 py-2 text-left font-semibold">Comparación</th>
                  </tr>
                </thead>
                <tbody>
                  {balance.meses.map((m) => {
                    const esMesActual = anio === anioActual && m.mes === mesActual;
                    const sinDatos = m.ingresos === 0 && m.egresos === 0;
                    return (
                      <tr
                        key={m.mes}
                        className={`border-t border-gray-100 ${esMesActual ? "bg-brand-tan/20" : ""}`}
                      >
                        <td className="px-3 py-2 font-medium text-gray-900">
                          {NOMBRES_MES[m.mes - 1]}
                          {esMesActual && <span className="ml-1 text-xs text-brand-brown">(actual)</span>}
                        </td>
                        <td className="px-3 py-2 text-right text-brand-green">
                          {sinDatos ? "—" : formatoMoneda(m.ingresos)}
                        </td>
                        <td className="px-3 py-2 text-right text-red-700">
                          {sinDatos ? "—" : formatoMoneda(m.egresos)}
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-medium ${
                            m.balance >= 0 ? "text-brand-brown" : "text-red-800"
                          }`}
                        >
                          {sinDatos ? "—" : formatoMoneda(m.balance)}
                        </td>
                        <td className="px-3 py-2">
                          {!sinDatos && (
                            <div className="flex h-3 items-center gap-0.5">
                              <div
                                className="h-full rounded-sm bg-brand-mint"
                                style={{ width: `${(m.ingresos / maxAbs) * 60}px` }}
                              />
                              <div
                                className="h-full rounded-sm bg-red-300"
                                style={{ width: `${(m.egresos / maxAbs) * 60}px` }}
                              />
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )
      )}
    </main>
  );
}

export default function BalanceAnualPage() {
  return (
    <SoloDuena>
      <BalanceAnualContenido />
    </SoloDuena>
  );
}
