"use client";

import { useState } from "react";
import {
  actualizarEscalaCopago,
  actualizarExcepcionCopago,
  crearExcepcionCopago,
  eliminarExcepcionCopago,
} from "@/lib/data/nomenclador";

export default function ConfiguracionCopagoModal({ escalas, excepciones, onClose, onCambiado }) {
  const [filasEscala, setFilasEscala] = useState(escalas);
  const [filasExcepcion, setFilasExcepcion] = useState(excepciones);
  const [nuevaObraSocial, setNuevaObraSocial] = useState("");
  const [nuevoPorcentaje, setNuevoPorcentaje] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  async function guardarEscala(id, porcentaje) {
    setError(null);
    try {
      await actualizarEscalaCopago(id, Number(porcentaje));
      onCambiado();
    } catch (e) {
      setError(e.message);
    }
  }

  async function guardarExcepcion(id, porcentaje) {
    setError(null);
    try {
      await actualizarExcepcionCopago(id, { porcentaje: Number(porcentaje) });
      onCambiado();
    } catch (e) {
      setError(e.message);
    }
  }

  async function borrarExcepcion(id) {
    if (!window.confirm("¿Quitar esta excepción? Esa obra social va a volver a usar la escala general.")) return;
    setError(null);
    try {
      await eliminarExcepcionCopago(id);
      setFilasExcepcion((f) => f.filter((x) => x.id !== id));
      onCambiado();
    } catch (e) {
      setError(e.message);
    }
  }

  async function agregarExcepcion(e) {
    e.preventDefault();
    if (!nuevaObraSocial.trim() || !nuevoPorcentaje) return;
    setGuardando(true);
    setError(null);
    try {
      await crearExcepcionCopago({ obraSocial: nuevaObraSocial.trim(), porcentaje: Number(nuevoPorcentaje) });
      setNuevaObraSocial("");
      setNuevoPorcentaje("");
      onCambiado();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Configuración del copago</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
        )}

        <h3 className="mb-2 text-sm font-semibold text-gray-900">Escala general (según el Valor OS)</h3>
        <div className="mb-6 flex flex-col gap-2">
          {filasEscala
            .slice()
            .sort((a, b) => a.orden - b.orden)
            .map((fila, i, arr) => {
              const desde = i === 0 ? 0 : arr[i - 1].umbral_maximo;
              return (
                <div key={fila.id} className="flex items-center gap-2 text-sm">
                  <span className="w-48 text-gray-600">
                    {fila.umbral_maximo === null
                      ? `Más de $${Number(desde).toLocaleString("es-AR")}`
                      : `$${Number(desde).toLocaleString("es-AR")} — $${Number(fila.umbral_maximo).toLocaleString("es-AR")}`}
                  </span>
                  <input
                    type="number"
                    defaultValue={fila.porcentaje}
                    onBlur={(e) => guardarEscala(fila.id, e.target.value)}
                    className="w-20 rounded-md border border-gray-300 px-2 py-1"
                  />
                  <span className="text-gray-500">%</span>
                </div>
              );
            })}
        </div>

        <h3 className="mb-2 text-sm font-semibold text-gray-900">Excepciones por obra social</h3>
        <p className="mb-2 text-xs text-gray-500">
          Una obra social con excepción usa este porcentaje fijo en vez de la escala general (ej. IAPOS = 200%).
        </p>
        <div className="mb-3 flex flex-col gap-2">
          {filasExcepcion.map((fila) => (
            <div key={fila.id} className="flex items-center gap-2 text-sm">
              <span className="w-32 truncate text-gray-800">{fila.obra_social}</span>
              <input
                type="number"
                defaultValue={fila.porcentaje}
                onBlur={(e) => guardarExcepcion(fila.id, e.target.value)}
                className="w-20 rounded-md border border-gray-300 px-2 py-1"
              />
              <span className="text-gray-500">%</span>
              <button onClick={() => borrarExcepcion(fila.id)} className="ml-auto text-xs text-red-600 hover:underline">
                Quitar
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={agregarExcepcion} className="flex items-center gap-2">
          <input
            value={nuevaObraSocial}
            onChange={(e) => setNuevaObraSocial(e.target.value)}
            placeholder="Nombre de la obra social"
            className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
          <input
            type="number"
            value={nuevoPorcentaje}
            onChange={(e) => setNuevoPorcentaje(e.target.value)}
            placeholder="%"
            className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={guardando}
            className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
          >
            Agregar
          </button>
        </form>
      </div>
    </div>
  );
}
