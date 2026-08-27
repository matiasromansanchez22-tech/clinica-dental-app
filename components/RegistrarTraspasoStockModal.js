"use client";

import { useState } from "react";
import { fechaDeHoyISO } from "@/lib/agenda";
import { registrarTraspaso } from "@/lib/data/stock";

export default function RegistrarTraspasoStockModal({ insumos, rodantes, onClose, onGuardado }) {
  const rodantesDestino = rodantes.filter((r) => !r.es_deposito);
  const [fecha, setFecha] = useState(fechaDeHoyISO());
  const [insumoId, setInsumoId] = useState(insumos[0]?.id ?? "");
  const [rodanteDestinoId, setRodanteDestinoId] = useState(rodantesDestino[0]?.id ?? "");
  const [cantidad, setCantidad] = useState(1);
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!insumoId || !rodanteDestinoId) {
      setError("Elegí un insumo y un rodante destino.");
      return;
    }
    if (!cantidad || Number(cantidad) <= 0) {
      setError("La cantidad tiene que ser mayor a cero.");
      return;
    }
    setGuardando(true);
    try {
      await registrarTraspaso({ fecha, insumoId, rodanteDestinoId, cantidad, observaciones });
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
          <h2 className="font-heading text-lg font-bold text-brand-brown">Completar rodante</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            ✕
          </button>
        </div>
        <p className="mb-3 text-xs text-gray-500">Resta del Stock y suma al rodante que elijas.</p>

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
            Insumo
            <select
              value={insumoId}
              onChange={(e) => setInsumoId(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            >
              {insumos.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Rodante destino
            <select
              value={rodanteDestinoId}
              onChange={(e) => setRodanteDestinoId(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            >
              {rodantesDestino.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Cantidad
            <input
              type="number"
              min={1}
              value={cantidad}
              onChange={(e) => setCantidad(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            />
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
              {guardando ? "Guardando..." : "Registrar traspaso"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
