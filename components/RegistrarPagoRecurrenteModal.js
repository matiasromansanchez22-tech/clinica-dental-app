"use client";

import { useState } from "react";
import { fechaDeHoyISO } from "@/lib/agenda";
import { MEDIOS_PAGO_GASTO } from "@/lib/data/gastos";
import { registrarPagoRecurrente } from "@/lib/data/gastosRecurrentes";

export default function RegistrarPagoRecurrenteModal({ gastoRecurrente, categorias, onClose, onGuardado }) {
  const [fecha, setFecha] = useState(fechaDeHoyISO());
  const [monto, setMonto] = useState(gastoRecurrente.montoSugerido ?? "");
  const [medioPago, setMedioPago] = useState("Transferencia");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!monto || Number(monto) <= 0) {
      setError("El monto tiene que ser mayor a cero.");
      return;
    }
    setGuardando(true);
    try {
      await registrarPagoRecurrente(gastoRecurrente, { fecha, monto, medioPago }, categorias);
      onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold text-brand-brown">Registrar pago</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            ✕
          </button>
        </div>
        <p className="mb-3 text-sm text-gray-600">
          {gastoRecurrente.nombre} <span className="text-gray-400">({gastoRecurrente.categoria})</span>
        </p>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Fecha
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Monto
            <input
              type="number"
              autoFocus
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Medio de pago
            <select
              value={medioPago}
              onChange={(e) => setMedioPago(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            >
              {MEDIOS_PAGO_GASTO.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
            >
              {guardando ? "Guardando..." : "✅ Marcar como pagado"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
