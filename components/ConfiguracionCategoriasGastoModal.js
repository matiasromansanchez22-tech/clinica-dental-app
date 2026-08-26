"use client";

import { useState } from "react";
import { crearCategoriaGasto } from "@/lib/data/gastos";

export default function ConfiguracionCategoriasGastoModal({ categorias, onClose, onCambiado }) {
  const [nueva, setNueva] = useState("");
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  async function agregar(e) {
    e.preventDefault();
    setError(null);
    if (!nueva.trim()) return;
    setGuardando(true);
    try {
      await crearCategoriaGasto(nueva.trim());
      setNueva("");
      onCambiado();
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
          <h2 className="text-lg font-bold text-gray-900">Categorías de gasto</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
        )}

        <ul className="mb-4 flex flex-col gap-1 text-sm text-gray-700">
          {categorias.map((c) => (
            <li key={c.id} className="rounded-md border border-gray-200 px-3 py-1.5">
              {c.nombre}
            </li>
          ))}
        </ul>

        <form onSubmit={agregar} className="flex gap-2">
          <input
            value={nueva}
            onChange={(e) => setNueva(e.target.value)}
            placeholder="Nueva categoría..."
            className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={guardando}
            className="rounded-md bg-brand-brown px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
          >
            + Agregar
          </button>
        </form>
      </div>
    </div>
  );
}
