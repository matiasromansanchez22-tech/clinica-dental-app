"use client";

import { useEffect, useMemo, useState } from "react";
import AlimentoCatalinaFormModal from "@/components/AlimentoCatalinaFormModal";
import ItemStockCatalinaFormModal from "@/components/ItemStockCatalinaFormModal";
import SoloDuena from "@/components/SoloDuena";
import {
  CATEGORIAS_CATALINA,
  ESTADOS_ALIMENTO_CATALINA,
  actualizarCantidadStockCatalina,
  eliminarAlimentoCatalina,
  eliminarItemStockCatalina,
  obtenerAlimentosCatalina,
  obtenerStockCatalina,
} from "@/lib/data/catalina";

function formatoFecha(fechaISO) {
  if (!fechaISO) return "—";
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}

const ESTILO_ESTADO = {
  "Le gustó": "bg-emerald-100 text-emerald-700",
  "No le gustó": "bg-gray-100 text-gray-600",
  "Alergia o reacción": "bg-red-100 text-red-700",
  "A probar de nuevo": "bg-amber-100 text-amber-700",
};

function BadgeEstado({ estado }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTILO_ESTADO[estado] || "bg-gray-100 text-gray-600"}`}>
      {estado}
    </span>
  );
}

function CeldaCantidad({ valor, onGuardar }) {
  return (
    <input
      type="number"
      min={0}
      defaultValue={valor}
      onBlur={(e) => onGuardar(e.target.value)}
      className="w-20 rounded-md border border-gray-300 px-2 py-1 text-right text-sm"
    />
  );
}

function SeccionAlimentos() {
  const [alimentos, setAlimentos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [seccionesCerradas, setSeccionesCerradas] = useState(() => new Set());
  const [busqueda, setBusqueda] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("Todas");
  const [estadoFiltro, setEstadoFiltro] = useState("Todos");
  const [mostrarModal, setMostrarModal] = useState(false);
  const [alimentoEditando, setAlimentoEditando] = useState(null);
  const [categoriaParaNuevo, setCategoriaParaNuevo] = useState(null);

  async function recargar() {
    setCargando(true);
    try {
      const a = await obtenerAlimentosCatalina();
      setAlimentos(a);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    recargar();
  }, []);

  function toggleSeccion(categoria) {
    setSeccionesCerradas((set) => {
      const nuevo = new Set(set);
      if (nuevo.has(categoria)) nuevo.delete(categoria);
      else nuevo.add(categoria);
      return nuevo;
    });
  }

  function abrirNuevo(categoria) {
    setAlimentoEditando(null);
    setCategoriaParaNuevo(categoria || null);
    setMostrarModal(true);
  }

  function abrirEdicion(alimento) {
    setAlimentoEditando(alimento);
    setCategoriaParaNuevo(null);
    setMostrarModal(true);
  }

  async function borrarAlimento(alimento) {
    if (!window.confirm(`¿Borrar "${alimento.nombre}" del registro?`)) return;
    try {
      await eliminarAlimentoCatalina(alimento.id);
      setAlimentos((a) => a.filter((x) => x.id !== alimento.id));
    } catch (e) {
      setError(e.message);
    }
  }

  const alimentosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return alimentos.filter((a) => {
      if (categoriaFiltro !== "Todas" && a.categoria !== categoriaFiltro) return false;
      if (estadoFiltro !== "Todos" && a.estado !== estadoFiltro) return false;
      if (termino && !a.nombre.toLowerCase().includes(termino)) return false;
      return true;
    });
  }, [alimentos, busqueda, categoriaFiltro, estadoFiltro]);

  const secciones = useMemo(
    () =>
      CATEGORIAS_CATALINA.map((c) => ({
        categoria: c,
        items: alimentosFiltrados
          .filter((a) => a.categoria === c)
          .sort((x, y) => (y.fecha_primera_vez || "").localeCompare(x.fecha_primera_vez || "")),
      })).filter((s) => s.items.length > 0 || (categoriaFiltro === "Todas" && !busqueda.trim() && estadoFiltro === "Todos")),
    [alimentosFiltrados, categoriaFiltro, busqueda, estadoFiltro]
  );

  const conAlergia = alimentos.filter((a) => a.estado === "Alergia o reacción");

  return (
    <>
      <div className="flex justify-end">
        <button
          onClick={() => abrirNuevo(null)}
          className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark"
        >
          + Agregar alimento
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      {!cargando && (
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <span className="rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-gray-700">
            {alimentos.length} alimento{alimentos.length === 1 ? "" : "s"} probado{alimentos.length === 1 ? "" : "s"}
          </span>
          {conAlergia.length > 0 && (
            <span className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 font-medium text-red-700">
              ⚠️ {conAlergia.length} con alergia o reacción: {conAlergia.map((a) => a.nombre).join(", ")}
            </span>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar alimento..."
          className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <select
          value={categoriaFiltro}
          onChange={(e) => setCategoriaFiltro(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="Todas">Todas las categorías</option>
          {CATEGORIAS_CATALINA.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={estadoFiltro}
          onChange={(e) => setEstadoFiltro(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="Todos">Todos los estados</option>
          {ESTADOS_ALIMENTO_CATALINA.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </div>

      {cargando ? (
        <p className="mt-6 text-sm text-gray-500">Cargando...</p>
      ) : (
        <>
          {secciones.map((s) => {
            const abierta = !seccionesCerradas.has(s.categoria);
            return (
              <div key={s.categoria} className="mt-4 overflow-hidden rounded-lg border border-gray-200">
                <button
                  type="button"
                  onClick={() => toggleSeccion(s.categoria)}
                  className="flex w-full items-center justify-between bg-brand-tan/20 px-4 py-3 text-left hover:bg-brand-tan/30"
                >
                  <span className="font-heading text-sm font-semibold text-brand-brown">
                    {abierta ? "▾" : "▸"} {s.categoria}
                  </span>
                  <span className="flex items-center gap-3 text-xs text-gray-500">
                    {s.items.length} alimento{s.items.length === 1 ? "" : "s"}
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        abrirNuevo(s.categoria);
                      }}
                      className="cursor-pointer font-medium text-brand-brown hover:underline"
                    >
                      + Agregar acá
                    </span>
                  </span>
                </button>
                {abierta && (
                  <div className="overflow-x-auto">
                    {s.items.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-gray-500">Todavía no probó nada de esta categoría.</p>
                    ) : (
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="bg-brand-brown text-white">
                            <th className="px-3 py-2 text-left font-semibold">Alimento</th>
                            <th className="px-3 py-2 text-left font-semibold">Primera vez</th>
                            <th className="px-3 py-2 text-left font-semibold">¿Cómo le fue?</th>
                            <th className="px-3 py-2"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {s.items.map((a) => (
                            <tr
                              key={a.id}
                              className={`border-t border-gray-100 ${a.estado === "Alergia o reacción" ? "bg-red-50" : ""}`}
                            >
                              <td className="px-3 py-2 font-medium text-gray-900">
                                {a.nombre}
                                {a.notas && <p className="mt-0.5 text-xs font-normal text-gray-500">{a.notas}</p>}
                              </td>
                              <td className="px-3 py-2 text-gray-600">{formatoFecha(a.fecha_primera_vez)}</td>
                              <td className="px-3 py-2">
                                <BadgeEstado estado={a.estado} />
                              </td>
                              <td className="px-3 py-2 text-right whitespace-nowrap">
                                <button
                                  onClick={() => abrirEdicion(a)}
                                  className="mr-2 text-xs text-brand-brown hover:underline"
                                >
                                  Editar
                                </button>
                                <button onClick={() => borrarAlimento(a)} className="text-xs text-red-600 hover:underline">
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

          {alimentos.length === 0 && (
            <p className="mt-6 text-sm text-gray-500">Todavía no cargaste ningún alimento.</p>
          )}
        </>
      )}

      {mostrarModal && (
        <AlimentoCatalinaFormModal
          alimento={alimentoEditando}
          categoriaPredeterminada={categoriaParaNuevo}
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

function SeccionStock() {
  const [stock, setStock] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [seccionesCerradas, setSeccionesCerradas] = useState(() => new Set());
  const [busqueda, setBusqueda] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("Todas");
  const [mostrarModal, setMostrarModal] = useState(false);
  const [itemEditando, setItemEditando] = useState(null);
  const [categoriaParaNuevo, setCategoriaParaNuevo] = useState(null);

  async function recargar() {
    setCargando(true);
    try {
      const s = await obtenerStockCatalina();
      setStock(s);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    recargar();
  }, []);

  function toggleSeccion(categoria) {
    setSeccionesCerradas((set) => {
      const nuevo = new Set(set);
      if (nuevo.has(categoria)) nuevo.delete(categoria);
      else nuevo.add(categoria);
      return nuevo;
    });
  }

  function abrirNuevo(categoria) {
    setItemEditando(null);
    setCategoriaParaNuevo(categoria || null);
    setMostrarModal(true);
  }

  function abrirEdicion(item) {
    setItemEditando(item);
    setCategoriaParaNuevo(null);
    setMostrarModal(true);
  }

  async function guardarCantidad(item, valor) {
    setError(null);
    try {
      await actualizarCantidadStockCatalina(item.id, valor);
      setStock((s) => s.map((x) => (x.id === item.id ? { ...x, cantidad: Number(valor) || 0 } : x)));
    } catch (e) {
      setError(e.message);
    }
  }

  async function borrarItem(item) {
    if (!window.confirm(`¿Borrar "${item.nombre}" del stock?`)) return;
    try {
      await eliminarItemStockCatalina(item.id);
      setStock((s) => s.filter((x) => x.id !== item.id));
    } catch (e) {
      setError(e.message);
    }
  }

  const stockFiltrado = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    return stock.filter((i) => {
      if (categoriaFiltro !== "Todas" && i.categoria !== categoriaFiltro) return false;
      if (termino && !i.nombre.toLowerCase().includes(termino)) return false;
      return true;
    });
  }, [stock, busqueda, categoriaFiltro]);

  const secciones = useMemo(
    () =>
      CATEGORIAS_CATALINA.map((c) => ({
        categoria: c,
        items: stockFiltrado.filter((i) => i.categoria === c),
      })).filter((s) => s.items.length > 0 || (categoriaFiltro === "Todas" && !busqueda.trim())),
    [stockFiltrado, categoriaFiltro, busqueda]
  );

  return (
    <>
      <div className="flex justify-end">
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
          {CATEGORIAS_CATALINA.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {cargando ? (
        <p className="mt-6 text-sm text-gray-500">Cargando...</p>
      ) : (
        <>
          {secciones.map((s) => {
            const abierta = !seccionesCerradas.has(s.categoria);
            return (
              <div key={s.categoria} className="mt-4 overflow-hidden rounded-lg border border-gray-200">
                <button
                  type="button"
                  onClick={() => toggleSeccion(s.categoria)}
                  className="flex w-full items-center justify-between bg-brand-tan/20 px-4 py-3 text-left hover:bg-brand-tan/30"
                >
                  <span className="font-heading text-sm font-semibold text-brand-brown">
                    {abierta ? "▾" : "▸"} {s.categoria}
                  </span>
                  <span className="flex items-center gap-3 text-xs text-gray-500">
                    {s.items.length} producto{s.items.length === 1 ? "" : "s"}
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        abrirNuevo(s.categoria);
                      }}
                      className="cursor-pointer font-medium text-brand-brown hover:underline"
                    >
                      + Agregar acá
                    </span>
                  </span>
                </button>
                {abierta && (
                  <div className="overflow-x-auto">
                    {s.items.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-gray-500">No hay nada cargado acá todavía.</p>
                    ) : (
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="bg-brand-brown text-white">
                            <th className="px-3 py-2 text-left font-semibold">Producto</th>
                            <th className="px-3 py-2 text-right font-semibold">Cantidad</th>
                            <th className="px-3 py-2 text-left font-semibold">Unidad</th>
                            <th className="px-3 py-2"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {s.items.map((item) => (
                            <tr key={item.id} className={`border-t border-gray-100 ${Number(item.cantidad) === 0 ? "bg-red-50" : ""}`}>
                              <td className="px-3 py-2 font-medium text-gray-900">
                                {item.nombre}
                                {item.notas && <p className="mt-0.5 text-xs font-normal text-gray-500">{item.notas}</p>}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <CeldaCantidad valor={item.cantidad} onGuardar={(v) => guardarCantidad(item, v)} />
                              </td>
                              <td className="px-3 py-2 text-gray-600">{item.unidad || "—"}</td>
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

          {stock.length === 0 && <p className="mt-6 text-sm text-gray-500">Todavía no cargaste ningún producto.</p>}
        </>
      )}

      {mostrarModal && (
        <ItemStockCatalinaFormModal
          item={itemEditando}
          categoriaPredeterminada={categoriaParaNuevo}
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

function CatalinaContenido() {
  const [pestana, setPestana] = useState("alimentos");

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">👶 Catalina</h1>
      <p className="mt-1 text-sm text-gray-500">
        Sección privada de Catalina — solo lo ven Matías y Marianela.
      </p>

      <div className="mt-4 flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setPestana("alimentos")}
          className={`px-3 py-2 text-sm font-medium ${
            pestana === "alimentos"
              ? "border-b-2 border-brand-brown text-brand-brown"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          🍽️ Alimentos probados
        </button>
        <button
          onClick={() => setPestana("stock")}
          className={`px-3 py-2 text-sm font-medium ${
            pestana === "stock" ? "border-b-2 border-brand-brown text-brand-brown" : "text-gray-500 hover:text-gray-700"
          }`}
        >
          📦 Stock
        </button>
      </div>

      {pestana === "alimentos" ? <SeccionAlimentos /> : <SeccionStock />}
    </main>
  );
}

export default function CatalinaPage() {
  return (
    <SoloDuena>
      <CatalinaContenido />
    </SoloDuena>
  );
}
