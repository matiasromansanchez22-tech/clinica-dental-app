"use client";

import { useState } from "react";
import { actualizarPrestacionCatalogo } from "@/lib/data/catalogo";

export default function CatalogoFilaModal({ prestacion, onClose, onGuardado }) {
  const [valorLista, setValorLista] = useState(prestacion.valor_lista);
  const [valorEfectivo, setValorEfectivo] = useState(prestacion.valor_efectivo);
  const [tiempoEstimado, setTiempoEstimado] = useState(prestacion.tiempo_estimado_min || "");
  const [estado, setEstado] = useState(prestacion.estado);
  const [particular, setParticular] = useState(prestacion.particular);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      await actualizarPrestacionCatalogo(prestacion.id, {
        valor_lista: Number(valorLista),
        valor_efectivo: Number(valorEfectivo),
        tiempo_estimado_min: tiempoEstimado ? Number(tiempoEstimado) : null,
        estado,
        particular,
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
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{prestacion.prestacion}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            ✕
          </button>
        </div>
        <p className="mb-4 text-sm text-gray-500">
          {prestacion.id} · {prestacion.especialidad} {prestacion.categoria ? `· ${prestacion.categoria}` : ""}
        </p>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Precio de Lista
              <input
                type="number"
                value={valorLista}
                onChange={(e) => setValorLista(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Precio Efectivo
              <input
                type="number"
                value={valorEfectivo}
                onChange={(e) => setValorEfectivo(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Tiempo estimado (min)
              <input
                type="number"
                value={tiempoEstimado}
                onChange={(e) => setTiempoEstimado(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Estado
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              >
                <option value="Activo">Activo</option>
                <option value="Inactivo">Inactivo</option>
              </select>
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={particular} onChange={(e) => setParticular(e.target.checked)} />
            Habilitada para pacientes particulares
          </label>

          {prestacion.protocolo && (
            <p className="text-xs text-gray-500">
              <span className="font-medium">Protocolo:</span> {prestacion.protocolo}
            </p>
          )}

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
              {guardando ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
