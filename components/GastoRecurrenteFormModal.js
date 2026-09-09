"use client";

import { useState } from "react";
import { actualizarGastoRecurrente, crearGastoRecurrente, eliminarGastoRecurrente } from "@/lib/data/gastosRecurrentes";

const TIPOS = ["Fijo", "Variable"];

export default function GastoRecurrenteFormModal({ gastoRecurrente, categorias, onClose, onGuardado }) {
  const esEdicion = !!gastoRecurrente;
  const [nombre, setNombre] = useState(gastoRecurrente?.nombre || "");
  const [categoria, setCategoria] = useState(gastoRecurrente?.categoria || categorias[0]?.nombre || "");
  const [tipo, setTipo] = useState(gastoRecurrente?.tipo || "Fijo");
  const [montoSugerido, setMontoSugerido] = useState(gastoRecurrente?.montoSugerido ?? "");
  const [guardando, setGuardando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!nombre.trim()) {
      setError("Falta el nombre.");
      return;
    }
    setGuardando(true);
    try {
      const datos = { nombre: nombre.trim(), categoria, tipo, montoSugerido, activo: true };
      if (esEdicion) {
        await actualizarGastoRecurrente(gastoRecurrente.id, datos);
      } else {
        await crearGastoRecurrente(datos);
      }
      onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function handleBorrar() {
    if (!window.confirm(`¿Enviar "${gastoRecurrente.nombre}" a la papelera? No borra los pagos ya registrados, solo deja de aparecer en la lista.`))
      return;
    setBorrando(true);
    setError(null);
    try {
      await eliminarGastoRecurrente(gastoRecurrente.id);
      onGuardado();
    } catch (err) {
      setError(err.message);
      setBorrando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold text-brand-brown">{esEdicion ? "Editar gasto" : "Nuevo gasto recurrente"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Nombre
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Alquiler"
              className="rounded-md border border-gray-300 px-2 py-1.5"
              autoFocus
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Categoría
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5">
              {categorias.map((c) => (
                <option key={c.id} value={c.nombre}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Tipo
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5">
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Monto sugerido (opcional)
            <input
              type="number"
              value={montoSugerido}
              onChange={(e) => setMontoSugerido(e.target.value)}
              placeholder="Dejar vacío si varía cada vez"
              className="rounded-md border border-gray-300 px-2 py-1.5"
            />
          </label>

          <div className="mt-2 flex items-center justify-between gap-2">
            {esEdicion ? (
              <button
                type="button"
                onClick={handleBorrar}
                disabled={borrando}
                className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
              >
                {borrando ? "Borrando..." : "🗑️ Borrar"}
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
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
                {guardando ? "Guardando..." : esEdicion ? "Guardar cambios" : "Crear"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
