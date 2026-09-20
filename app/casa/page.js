"use client";

import { useEffect, useMemo, useState } from "react";
import ItemCasaFormModal from "@/components/ItemCasaFormModal";
import ItemListaCompraCasaFormModal from "@/components/ItemListaCompraCasaFormModal";
import RegistrarCompraCasaModal from "@/components/RegistrarCompraCasaModal";
import SoloDuena from "@/components/SoloDuena";
import { fechaDeHoyISO } from "@/lib/agenda";
import {
  CATEGORIAS_CASA,
  crearUbicacionCasa,
  eliminarItemCasa,
  eliminarItemListaComprasCasa,
  eliminarUbicacionCasa,
  marcarCompradoListaCasa,
  obtenerItemsCasa,
  obtenerListaComprasCasa,
  obtenerUbicacionesCasa,
  renombrarUbicacionCasa,
} from "@/lib/data/casa";

function formatoFecha(fechaISO) {
  if (!fechaISO) return "—";
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}

function diasHasta(fechaISO, hoyISO) {
  const [a1, m1, d1] = hoyISO.split("-").map(Number);
  const [a2, m2, d2] = fechaISO.split("-").map(Number);
  const hoy = new Date(a1, m1 - 1, d1);
  const otra = new Date(a2, m2 - 1, d2);
  return Math.round((otra - hoy) / (1000 * 60 * 60 * 24));
}

function EstadoVencimiento({ fechaVencimiento, hoy }) {
  if (!fechaVencimiento) return <span className="text-gray-400">—</span>;
  const dias = diasHasta(fechaVencimiento, hoy);
  if (dias < 0) {
    return <span className="font-medium text-red-700">Vencido ({formatoFecha(fechaVencimiento)})</span>;
  }
  if (dias <= 7) {
    return <span className="font-medium text-amber-700">Vence pronto ({formatoFecha(fechaVencimiento)})</span>;
  }
  return <span className="text-gray-600">{formatoFecha(fechaVencimiento)}</span>;
}

function SeccionStockCasa() {
  const hoy = fechaDeHoyISO();
  const [ubicaciones, setUbicaciones] = useState([]);
  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [seccionesCerradas, setSeccionesCerradas] = useState(() => new Set());
  const [busqueda, setBusqueda] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("Todas");
  const [mostrarModal, setMostrarModal] = useState(false);
  const [itemEditando, setItemEditando] = useState(null);
  const [ubicacionParaNuevo, setUbicacionParaNuevo] = useState(null);
  const [mostrarUbicaciones, setMostrarUbicaciones] = useState(false);
  const [nuevaUbicacion, setNuevaUbicacion] = useState("");
  const [guardandoUbicacion, setGuardandoUbicacion] = useState(false);
  const [mostrarCompra, setMostrarCompra] = useState(false);

  async function recargar() {
    setCargando(true);
    try {
      const [u, i] = await Promise.all([obtenerUbicacionesCasa(), obtenerItemsCasa()]);
      setUbicaciones(u);
      setItems(i);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    recargar();
  }, []);

  function toggleSeccion(clave) {
    setSeccionesCerradas((set) => {
      const nuevo = new Set(set);
      if (nuevo.has(clave)) nuevo.delete(clave);
      else nuevo.add(clave);
      return nuevo;
    });
  }

  function abrirNuevo(ubicacionId) {
    setItemEditando(null);
    setUbicacionParaNuevo(ubicacionId || "");
    setMostrarModal(true);
  }

  function abrirEdicion(item) {
    setItemEditando(item);
    setUbicacionParaNuevo(null);
    setMostrarModal(true);
  }

  async function borrarItem(item) {
    if (!window.confirm(`¿Borrar "${item.nombre}" del inventario?`)) return;
    try {
      await eliminarItemCasa(item.id);
      setItems((i) => i.filter((x) => x.id !== item.id));
    } catch (e) {
      setError(e.message);
    }
  }

  async function agregarUbicacion(e) {
    e.preventDefault();
    if (!nuevaUbicacion.trim()) return;
    setGuardandoUbicacion(true);
    setError(null);
    try {
      const nueva = await crearUbicacionCasa(nuevaUbicacion.trim());
      setUbicaciones((u) => [...u, nueva]);
      setNuevaUbicacion("");
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardandoUbicacion(false);
    }
  }

  async function renombrarUbicacion(ubicacion) {
    const nuevoNombre = window.prompt("Nuevo nombre para esta ubicación:", ubicacion.nombre);
    if (!nuevoNombre || !nuevoNombre.trim() || nuevoNombre.trim() === ubicacion.nombre) return;
    try {
      await renombrarUbicacionCasa(ubicacion.id, nuevoNombre.trim());
      setUbicaciones((u) => u.map((x) => (x.id === ubicacion.id ? { ...x, nombre: nuevoNombre.trim() } : x)));
    } catch (e) {
      setError(e.message);
    }
  }

  async function borrarUbicacion(ubicacion) {
    const cantidad = items.filter((i) => i.ubicacion_id === ubicacion.id).length;
    const aviso =
      cantidad > 0
        ? `"${ubicacion.nombre}" tiene ${cantidad} producto(s) cargado(s), van a quedar sin ubicación. ¿Borrar igual?`
        : `¿Borrar la ubicación "${ubicacion.nombre}"?`;
    if (!window.confirm(aviso)) return;
    try {
      await eliminarUbicacionCasa(ubicacion.id);
      setUbicaciones((u) => u.filter((x) => x.id !== ubicacion.id));
      await recargar();
    } catch (e) {
      setError(e.message);
    }
  }

  const itemsFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return items.filter((i) => {
      if (categoriaFiltro !== "Todas" && i.categoria !== categoriaFiltro) return false;
      if (termino && !i.nombre.toLowerCase().includes(termino)) return false;
      return true;
    });
  }, [items, busqueda, categoriaFiltro]);

  const secciones = useMemo(() => {
    const base = ubicaciones.map((u) => ({
      clave: u.id,
      ubicacion: u,
      items: itemsFiltrados.filter((i) => i.ubicacion_id === u.id),
    }));
    const sinUbicacion = itemsFiltrados.filter((i) => !i.ubicacion_id);
    if (sinUbicacion.length > 0 || busqueda.trim() || categoriaFiltro !== "Todas") {
      base.push({ clave: "sin-ubicacion", ubicacion: null, items: sinUbicacion });
    }
    return base;
  }, [ubicaciones, itemsFiltrados, busqueda, categoriaFiltro]);

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          onClick={() => setMostrarCompra(true)}
          className="rounded-md border border-brand-brown/40 px-4 py-2 text-sm font-medium text-brand-brown hover:bg-brand-tan/30"
        >
          🛒 Registrar compra
        </button>
        <button
          onClick={() => abrirNuevo(null)}
          className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark"
        >
          + Agregar producto
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar producto..."
          className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <select
          value={categoriaFiltro}
          onChange={(e) => setCategoriaFiltro(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="Todas">Todas las categorías</option>
          {CATEGORIAS_CASA.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          onClick={() => setMostrarUbicaciones((m) => !m)}
          className="ml-auto rounded-md border border-brand-brown/40 px-3 py-2 text-sm font-medium text-brand-brown hover:bg-brand-tan/30"
        >
          {mostrarUbicaciones ? "Ocultar ubicaciones" : "Gestionar ubicaciones"}
        </button>
      </div>

      {mostrarUbicaciones && (
        <div className="mt-3 rounded-lg border border-gray-200 p-4">
          <p className="mb-2 text-xs font-semibold uppercase text-gray-400">Ubicaciones</p>
          <ul className="flex flex-col gap-1 text-sm text-gray-700">
            {ubicaciones.map((u) => (
              <li key={u.id} className="flex items-center justify-between border-b border-gray-100 py-1 last:border-0">
                <span>{u.nombre}</span>
                <span className="flex gap-2 text-xs">
                  <button onClick={() => renombrarUbicacion(u)} className="text-brand-brown hover:underline">
                    Renombrar
                  </button>
                  <button onClick={() => borrarUbicacion(u)} className="text-red-600 hover:underline">
                    Borrar
                  </button>
                </span>
              </li>
            ))}
          </ul>
          <form onSubmit={agregarUbicacion} className="mt-3 flex gap-2">
            <input
              value={nuevaUbicacion}
              onChange={(e) => setNuevaUbicacion(e.target.value)}
              placeholder="Nueva ubicación (ej. Botiquín)"
              className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
            <button
              type="submit"
              disabled={guardandoUbicacion}
              className="rounded-md bg-brand-brown px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
            >
              + Agregar
            </button>
          </form>
        </div>
      )}

      {cargando ? (
        <p className="mt-6 text-sm text-gray-500">Cargando...</p>
      ) : (
        <>
          {secciones.map((s) => {
            const abierta = !seccionesCerradas.has(s.clave);
            const nombreSeccion = s.ubicacion ? s.ubicacion.nombre : "Sin ubicación";
            return (
              <div key={s.clave} className="mt-4 overflow-hidden rounded-lg border border-gray-200">
                <button
                  type="button"
                  onClick={() => toggleSeccion(s.clave)}
                  className="flex w-full items-center justify-between bg-brand-tan/20 px-4 py-3 text-left hover:bg-brand-tan/30"
                >
                  <span className="font-heading text-sm font-semibold text-brand-brown">
                    {abierta ? "▾" : "▸"} {nombreSeccion}
                  </span>
                  <span className="flex items-center gap-3 text-xs text-gray-500">
                    {s.items.length} producto{s.items.length === 1 ? "" : "s"}
                    {s.ubicacion && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          abrirNuevo(s.ubicacion.id);
                        }}
                        className="cursor-pointer font-medium text-brand-brown hover:underline"
                      >
                        + Agregar acá
                      </span>
                    )}
                  </span>
                </button>
                {abierta && (
                  <div className="overflow-x-auto">
                    {s.items.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-gray-500">No hay productos acá todavía.</p>
                    ) : (
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="bg-brand-brown text-white">
                            <th className="px-3 py-2 text-left font-semibold">Producto</th>
                            <th className="px-3 py-2 text-left font-semibold">Categoría</th>
                            <th className="px-3 py-2 text-right font-semibold">Cantidad</th>
                            <th className="px-3 py-2 text-left font-semibold">Vencimiento</th>
                            <th className="px-3 py-2"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {s.items.map((item) => (
                            <tr key={item.id} className="border-t border-gray-100">
                              <td className="px-3 py-2 font-medium text-gray-900">
                                {item.nombre}
                                {item.notas && <p className="mt-0.5 text-xs font-normal text-gray-500">{item.notas}</p>}
                              </td>
                              <td className="px-3 py-2 text-gray-600">{item.categoria}</td>
                              <td className="px-3 py-2 text-right text-gray-600">
                                {item.cantidad} {item.unidad || ""}
                              </td>
                              <td className="px-3 py-2">
                                <EstadoVencimiento fechaVencimiento={item.fecha_vencimiento} hoy={hoy} />
                              </td>
                              <td className="px-3 py-2 text-right whitespace-nowrap">
                                <button
                                  onClick={() => abrirEdicion(item)}
                                  className="mr-2 text-xs text-brand-brown hover:underline"
                                >
                                  Editar
                                </button>
                                <button onClick={() => borrarItem(item)} className="text-xs text-red-600 hover:underline">
                                  Borrar
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {items.length === 0 && (
            <p className="mt-6 text-sm text-gray-500">Todavía no cargaste ningún producto.</p>
          )}
        </>
      )}

      {mostrarModal && (
        <ItemCasaFormModal
          item={itemEditando}
          ubicaciones={ubicaciones}
          ubicacionIdPredeterminada={ubicacionParaNuevo}
          onClose={() => setMostrarModal(false)}
          onGuardado={async () => {
            await recargar();
            setMostrarModal(false);
          }}
        />
      )}

      {mostrarCompra && (
        <RegistrarCompraCasaModal
          itemsActuales={items}
          ubicaciones={ubicaciones}
          onClose={() => setMostrarCompra(false)}
          onGuardado={async () => {
            await recargar();
            setMostrarCompra(false);
          }}
        />
      )}
    </>
  );
}

function SeccionListaComprasCasa() {
  const [ubicaciones, setUbicaciones] = useState([]);
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [tildando, setTildando] = useState(null);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [itemEditando, setItemEditando] = useState(null);

  async function recargar() {
    setCargando(true);
    try {
      const [u, l] = await Promise.all([obtenerUbicacionesCasa(), obtenerListaComprasCasa()]);
      setUbicaciones(u);
      setLista(l);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    recargar();
  }, []);

  function abrirNuevo() {
    setItemEditando(null);
    setMostrarModal(true);
  }

  function abrirEdicion(item) {
    setItemEditando(item);
    setMostrarModal(true);
  }

  async function tildarComprado(item) {
    setError(null);
    setTildando(item.id);
    try {
      await marcarCompradoListaCasa(item);
      setLista((l) => l.filter((x) => x.id !== item.id));
    } catch (e) {
      setError(e.message);
    } finally {
      setTildando(null);
    }
  }

  async function quitarSinComprar(item) {
    if (!window.confirm(`¿Sacar "${item.nombre}" de la lista sin sumarlo al inventario?`)) return;
    try {
      await eliminarItemListaComprasCasa(item.id);
      setLista((l) => l.filter((x) => x.id !== item.id));
    } catch (e) {
      setError(e.message);
    }
  }

  const nombreUbicacion = (ubicacionId) => ubicaciones.find((u) => u.id === ubicacionId)?.nombre || "Sin ubicación";

  return (
    <>
      <div className="flex justify-end">
        <button
          onClick={abrirNuevo}
          className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark"
        >
          + Agregar a la lista
        </button>
      </div>

      <p className="mt-3 text-xs text-gray-500">
        Tildá lo que vayas comprando — se suma solo a la cantidad que ya tenés en el inventario y sale de esta lista.
      </p>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      {cargando ? (
        <p className="mt-6 text-sm text-gray-500">Cargando...</p>
      ) : lista.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">La lista está vacía — agregá lo que haga falta comprar.</p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
          <ul className="divide-y divide-gray-100">
            {lista.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={false}
                  disabled={tildando === item.id}
                  onChange={() => tildarComprado(item)}
                  className="h-4 w-4"
                />
                <span className="flex-1 text-sm text-gray-900">
                  {item.nombre}{" "}
                  <span className="text-gray-500">
                    — {item.cantidad} {item.unidad || ""} · {nombreUbicacion(item.ubicacion_id)}
                  </span>
                  {item.notas && <span className="block text-xs text-gray-500">{item.notas}</span>}
                </span>
                <button onClick={() => abrirEdicion(item)} className="text-xs text-brand-brown hover:underline">
                  Editar
                </button>
                <button onClick={() => quitarSinComprar(item)} className="text-xs text-red-600 hover:underline">
                  Sacar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {mostrarModal && (
        <ItemListaCompraCasaFormModal
          item={itemEditando}
          ubicaciones={ubicaciones}
          onClose={() => setMostrarModal(false)}
          onGuardado={async () => {
            await recargar();
            setMostrarModal(false);
          }}
        />
      )}
    </>
  );
}

function CasaContenido() {
  const [pestana, setPestana] = useState("stock");

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">🏠 Casa</h1>
      <p className="mt-1 text-sm text-gray-500">
        Inventario privado de la casa — solo lo ven Matías y Marianela. No tiene nada que ver con la clínica.
      </p>

      <div className="mt-4 flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setPestana("stock")}
          className={`px-3 py-2 text-sm font-medium ${
            pestana === "stock" ? "border-b-2 border-brand-brown text-brand-brown" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          📦 Stock
        </button>
        <button
          onClick={() => setPestana("lista")}
          className={`px-3 py-2 text-sm font-medium ${
            pestana === "lista" ? "border-b-2 border-brand-brown text-brand-brown" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          🛒 Lista de súper
        </button>
      </div>

      {pestana === "stock" && <SeccionStockCasa />}
      {pestana === "lista" && <SeccionListaComprasCasa />}
    </main>
  );
}

export default function CasaPage() {
  return (
    <SoloDuena>
      <CasaContenido />
    </SoloDuena>
  );
}
