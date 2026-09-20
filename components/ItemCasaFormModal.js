"use client";

import { useState } from "react";
import { CATEGORIAS_CASA, crearItemCasa, actualizarItemCasa } from "@/lib/data/casa";

export default function ItemCasaFormModal({ item, ubicaciones, ubicacionIdPredeterminada, onClose, onGuardado }) {
  const [nombre, setNombre] = useState(item?.nombre || "");
  const [categoria, setCategoria] = useState(item?.categoria || CATEGORIAS_CASA[0]);
  const [ubicacionId, setUbicacionId] = useState(item?.ubicacion_id || ubicacionIdPredeterminada || "");
  const [cantidad, setCantidad] = useState(item ? String(item.cantidad) : "1");
  const [unidad, setUnidad] = useState(item?.unidad || "");
  const [fechaVencimiento, setFechaVencimiento] = useState(item?.fecha_vencimiento || "");
  const [notas, setNotas] = useState(item?.notas || "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!nombre.trim()) {
      setError("Poné el nombre del producto.");
      return;
    }
    setGuardando(true);
    try {
      const datos = {
        nombre: nombre.trim(),
        categoria,
        ubicacionId: ubicacionId || null,
        cantidad,
        unidad: unidad.trim(),
        fechaVencimiento: fechaVencimiento || null,
        notas: notas.trim(),
      };
      if (item) await actualizarItemCasa(item.id, datos);
      else await crearItemCasa(datos);
      onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold text-brand-brown">
            {item ? "Editar producto" : "Agregar producto"}
          </h2>
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
              placeholder="Ej. Leche, Detergente, Taladro"
              className="rounded-md border border-gray-300 px-2 py-1.5"
            />
          </label>

          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1 text-sm text-gray-700">
              Categoría
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              >
                {CATEGORIAS_CASA.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm text-gray-700">
              Ubicación
              <select
                value={ubicacionId}
                onChange={(e) => setUbicacionId(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              >
                <option value="">Sin ubicación</option>
                {ubicaciones.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1 text-sm text-gray-700">
              Cantidad
              <input
                type="number"
                min={0}
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm text-gray-700">
              Unidad (opcional)
              <input
                value={unidad}
                onChange={(e) => setUnidad(e.target.value)}
                placeholder="Ej. kg, litros, unidades"
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Vencimiento (opcional, para alimentos)
            <input
              type="date"
              value={fechaVencimiento}
              onChange={(e) => setFechaVencimiento(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Notas (opcional)
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="Ej. Marca, dónde se compra, etc."
              className="rounded-md border border-gray-300 px-2 py-1.5"
            />
          </label>

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
              {guardando ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
