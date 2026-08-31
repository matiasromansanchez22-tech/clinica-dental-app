"use client";

import { useEffect, useMemo, useState } from "react";
import PrecioMecanicoModal from "@/components/PrecioMecanicoModal";
import SoloDuena from "@/components/SoloDuena";
import { obtenerPreciosMecanicos } from "@/lib/data/mecanicosPrecios";

function formatoPesos(n) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

function TablaCategoria({ categoria, filas, onEditar, onNuevo }) {
  const [abierto, setAbierto] = useState(false);

  const laboratorios = useMemo(() => {
    const set = new Set(filas.map((f) => f.laboratorio));
    return Array.from(set).sort();
  }, [filas]);

  const porTrabajo = useMemo(() => {
    const mapa = {};
    for (const f of filas) {
      if (!mapa[f.trabajo]) mapa[f.trabajo] = {};
      mapa[f.trabajo][f.laboratorio] = f;
    }
    return mapa;
  }, [filas]);

  const trabajos = Object.keys(porTrabajo).sort();

  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
      <button
        onClick={() => setAbierto((a) => !a)}
        className="flex w-full items-center justify-between bg-gray-50 px-4 py-2.5 text-left hover:bg-gray-100"
      >
        <span className="font-semibold text-gray-800">{categoria}</span>
        <span className="flex items-center gap-2 text-xs text-gray-500">
          {trabajos.length} trabajo{trabajos.length === 1 ? "" : "s"} · {laboratorios.length} laboratorio
          {laboratorios.length === 1 ? "" : "s"}
          <span>{abierto ? "▲" : "▼"}</span>
        </span>
      </button>
      {abierto && (
        <div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-brand-brown text-white">
                  <th className="px-3 py-2 text-left font-semibold">Trabajo</th>
                  {laboratorios.map((l) => (
                    <th key={l} className="px-3 py-2 text-right font-semibold">
                      {l}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trabajos.map((trabajo) => {
                  const fila = porTrabajo[trabajo];
                  const precios = laboratorios
                    .map((l) => fila[l]?.precio)
                    .filter((p) => p !== null && p !== undefined);
                  const min = precios.length ? Math.min(...precios) : null;
                  const max = precios.length ? Math.max(...precios) : null;
                  return (
                    <tr key={trabajo} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-medium text-gray-900">{trabajo}</td>
                      {laboratorios.map((l) => {
                        const entrada = fila[l];
                        if (!entrada) {
                          return (
                            <td key={l} className="px-3 py-2 text-right text-gray-300">
                              —
                            </td>
                          );
                        }
                        const esMin = entrada.precio !== null && entrada.precio === min && min !== max;
                        const esMax = entrada.precio !== null && entrada.precio === max && min !== max;
                        return (
                          <td
                            key={l}
                            onClick={() => onEditar(entrada)}
                            className={`cursor-pointer px-3 py-2 text-right hover:underline ${
                              esMin ? "font-bold text-emerald-600" : esMax ? "text-red-600" : "text-gray-700"
                            }`}
                            title={entrada.observaciones || ""}
                          >
                            {entrada.precio !== null ? formatoPesos(entrada.precio) : entrada.observaciones || "Consultar"}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-gray-100 px-3 py-2">
            <button onClick={() => onNuevo(categoria)} className="text-xs font-medium text-brand-brown hover:underline">
              + Agregar precio en "{categoria}"
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PaginaComparativa() {
  const [precios, setPrecios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null); // { precio: null|obj, categoriaSugerida }

  async function recargar() {
    setPrecios(await obtenerPreciosMecanicos());
  }

  useEffect(() => {
    setCargando(true);
    obtenerPreciosMecanicos()
      .then(setPrecios)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  const categorias = useMemo(() => {
    const orden = [];
    const vistas = new Set();
    for (const p of precios) {
      if (!vistas.has(p.categoria)) {
        vistas.add(p.categoria);
        orden.push(p.categoria);
      }
    }
    return orden.sort();
  }, [precios]);

  const laboratoriosConocidos = useMemo(() => Array.from(new Set(precios.map((p) => p.laboratorio))).sort(), [precios]);
  const categoriasConocidas = categorias;

  const porCategoria = useMemo(() => {
    const mapa = {};
    for (const c of categorias) mapa[c] = [];
    for (const p of precios) mapa[p.categoria].push(p);
    return mapa;
  }, [precios, categorias]);

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Comparativa de mecánicos</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Solo visible para Dueña. Precios de laboratorio por trabajo — actualizalo cuando manden una lista nueva.
          </p>
        </div>
        <button
          onClick={() => setModal({ precio: null, categoriaSugerida: "" })}
          className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark"
        >
          + Nuevo precio
        </button>
      </div>

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      {cargando && <p className="mt-4 text-sm text-gray-500">Cargando...</p>}

      {!cargando && categorias.length === 0 && (
        <p className="mt-4 text-sm text-gray-500">Todavía no cargaste ningún precio. Empezá con "+ Nuevo precio".</p>
      )}

      {!cargando &&
        categorias.map((categoria) => (
          <TablaCategoria
            key={categoria}
            categoria={categoria}
            filas={porCategoria[categoria]}
            onEditar={(entrada) => setModal({ precio: entrada, categoriaSugerida: categoria })}
            onNuevo={(categoriaSugerida) => setModal({ precio: null, categoriaSugerida })}
          />
        ))}

      {modal && (
        <PrecioMecanicoModal
          precio={modal.precio}
          categoriaSugerida={modal.categoriaSugerida}
          categorias={categoriasConocidas}
          laboratorios={laboratoriosConocidos}
          onClose={() => setModal(null)}
          onGuardado={async () => {
            await recargar();
            setModal(null);
          }}
        />
      )}
    </main>
  );
}

export default function ComparativaMecanicosPage() {
  return (
    <SoloDuena>
      <PaginaComparativa />
    </SoloDuena>
  );
}
