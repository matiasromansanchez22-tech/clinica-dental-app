"use client";

import { useState } from "react";
import { crearTransferenciaCaja } from "@/lib/data/transferenciasCaja";

const MEDIOS_PAGO = ["Efectivo", "Transferencia", "Débito", "Crédito", "Mercado Pago", "QR"];

// cajaActual: "General" | "Ortodoncia" — desde qué Caja se abrió el modal,
// para armar las dos direcciones posibles (mandarle a la otra, o recibir
// de la otra) sin que la secretaria tenga que pensar en "origen/destino".
export default function TransferenciaCajaModal({ fecha, cajaActual, onClose, onGuardado }) {
  const otraCaja = cajaActual === "General" ? "Ortodoncia" : "General";
  const [direccion, setDireccion] = useState("enviar"); // "enviar" | "recibir"
  const [monto, setMonto] = useState("");
  const [medioPago, setMedioPago] = useState("Efectivo");
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!monto || Number(monto) <= 0) {
      setError("El monto tiene que ser mayor a cero.");
      return;
    }
    const origen = direccion === "enviar" ? cajaActual : otraCaja;
    const destino = direccion === "enviar" ? otraCaja : cajaActual;
    setGuardando(true);
    try {
      await crearTransferenciaCaja({ fecha, monto: Number(monto), origen, destino, medioPago, observaciones });
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
          <h2 className="font-heading text-lg font-bold text-brand-brown">🔄 Transferencia entre cajas</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            ✕
          </button>
        </div>

        <p className="mb-3 text-sm text-gray-600">
          Para cuando a una caja le faltó plata y se cubrió con la de la otra — se resta de una y se suma a la otra
          automáticamente, así ninguna de las dos queda con un número que no se explica solo.
        </p>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Dirección
            <select
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            >
              <option value="enviar">Le mando plata a Caja {otraCaja}</option>
              <option value="recibir">Recibo plata de Caja {otraCaja}</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Monto
            <input
              type="number"
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
              {MEDIOS_PAGO.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Observaciones
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={2}
              placeholder="Ej: para completar el pago a Catalina"
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
              {guardando ? "Guardando..." : "Registrar transferencia"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
