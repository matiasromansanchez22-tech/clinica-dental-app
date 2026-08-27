"use client";

import { useEffect, useState } from "react";
import GestionarRodantesModal from "@/components/GestionarRodantesModal";
import SoloDuena from "@/components/SoloDuena";
import {
  actualizarCantidadStock,
  crearInsumoStock,
  eliminarInsumoStock,
  obtenerCantidadesStock,
  obtenerInsumosStock,
  obtenerRodantes,
  SECTORES_STOCK,
} from "@/lib/data/stock";

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

function StockContenido() {
  const [rodantes, setRodantes] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [cantidades, setCantidades] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [mostrarRodantes, setMostrarRodantes] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoSector, setNuevoSector] = useState(SECTORES_STOCK[0]);
  const [guardandoInsumo, setGuardandoInsumo] = useState(false);

  async function recargar() {
    setCargando(true);
    try {
      const [r, i, c] = await Promise.all([obtenerRodantes(), obtenerInsumosStock(), obtenerCantidadesStock()]);
      setRodantes(r);
      setInsumos(i);
      setCantidades(c);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    recargar();
  }, []);

  function cantidadDe(insumoId, rodanteId) {
    return cantidades.find((c) => c.insumo_id === insumoId && c.rodante_id === rodanteId)?.cantidad || 0;
  }

  function totalDe(insumoId) {
    return cantidades.filter((c) => c.insumo_id === insumoId).reduce((acc, c) => acc + Number(c.cantidad), 0);
  }

  async function guardarCantidad(insumoId, rodanteId, valor) {
    setError(null);
    try {
      await actualizarCantidadStock(insumoId, rodanteId, valor);
      setCantidades((c) => {
        const idx = c.findIndex((x) => x.insumo_id === insumoId && x.rodante_id === rodanteId);
        const nuevaCantidad = Number(valor) || 0;
        if (idx >= 0) {
          const copia = [...c];
          copia[idx] = { ...copia[idx], cantidad: nuevaCantidad };
          return copia;
        }
        return [...c, { insumo_id: insumoId, rodante_id: rodanteId, cantidad: nuevaCantidad }];
      });
    } catch (e) {
      setError(e.message);
    }
  }

  async function agregarInsumo(e) {
    e.preventDefault();
    if (!nuevoNombre.trim()) return;
    setGuardandoInsumo(true);
    setError(null);
    try {
      const nuevo = await crearInsumoStock(nuevoNombre.trim(), nuevoSector);
      setInsumos((i) => [...i, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setNuevoNombre("");
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardandoInsumo(false);
    }
  }

  async function borrarInsumo(insumo) {
    if (!window.confirm(`¿Borrar "${insumo.nombre}" de la lista de stock? Se pierden las cantidades cargadas.`)) return;
    try {
      await eliminarInsumoStock(insumo.id);
      setInsumos((i) => i.filter((x) => x.id !== insumo.id));
      setCantidades((c) => c.filter((x) => x.insumo_id !== insumo.id));
    } catch (e) {
      setError(e.message);
    }
  }

  const grupos = SECTORES_STOCK.map((sector) => ({
    sector,
    items: insumos.filter((i) => i.sector === sector),
  })).filter((g) => g.items.length > 0);

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Stock de Insumos</h1>
        <button
          onClick={() => setMostrarRodantes(true)}
          className="rounded-md border border-brand-brown/40 px-4 py-2 text-sm font-medium text-brand-brown hover:bg-brand-tan/30"
        >
          Gestionar ubicaciones
        </button>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Cuánto de cada insumo hay en el depósito/mueble central y en cada rodante. Las filas en rojo no tienen nada
        en ningún lado.
      </p>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      {cargando ? (
        <p className="mt-6 text-sm text-gray-500">Cargando...</p>
      ) : (
        <>
          {grupos.map((g) => (
            <div key={g.sector} className="mt-6">
              <h2 className="mb-2 font-heading text-sm font-semibold text-brand-brown">{g.sector}</h2>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-brand-brown text-white">
                      <th className="px-3 py-2 text-left font-semibold">Insumo</th>
                      {rodantes.map((r) => (
                        <th key={r.id} className="px-3 py-2 text-right font-semibold">
                          {r.nombre}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-right font-semibold">Total</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.items.map((insumo) => {
                      const total = totalDe(insumo.id);
                      return (
                        <tr key={insumo.id} className={`border-t border-gray-100 ${total === 0 ? "bg-red-50" : ""}`}>
                          <td className="px-3 py-2 font-medium text-gray-900">{insumo.nombre}</td>
                          {rodantes.map((r) => (
                            <td key={r.id} className="px-3 py-2 text-right">
                              <CeldaCantidad
                                valor={cantidadDe(insumo.id, r.id)}
                                onGuardar={(v) => guardarCantidad(insumo.id, r.id, v)}
                              />
                            </td>
                          ))}
                          <td className={`px-3 py-2 text-right font-semibold ${total === 0 ? "text-red-700" : "text-gray-900"}`}>
                            {total}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              onClick={() => borrarInsumo(insumo)}
                              className="text-xs text-red-600 hover:underline"
                            >
                              Borrar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {insumos.length === 0 && (
            <p className="mt-6 text-sm text-gray-500">Todavía no cargaste ningún insumo para controlar.</p>
          )}

          <div className="mt-6 rounded-lg border border-gray-200 p-4">
            <h3 className="mb-2 font-heading text-sm font-semibold text-brand-charcoal">Agregar insumo a controlar</h3>
            <form onSubmit={agregarInsumo} className="flex flex-wrap items-center gap-2">
              <input
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                placeholder="Nombre del insumo (ej. Guantes M)"
                className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
              <select
                value={nuevoSector}
                onChange={(e) => setNuevoSector(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              >
                {SECTORES_STOCK.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={guardandoInsumo}
                className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
              >
                + Agregar
              </button>
            </form>
          </div>
        </>
      )}

      {mostrarRodantes && (
        <GestionarRodantesModal
          rodantes={rodantes}
          onClose={() => setMostrarRodantes(false)}
          onCambiado={async () => {
            const r = await obtenerRodantes();
            setRodantes(r);
          }}
        />
      )}
    </main>
  );
}

export default function StockPage() {
  return (
    <SoloDuena>
      <StockContenido />
    </SoloDuena>
  );
}
