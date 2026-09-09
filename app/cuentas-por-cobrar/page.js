"use client";

import { useEffect, useState } from "react";
import { marcarSaldoCobrado, obtenerCobrosConSaldoPendiente } from "@/lib/data/caja";

function formatoPesos(n) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

function formatoFecha(fechaISO) {
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}

export default function CuentasPorCobrarPage() {
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [marcando, setMarcando] = useState(null);

  async function recargar() {
    setCargando(true);
    setError(null);
    try {
      setFilas(await obtenerCobrosConSaldoPendiente());
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    recargar();
  }, []);

  async function marcarCobrado(id) {
    if (!window.confirm("¿Ya se cobró la diferencia? Esto lo saca de la lista de pendientes.")) return;
    setMarcando(id);
    try {
      await marcarSaldoCobrado(id);
      await recargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setMarcando(null);
    }
  }

  const totalPendiente = filas.reduce((acc, f) => acc + f.saldoPendiente, 0);

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">Cuentas por cobrar — Odontología General</h1>
      <p className="mt-1 text-sm text-gray-500">
        Cobros donde se cargaron las prestaciones completas (para liquidar bien al profesional) pero el paciente
        todavía no pagó todo — para no perder de vista la diferencia.
      </p>

      {!cargando && filas.length > 0 && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Total pendiente de cobrar: <span className="font-semibold">{formatoPesos(totalPendiente)}</span> en{" "}
          {filas.length} cobro{filas.length === 1 ? "" : "s"}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-brand-brown text-white">
              <th className="px-3 py-2 text-left font-semibold">Fecha</th>
              <th className="px-3 py-2 text-left font-semibold">Paciente</th>
              <th className="px-3 py-2 text-left font-semibold">Profesional</th>
              <th className="px-3 py-2 text-left font-semibold">Prestaciones</th>
              <th className="px-3 py-2 text-right font-semibold">Total</th>
              <th className="px-3 py-2 text-right font-semibold">Pagado</th>
              <th className="px-3 py-2 text-right font-semibold">Pendiente</th>
              <th className="px-3 py-2"></th>
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
            {!cargando && filas.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-gray-500">
                  No hay cobros con saldo pendiente. 🎉
                </td>
              </tr>
            )}
            {filas.map((f) => (
              <tr key={f.id} className="border-t border-gray-100">
                <td className="px-3 py-2 text-gray-600">{formatoFecha(f.fecha)}</td>
                <td className="px-3 py-2 font-medium text-gray-900">{f.paciente}</td>
                <td className="px-3 py-2 text-gray-600">{f.profesionalAtencion}</td>
                <td className="px-3 py-2 text-gray-600">{f.prestaciones.map((p) => p.prestacion).join(", ") || "—"}</td>
                <td className="px-3 py-2 text-right text-gray-600">{formatoPesos(f.importeTotal)}</td>
                <td className="px-3 py-2 text-right text-gray-600">{formatoPesos(f.pago)}</td>
                <td className="px-3 py-2 text-right font-semibold text-amber-700">{formatoPesos(f.saldoPendiente)}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => marcarCobrado(f.id)}
                    disabled={marcando === f.id}
                    className="rounded-md border border-brand-brown/40 px-2 py-1 text-xs font-medium text-brand-brown hover:bg-brand-tan/30 disabled:opacity-50"
                  >
                    {marcando === f.id ? "..." : "✓ Ya se cobró"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-gray-400">
        Cuando el paciente vuelva a pagar la diferencia, cargala como un cobro nuevo en Caja con la misma prestación
        pero tildando "Sin honorarios" (ya se le liquidó a la profesional acá, no hay que pagarle de nuevo) — y
        después tocá "✓ Ya se cobró" en esta fila.
      </p>
    </main>
  );
}
