"use client";

import { useState } from "react";
import { actualizarCobro } from "@/lib/data/caja";

const MEDIOS_PAGO = ["Efectivo", "Transferencia", "Débito", "Crédito", "Mercado Pago", "QR"];

export default function EditarCobroModal({ cobro, onClose, onGuardado }) {
  const [fecha, setFecha] = useState(cobro.fecha);
  const [pago, setPago] = useState(cobro.pago);
  const [medioPago, setMedioPago] = useState(cobro.medioPago);
  const [observaciones, setObservaciones] = useState(cobro.observaciones || "");
  const [precioAnterior, setPrecioAnterior] = useState(Boolean(cobro.precioAnterior));
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  async function guardar(e) {
    e.preventDefault();
    setError(null);
    if (!pago || Number(pago) <= 0) {
      setError("El monto tiene que ser mayor a cero.");
      return;
    }
    setGuardando(true);
    try {
      await actualizarCobro(cobro, {
        fecha,
        pago: Number(pago),
        medioPago,
        observaciones,
        precioAnterior,
      });
      onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold text-brand-brown">Editar cobro</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            ✕
          </button>
        </div>

        <div className="mb-3 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600">
          <p className="font-medium text-gray-900">{cobro.paciente}</p>
          <p className="text-xs text-gray-500">
            {cobro.modalidad === "Plan de financiación"
              ? `Plan ${cobro.idDocumento} · ${cobro.numeroCuota === "Anticipo" ? "Anticipo" : `Cuota ${cobro.numeroCuota}`}`
              : cobro.prestaciones.map((p) => p.prestacion).join(", ") || "—"}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Para cambiar paciente, prestaciones o el profesional que atendió, borrá este cobro y cargalo de nuevo.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
        )}

        <form onSubmit={guardar} className="flex flex-col gap-3">
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
              value={pago}
              onChange={(e) => setPago(e.target.value)}
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
              {MEDIOS_PAGO.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <input
              type="checkbox"
              checked={precioAnterior}
              onChange={(e) => setPrecioAnterior(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Se cobró con precio anterior (todavía no actualizado)
              <span className="block text-xs text-amber-700">
                Al profesional se le liquida por lo cobrado acá, no por el valor de catálogo — útil si no se marcó
                al cargar el cobro.
              </span>
            </span>
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Observaciones
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={2}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            />
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
              {guardando ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
