"use client";

import { useState } from "react";
import { crearRodante, eliminarRodante, renombrarRodante } from "@/lib/data/stock";

export default function GestionarRodantesModal({ rodantes, onClose, onCambiado }) {
  const [nuevo, setNuevo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  async function agregar(e) {
    e.preventDefault();
    if (!nuevo.trim()) return;
    setGuardando(true);
    setError(null);
    try {
      await crearRodante(nuevo.trim());
      setNuevo("");
      onCambiado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function renombrar(rodante, nombre) {
    if (!nombre.trim() || nombre === rodante.nombre) return;
    try {
      await renombrarRodante(rodante.id, nombre.trim());
      onCambiado();
    } catch (err) {
      setError(err.message);
    }
  }

  async function borrar(rodante) {
    if (!window.confirm(`¿Borrar "${rodante.nombre}"? También se pierden las cantidades cargadas ahí.`)) return;
    try {
      await eliminarRodante(rodante.id);
      onCambiado();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Rodantes</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
        )}

        <ul className="mb-4 flex flex-col gap-1.5 text-sm text-gray-700">
          {rodantes.map((r) => (
            <li key={r.id} className="flex items-center gap-2 rounded-md border border-gray-200 px-2 py-1.5">
              <input
                defaultValue={r.nombre}
                onBlur={(e) => renombrar(r, e.target.value)}
                className="flex-1 rounded-md border border-gray-200 px-2 py-1 text-sm"
              />
              <button onClick={() => borrar(r)} className="text-xs text-red-600 hover:underline">
                Borrar
              </button>
            </li>
          ))}
        </ul>

        <form onSubmit={agregar} className="flex gap-2">
          <input
            value={nuevo}
            onChange={(e) => setNuevo(e.target.value)}
            placeholder="Nuevo rodante..."
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
