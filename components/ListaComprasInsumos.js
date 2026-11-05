"use client";

import { useState } from "react";

// Lista de insumos para comprar: cualquiera del equipo anota lo que falta y las dueñas reciben un aviso.
// Las dueñas (y quien lo pidió) pueden marcarlo como comprado o quitarlo.
export default function ListaComprasInsumos({ compras, insumos, esDuena, onAgregar, onComprado, onQuitar }) {
  const [nombre, setNombre] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [urgente, setUrgente] = useState(false);
  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!nombre.trim()) return;
    setGuardando(true);
    setError(null);
    try {
      const conocido = insumos.find((i) => i.nombre.toLowerCase() === nombre.trim().toLowerCase());
      await onAgregar({ nombre: conocido?.nombre || nombre.trim(), insumoId: conocido?.id || null, cantidad, urgente, notas });
      setNombre("");
      setCantidad(1);
      setUrgente(false);
      setNotas("");
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  const pendientes = compras.filter((c) => c.estado === "Pendiente");

  return (
    <div className="mt-4 rounded-lg border border-gray-200 p-4">
      <h2 className="font-heading text-sm font-semibold text-brand-brown">
        🛒 Insumos para comprar {pendientes.length > 0 && <span className="text-gray-500">({pendientes.length})</span>}
      </h2>
      <p className="mt-1 text-xs text-gray-500">
        Anotá lo que falta comprar y a las dueñas les llega un aviso. Cuando se compra, se marca como comprado.
      </p>

      <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap items-center gap-2">
        <input
          list="insumos-para-comprar"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Qué hay que comprar (ej. Guantes M)"
          className="min-w-[14rem] flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
        <datalist id="insumos-para-comprar">
          {insumos.map((i) => (
            <option key={i.id} value={i.nombre} />
          ))}
        </datalist>
        <input
          type="number"
          min={1}
          value={cantidad}
          onChange={(e) => setCantidad(e.target.value)}
          title="Cantidad"
          className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-right text-sm"
        />
        <input
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Nota (opcional)"
          className="w-48 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
        <label className="flex items-center gap-1 text-sm text-red-700">
          <input type="checkbox" checked={urgente} onChange={(e) => setUrgente(e.target.checked)} />
          Urgente
        </label>
        <button
          type="submit"
          disabled={guardando || !nombre.trim()}
          className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
        >
          + Anotar
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-700">{error}</p>}

      {pendientes.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">No hay nada anotado para comprar.</p>
      ) : (
        <ul className="mt-3 divide-y divide-gray-100 rounded-md border border-gray-200">
          {pendientes.map((c) => (
            <li key={c.id} className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm ${c.urgente ? "bg-red-50" : ""}`}>
              <div>
                <span className="font-medium text-gray-900">{c.nombre}</span>{" "}
                <span className="text-gray-700">× {Number(c.cantidad)}</span>
                {c.urgente && <span className="ml-2 rounded-full bg-red-200 px-2 py-0.5 text-[10px] font-semibold text-red-900">urgente</span>}
                {c.notas && <p className="text-xs text-gray-500">{c.notas}</p>}
                <p className="text-[11px] text-gray-400">
                  Lo anotó {c.pedido_por_nombre || "—"} el {new Date(c.created_at).toLocaleDateString("es-AR")}
                </p>
              </div>
              <div className="flex gap-2">
                {esDuena && (
                  <button onClick={() => onComprado(c)} className="rounded-md border border-emerald-300 px-2 py-1 text-xs text-emerald-800 hover:bg-emerald-50">
                    ✓ Comprado
                  </button>
                )}
                <button onClick={() => onQuitar(c)} className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50">
                  Quitar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
