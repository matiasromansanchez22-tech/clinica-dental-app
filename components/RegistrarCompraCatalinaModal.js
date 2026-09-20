"use client";

import { useState } from "react";
import { CATEGORIAS_CATALINA, registrarCompraCatalina } from "@/lib/data/catalina";

function filaVacia() {
  return { nombre: "", categoria: CATEGORIAS_CATALINA[0], cantidad: "1", unidad: "" };
}

export default function RegistrarCompraCatalinaModal({ stockActual, onClose, onGuardado }) {
  const [filas, setFilas] = useState([filaVacia(), filaVacia(), filaVacia()]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  function actualizarFila(indice, campo, valor) {
    setFilas((f) => f.map((fila, i) => (i === indice ? { ...fila, [campo]: valor } : fila)));
  }

  function agregarFila() {
    setFilas((f) => [...f, filaVacia()]);
  }

  function quitarFila(indice) {
    setFilas((f) => f.filter((_, i) => i !== indice));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    const validas = filas.filter((f) => f.nombre.trim());
    if (validas.length === 0) {
      setError("Cargá al menos un producto.");
      return;
    }
    setGuardando(true);
    try {
      await registrarCompraCatalina(validas);
      onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold text-brand-brown">🛒 Registrar compra</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            ✕
          </button>
        </div>
        <p className="mb-4 text-xs text-gray-500">
          Cargá todo lo que compraste de una — si un producto ya está en el stock, le suma la cantidad; si es nuevo, lo
          agrega.
        </p>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
        )}

        <datalist id="productos-catalina-existentes">
          {stockActual.map((s) => (
            <option key={s.id} value={s.nombre} />
          ))}
        </datalist>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            {filas.map((fila, i) => (
              <div key={i} className="flex flex-wrap items-center gap-1.5 rounded-md border border-gray-200 p-2">
                <input
                  list="productos-catalina-existentes"
                  value={fila.nombre}
                  onChange={(e) => actualizarFila(i, "nombre", e.target.value)}
                  placeholder="Producto"
                  className="min-w-[9rem] flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
                <select
                  value={fila.categoria}
                  onChange={(e) => actualizarFila(i, "categoria", e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                >
                  {CATEGORIAS_CATALINA.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  value={fila.cantidad}
                  onChange={(e) => actualizarFila(i, "cantidad", e.target.value)}
                  className="w-16 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
                <input
                  value={fila.unidad}
                  onChange={(e) => actualizarFila(i, "unidad", e.target.value)}
                  placeholder="Unidad"
                  className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
                {filas.length > 1 && (
                  <button
                    type="button"
                    onClick={() => quitarFila(i)}
                    className="text-gray-400 hover:text-red-600"
                    aria-label="Quitar línea"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={agregarFila}
            className="self-start text-sm font-medium text-brand-brown hover:underline"
          >
            + Agregar otra línea
          </button>

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
              {guardando ? "Guardando..." : "Guardar compra"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
