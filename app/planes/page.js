"use client";

import { useEffect, useState } from "react";
import { obtenerPlanesFinanciacion } from "@/lib/data/presupuestos";

const ESTADO_COLOR = {
  Activo: "bg-emerald-100 text-emerald-700",
  Finalizado: "bg-blue-100 text-blue-700",
  Cancelado: "bg-gray-100 text-gray-500",
  "En Mora": "bg-red-100 text-red-600",
};

export default function PlanesPage() {
  const [planes, setPlanes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    obtenerPlanesFinanciacion()
      .then(setPlanes)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">Planes de Financiación</h1>
      <p className="mt-1 text-sm text-gray-500">
        Se crean solos al aceptar un presupuesto financiado. Los pagos se van a registrar desde Caja.
      </p>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="px-3 py-2 text-left font-semibold">N.º Plan</th>
              <th className="px-3 py-2 text-left font-semibold">Paciente</th>
              <th className="px-3 py-2 text-right font-semibold">Total</th>
              <th className="px-3 py-2 text-right font-semibold">Anticipo acordado</th>
              <th className="px-3 py-2 text-right font-semibold">Cuotas</th>
              <th className="px-3 py-2 text-right font-semibold">Valor cuota</th>
              <th className="px-3 py-2 text-right font-semibold">Saldo pendiente</th>
              <th className="px-3 py-2 text-left font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-gray-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!cargando && planes.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-gray-500">
                  Todavía no hay planes de financiación.
                </td>
              </tr>
            )}
            {planes.map((p) => (
              <tr key={p.id} className="border-t border-gray-100">
                <td className="px-3 py-2 font-medium text-gray-900">{p.numeroPlan}</td>
                <td className="px-3 py-2 text-gray-600">{p.paciente}</td>
                <td className="px-3 py-2 text-right text-gray-600">
                  ${Number(p.totalTratamiento).toLocaleString("es-AR")}
                </td>
                <td className="px-3 py-2 text-right text-gray-600">
                  ${Number(p.anticipoAcordado).toLocaleString("es-AR")}
                </td>
                <td className="px-3 py-2 text-right text-gray-600">
                  {p.cuotasPagadas}/{p.cantidadCuotas}
                </td>
                <td className="px-3 py-2 text-right text-gray-600">
                  ${Number(p.valorCuota).toLocaleString("es-AR")}
                </td>
                <td className="px-3 py-2 text-right text-gray-600">
                  ${Number(p.saldoPendiente).toLocaleString("es-AR")}
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_COLOR[p.estadoPlan]}`}>
                    {p.estadoPlan}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
