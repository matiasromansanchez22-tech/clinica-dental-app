"use client";

import { useState } from "react";
import {
  actualizarSaleDeReservaCategoriaGasto,
  actualizarVisibilidadCategoriaGasto,
  crearCategoriaGasto,
} from "@/lib/data/gastos";

export default function ConfiguracionCategoriasGastoModal({ categorias, onClose, onCambiado }) {
  const [nueva, setNueva] = useState("");
  const [nuevaVisibleSecretarios, setNuevaVisibleSecretarios] = useState(false);
  const [nuevaSaleDeReserva, setNuevaSaleDeReserva] = useState(false);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  async function agregar(e) {
    e.preventDefault();
    setError(null);
    if (!nueva.trim()) return;
    setGuardando(true);
    try {
      await crearCategoriaGasto(nueva.trim(), nuevaVisibleSecretarios, nuevaSaleDeReserva);
      setNueva("");
      setNuevaVisibleSecretarios(false);
      setNuevaSaleDeReserva(false);
      onCambiado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function toggleVisible(categoria) {
    try {
      await actualizarVisibilidadCategoriaGasto(categoria.id, !categoria.visible_secretarios);
      onCambiado();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleSaleDeReserva(categoria) {
    try {
      await actualizarSaleDeReservaCategoriaGasto(categoria.id, !categoria.sale_de_reserva);
      onCambiado();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Categorías de gasto</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
        )}

        <p className="mb-2 text-xs text-gray-500">
          Marcá "visible para secretarios" en las categorías chicas del día a día (insumos descartables, imprenta,
          cadete, etc.). Marcá "sale de la reserva" en las que se pagan con la plata de Consultorio (alquiler,
          impuestos, proveedores) en vez de con lo que entra ese día — igual que ya pasa con Sueldos.
        </p>

        <ul className="mb-4 flex flex-col gap-1.5 text-sm text-gray-700">
          {categorias.map((c) => (
            <li key={c.id} className="rounded-md border border-gray-200 px-3 py-2">
              <p className="font-medium text-gray-900">{c.nombre}</p>
              <div className="mt-1 flex flex-wrap gap-3">
                <label className="flex items-center gap-1.5 text-xs text-gray-500">
                  <input
                    type="checkbox"
                    checked={!!c.visible_secretarios}
                    onChange={() => toggleVisible(c)}
                    className="h-3.5 w-3.5"
                  />
                  Visible para secretarios
                </label>
                <label className="flex items-center gap-1.5 text-xs text-gray-500">
                  <input
                    type="checkbox"
                    checked={!!c.sale_de_reserva}
                    onChange={() => toggleSaleDeReserva(c)}
                    className="h-3.5 w-3.5"
                  />
                  Sale de la reserva de Consultorio
                </label>
              </div>
            </li>
          ))}
        </ul>

        <form onSubmit={agregar} className="flex flex-col gap-2">
          <div className="flex gap-2">
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
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="flex items-center gap-1.5 text-xs text-gray-500">
              <input
                type="checkbox"
                checked={nuevaVisibleSecretarios}
                onChange={(e) => setNuevaVisibleSecretarios(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              Visible para secretarios
            </label>
            <label className="flex items-center gap-1.5 text-xs text-gray-500">
              <input
                type="checkbox"
                checked={nuevaSaleDeReserva}
                onChange={(e) => setNuevaSaleDeReserva(e.target.checked)}
                className="h-3.5 w-3.5"
              />
              Sale de la reserva de Consultorio
            </label>
          </div>
        </form>
      </div>
    </div>
  );
}
