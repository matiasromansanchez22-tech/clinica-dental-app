"use client";

import { useState } from "react";
import { fechaDeHoyISO } from "@/lib/agenda";
import { MEDIOS_PAGO_GASTO } from "@/lib/data/gastos";
import { registrarSueldo } from "@/lib/data/finanzasPersonales";

export default function RegistrarSueldoModal({ onClose, onGuardado }) {
  const [fecha, setFecha] = useState(fechaDeHoyISO());
  const [monto, setMonto] = useState("");
  const [medioPago, setMedioPago] = useState("Transferencia");
  const [quien, setQuien] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  async function confirmar() {
    if (!monto || Number(monto) <= 0) {
      setError("Ingresá un monto válido.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await registrarSueldo({ fecha, monto: Number(monto), medioPago, quien, descripcion });
      onGuardado();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">💰 Registrar sueldo</h2>
        <p className="mt-1 text-xs text-gray-500">
          Esto queda como Gasto del consultorio (categoría "Sueldos"), resta del saldo de Consultorio y suma al de Personal.
        </p>

        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

        <label className="mt-4 flex flex-col gap-1 text-xs text-gray-700">
          Monto
          <input
            type="number"
            min={0}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            autoFocus
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="mt-3 flex flex-col gap-1 text-xs text-gray-700">
          ¿Cómo se lo pagaron? (medio de pago)
          <select
            value={medioPago}
            onChange={(e) => setMedioPago(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {MEDIOS_PAGO_GASTO.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-gray-400">
            "Efectivo" va a tu cuenta Efectivo, cualquier otro medio va a tu cuenta Banco.
          </span>
        </label>

        <label className="mt-3 flex flex-col gap-1 text-xs text-gray-700">
          ¿Para quién? (opcional)
          <input
            value={quien}
            onChange={(e) => setQuien(e.target.value)}
            placeholder="Ej. Matías, Marianela..."
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="mt-3 flex flex-col gap-1 text-xs text-gray-700">
          Fecha
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="mt-3 flex flex-col gap-1 text-xs text-gray-700">
          Observaciones (opcional)
          <input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={guardando}
            className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
          >
            {guardando ? "Guardando..." : "Registrar sueldo"}
          </button>
        </div>
      </div>
    </div>
  );
}
