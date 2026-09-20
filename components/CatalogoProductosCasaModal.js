"use client";

import { useMemo, useState } from "react";
import { CATALOGO_PRODUCTOS_SUPER } from "@/lib/data/catalogoSuper";
import { agregarItemListaComprasCasa } from "@/lib/data/casa";

export default function CatalogoProductosCasaModal({ onClose, onGuardado }) {
  const [busqueda, setBusqueda] = useState("");
  const [seleccion, setSeleccion] = useState(() => new Map());
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  function toggleProducto(producto, marcado) {
    setSeleccion((s) => {
      const nuevo = new Map(s);
      if (marcado) nuevo.set(producto.nombre, 1);
      else nuevo.delete(producto.nombre);
      return nuevo;
    });
  }

  function cambiarCantidad(nombre, cantidad) {
    setSeleccion((s) => {
      const nuevo = new Map(s);
      nuevo.set(nombre, cantidad);
      return nuevo;
    });
  }

  const grupos = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    const filtrados = termino
      ? CATALOGO_PRODUCTOS_SUPER.filter((p) => p.nombre.toLowerCase().includes(termino))
      : CATALOGO_PRODUCTOS_SUPER;
    const mapa = new Map();
    for (const p of filtrados) {
      if (!mapa.has(p.grupo)) mapa.set(p.grupo, []);
      mapa.get(p.grupo).push(p);
    }
    return Array.from(mapa.entries());
  }, [busqueda]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (seleccion.size === 0) {
      setError("Elegí al menos un producto.");
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      for (const [nombre, cantidad] of seleccion.entries()) {
        const producto = CATALOGO_PRODUCTOS_SUPER.find((p) => p.nombre === nombre);
        await agregarItemListaComprasCasa({
          nombre: producto.nombre,
          categoria: producto.categoria,
          cantidad,
          unidad: producto.unidad,
        });
      }
      onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-lg bg-white shadow-xl">
        <div className="border-b border-gray-100 p-6 pb-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-lg font-bold text-brand-brown">📋 Elegir del catálogo</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
              ✕
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Tildá lo que necesites y poné la cantidad — se agrega todo junto a la Lista de súper.
          </p>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar producto..."
            className="mt-3 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          {error && (
            <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-3">
          {grupos.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">No encontré ningún producto con ese nombre.</p>
          ) : (
            grupos.map(([grupo, productos]) => (
              <div key={grupo} className="mb-4">
                <p className="mb-1.5 text-xs font-semibold uppercase text-gray-400">{grupo}</p>
                <div className="flex flex-col gap-1">
                  {productos.map((p) => {
                    const marcado = seleccion.has(p.nombre);
                    return (
                      <label
                        key={p.nombre}
                        className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                          marcado ? "bg-brand-tan/20" : "hover:bg-gray-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={marcado}
                          onChange={(e) => toggleProducto(p, e.target.checked)}
                          className="h-4 w-4"
                        />
                        <span className="flex-1 text-gray-800">{p.nombre}</span>
                        {marcado && (
                          <>
                            <input
                              type="number"
                              min={0}
                              value={seleccion.get(p.nombre)}
                              onChange={(e) => cambiarCantidad(p.nombre, e.target.value)}
                              className="w-16 rounded-md border border-gray-300 px-2 py-1 text-right text-sm"
                            />
                            <span className="w-16 text-xs text-gray-500">{p.unidad}</span>
                          </>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 p-4">
          <span className="text-sm text-gray-500">
            {seleccion.size} producto{seleccion.size === 1 ? "" : "s"} elegido{seleccion.size === 1 ? "" : "s"}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={guardando || seleccion.size === 0}
              className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
            >
              {guardando ? "Agregando..." : `Agregar a la lista`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
