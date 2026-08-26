"use client";

import { useState } from "react";
import { crearGasto, actualizarGasto, MEDIOS_PAGO_GASTO } from "@/lib/data/gastos";
import { fechaDeHoyISO } from "@/lib/agenda";

const ESPECIALIDADES = ["", "General", "Ortodoncia"];

export default function GastoFormModal({ gasto, categorias, onClose, onGuardado }) {
  const [fecha, setFecha] = useState(gasto?.fecha || fechaDeHoyISO());
  const [categoria, setCategoria] = useState(gasto?.categoria || categorias[0]?.nombre || "");
  const [especialidad, setEspecialidad] = useState(gasto?.especialidad || "");
  const [descripcion, setDescripcion] = useState(gasto?.descripcion || "");
  const [monto, setMonto] = useState(gasto?.monto || "");
  const [medioPago, setMedioPago] = useState(gasto?.medioPago || "Efectivo");
  const [observaciones, setObservaciones] = useState(gasto?.observaciones || "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!categoria) {
      setError("Elegí una categoría.");
      return;
    }
    if (!monto || Number(monto) <= 0) {
      setError("El monto tiene que ser mayor a cero.");
      return;
    }
    setGuardando(true);
    try {
      const datos = { fecha, categoria, especialidad, descripcion, monto, medioPago, observaciones };
      if (gasto) {
        await actualizarGasto(gasto.id, datos);
      } else {
        await crearGasto(datos);
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
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{gasto ? "Editar gasto" : "Nuevo gasto"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Fecha
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Categoría
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              >
                {categorias.map((c) => (
                  <option key={c.id} value={c.nombre}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Descripción
            <input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej. Alquiler de agosto"
              className="rounded-md border border-gray-300 px-2 py-1.5"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Monto
              <input
                type="number"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Medio de pago
              <select
                value={medioPago}
                onChange={(e) => setMedioPago(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              >
                {MEDIOS_PAGO_GASTO.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Especialidad (opcional)
            <select
              value={especialidad}
              onChange={(e) => setEspecialidad(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            >
              {ESPECIALIDADES.map((e) => (
                <option key={e} value={e}>
                  {e || "General de la clínica (compartido)"}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Observaciones
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={2}
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
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {guardando ? "Guardando..." : "Guardar gasto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
