"use client";

import { useEffect, useMemo, useState } from "react";
import { CATEGORIAS_CASA, agregarItemListaComprasCasa } from "@/lib/data/casa";
import { agregarProductoCatalogoSuper, obtenerCatalogoProductosSuper } from "@/lib/data/catalogoSuper";

export default function CatalogoProductosCasaModal({ onClose, onGuardado }) {
  const [catalogo, setCatalogo] = useState([]);
  const [cargandoCatalogo, setCargandoCatalogo] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [seleccion, setSeleccion] = useState(() => new Map());
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoGrupo, setNuevoGrupo] = useState("");
  const [nuevaCategoria, setNuevaCategoria] = useState(CATEGORIAS_CASA[0]);
  const [nuevaUnidad, setNuevaUnidad] = useState("");
  const [guardandoNuevo, setGuardandoNuevo] = useState(false);

  useEffect(() => {
    obtenerCatalogoProductosSuper()
      .then(setCatalogo)
      .catch((e) => setError(e.message))
      .finally(() => setCargandoCatalogo(false));
  }, []);

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
    const filtrados = termino ? catalogo.filter((p) => p.nombre.toLowerCase().includes(termino)) : catalogo;
    const mapa = new Map();
    for (const p of filtrados) {
      if (!mapa.has(p.grupo)) mapa.set(p.grupo, []);
      mapa.get(p.grupo).push(p);
    }
    return Array.from(mapa.entries());
  }, [catalogo, busqueda]);

  const gruposExistentes = useMemo(() => Array.from(new Set(catalogo.map((p) => p.grupo))).sort(), [catalogo]);

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
        const producto = catalogo.find((p) => p.nombre === nombre);
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

  async function agregarAlCatalogo(e) {
    e.preventDefault();
    if (!nuevoNombre.trim() || !nuevoGrupo.trim()) {
      setError("Poné el nombre y el grupo del producto nuevo.");
      return;
    }
    setError(null);
    setGuardandoNuevo(true);
    try {
      const nuevo = await agregarProductoCatalogoSuper({
        nombre: nuevoNombre.trim(),
        grupo: nuevoGrupo.trim(),
        categoria: nuevaCategoria,
        unidad: nuevaUnidad.trim(),
      });
      setCatalogo((c) => [...c, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setSeleccion((s) => new Map(s).set(nuevo.nombre, 1));
      setNuevoNombre("");
      setNuevaUnidad("");
      setMostrarNuevo(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardandoNuevo(false);
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
          {cargandoCatalogo ? (
            <p className="py-6 text-center text-sm text-gray-500">Cargando catálogo...</p>
          ) : grupos.length === 0 ? (
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

          {!cargandoCatalogo && (
            <div className="mt-2 border-t border-gray-100 pt-3">
              {mostrarNuevo ? (
                <form onSubmit={agregarAlCatalogo} className="flex flex-col gap-2 rounded-md border border-gray-200 p-3">
                  <p className="text-xs font-semibold uppercase text-gray-400">Nuevo producto para el catálogo</p>
                  <div className="flex flex-wrap gap-2">
                    <input
                      value={nuevoNombre}
                      onChange={(e) => setNuevoNombre(e.target.value)}
                      placeholder="Nombre (ej. Aceite de oliva)"
                      className="min-w-[10rem] flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    />
                    <input
                      list="grupos-catalogo-super"
                      value={nuevoGrupo}
                      onChange={(e) => setNuevoGrupo(e.target.value)}
                      placeholder="Grupo (ej. Almacén y conservas)"
                      className="min-w-[10rem] flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    />
                    <datalist id="grupos-catalogo-super">
                      {gruposExistentes.map((g) => (
                        <option key={g} value={g} />
                      ))}
                    </datalist>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={nuevaCategoria}
                      onChange={(e) => setNuevaCategoria(e.target.value)}
                      className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    >
                      {CATEGORIAS_CASA.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <input
                      value={nuevaUnidad}
                      onChange={(e) => setNuevaUnidad(e.target.value)}
                      placeholder="Unidad (ej. kg, unidades)"
                      className="w-40 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setMostrarNuevo(false)}
                      className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-white"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={guardandoNuevo}
                      className="rounded-md bg-brand-brown px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
                    >
                      {guardandoNuevo ? "Agregando..." : "Agregar al catálogo"}
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setMostrarNuevo(true)}
                  className="text-sm font-medium text-brand-brown hover:underline"
                >
                  + ¿No está en la lista? Agregalo al catálogo
                </button>
              )}
            </div>
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
