"use client";

import { useState } from "react";
import { fechaDeHoyISO } from "@/lib/agenda";
import {
  CATEGORIAS_CATALINA,
  ESTADOS_ALIMENTO_CATALINA,
  actualizarAlimentoCatalina,
  crearAlimentoCatalina,
} from "@/lib/data/catalina";

export default function AlimentoCatalinaFormModal({ alimento, categoriaPredeterminada, onClose, onGuardado }) {
  const [nombre, setNombre] = useState(alimento?.nombre || "");
  const [categoria, setCategoria] = useState(alimento?.categoria || categoriaPredeterminada || CATEGORIAS_CATALINA[0]);
  const [fechaPrimeraVez, setFechaPrimeraVez] = useState(alimento?.fecha_primera_vez || fechaDeHoyISO());
  const [estado, setEstado] = useState(alimento?.estado || ESTADOS_ALIMENTO_CATALINA[0]);
  const [notas, setNotas] = useState(alimento?.notas || "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!nombre.trim()) {
      setError("Poné el nombre del alimento.");
      return;
    }
    setGuardando(true);
    try {
      const datos = {
        nombre: nombre.trim(),
        categoria,
        fechaPrimeraVez: fechaPrimeraVez || null,
        estado,
        notas: notas.trim(),
      };
      if (alimento) await actualizarAlimentoCatalina(alimento.id, datos);
      else await crearAlimentoCatalina(datos);
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
            {alimento ? "Editar alimento" : "Agregar alimento"}
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
            Alimento
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Banana, Zapallo, Pollo"
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
                {CATEGORIAS_CATALINA.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm text-gray-700">
              Primera vez
              <input
                type="date"
                value={fechaPrimeraVez}
                onChange={(e) => setFechaPrimeraVez(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            ¿Cómo le fue?
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            >
              {ESTADOS_ALIMENTO_CATALINA.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Notas (opcional)
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              placeholder="Ej. Le dio un poco de sarpullido, probar de nuevo en unas semanas"
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
