"use client";

import { useState } from "react";
import { crearPrestacionCatalogo } from "@/lib/data/catalogo";

export default function NuevaPrestacionModal({ onClose, onGuardado }) {
  const [prestacion, setPrestacion] = useState("");
  const [especialidad, setEspecialidad] = useState("");
  const [categoria, setCategoria] = useState("");
  const [profesionalHabilitado, setProfesionalHabilitado] = useState("Todos los odontólogos");
  const [valorLista, setValorLista] = useState("");
  const [valorEfectivo, setValorEfectivo] = useState("");
  const [tiempoEstimado, setTiempoEstimado] = useState("");
  const [particular, setParticular] = useState(true);
  const [activaObraSocial, setActivaObraSocial] = useState(false);
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!prestacion.trim()) {
      setError("Falta el nombre de la prestación.");
      return;
    }
    setGuardando(true);
    try {
      await crearPrestacionCatalogo({
        prestacion: prestacion.trim(),
        especialidad,
        categoria,
        profesionalHabilitado,
        profesionalSugerido: profesionalHabilitado,
        valorLista: valorLista || valorEfectivo,
        valorEfectivo: valorEfectivo || valorLista,
        tiempoEstimado,
        particular,
        activaObraSocial,
        observaciones,
      });
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
          <h2 className="text-lg font-bold text-gray-900">Nueva prestación</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Prestación
            <input
              value={prestacion}
              onChange={(e) => setPrestacion(e.target.value)}
              placeholder="Ej. Fichado de obra social"
              className="rounded-md border border-gray-300 px-2 py-1.5"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Especialidad
              <input
                value={especialidad}
                onChange={(e) => setEspecialidad(e.target.value)}
                placeholder="Ej. Diagnóstico"
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Categoría
              <input
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                placeholder="Ej. Administrativo"
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Profesional habilitado
            <input
              value={profesionalHabilitado}
              onChange={(e) => setProfesionalHabilitado(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            />
          </label>

          <div className="grid grid-cols-3 gap-3">
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Precio Lista
              <input
                type="number"
                value={valorLista}
                onChange={(e) => setValorLista(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Precio Efectivo
              <input
                type="number"
                value={valorEfectivo}
                onChange={(e) => setValorEfectivo(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Minutos
              <input
                type="number"
                value={tiempoEstimado}
                onChange={(e) => setTiempoEstimado(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={particular} onChange={(e) => setParticular(e.target.checked)} />
            Habilitada para pacientes particulares
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={activaObraSocial}
              onChange={(e) => setActivaObraSocial(e.target.checked)}
            />
            También se cobra a pacientes con obra social
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
              className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
            >
              {guardando ? "Guardando..." : "Crear prestación"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
