"use client";

import { useState } from "react";
import { actualizarDuracionOrtodoncia } from "@/lib/data/duracionOrtodoncia";

export default function ConfiguracionDuracionOrtodonciaModal({ duraciones, onClose, onCambiado }) {
  const [error, setError] = useState(null);

  async function guardar(concepto, valor) {
    setError(null);
    try {
      await actualizarDuracionOrtodoncia(concepto, Number(valor));
      onCambiado();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Duración por concepto</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            ✕
          </button>
        </div>
        <p className="mb-3 text-xs text-gray-500">
          Minutos por defecto que ocupa cada concepto en la grilla. El botón "Se despegó un bracket" del formulario
          de turno suma 15 minutos extra sobre esto.
        </p>

        {error && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
        )}

        <div className="flex flex-col gap-2">
          {Object.entries(duraciones).map(([concepto, minutos]) => (
            <div key={concepto} className="flex items-center gap-2 text-sm">
              <span className="flex-1 text-gray-700">{concepto}</span>
              <input
                type="number"
                defaultValue={minutos}
                onBlur={(e) => guardar(concepto, e.target.value)}
                className="w-20 rounded-md border border-gray-300 px-2 py-1"
              />
              <span className="text-gray-500">min</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
