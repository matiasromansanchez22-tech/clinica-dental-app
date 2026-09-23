"use client";

import { useEffect, useState } from "react";
import {
  actualizarEntradaHistorial,
  crearEntradaHistorial,
  eliminarEntradaHistorial,
  obtenerHistorialClinico,
} from "@/lib/data/historialClinicoOrtodoncia";

// Se usa tanto en la ficha del paciente (Pacientes → Ortodoncia) como en la
// Agenda (normal y "Ver Agenda del Día") — mismo componente en los tres
// lugares para no tener tres copias de la misma lógica.
export default function HistorialClinicoOrtodoncia({ pacienteId, profesionales }) {
  const [entradas, setEntradas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [mostrarNueva, setMostrarNueva] = useState(false);
  const [nueva, setNueva] = useState({ fecha: "", profesionalId: "", nota: "" });
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    setCargando(true);
    try {
      setEntradas(await obtenerHistorialClinico(pacienteId));
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteId]);

  async function guardarNueva() {
    if (!nueva.fecha || !nueva.nota.trim()) {
      setError("Completá la fecha y la nota.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      if (editando) {
        await actualizarEntradaHistorial(editando, nueva);
      } else {
        await crearEntradaHistorial({ pacienteId, ...nueva });
      }
      setNueva({ fecha: "", profesionalId: "", nota: "" });
      setEditando(null);
      setMostrarNueva(false);
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  function editar(entrada) {
    setEditando(entrada.id);
    setNueva({ fecha: entrada.fecha, profesionalId: entrada.profesionalId || "", nota: entrada.nota });
    setMostrarNueva(true);
  }

  function cancelar() {
    setEditando(null);
    setNueva({ fecha: "", profesionalId: "", nota: "" });
    setMostrarNueva(false);
  }

  async function borrar(id) {
    if (!window.confirm("¿Borrar esta entrada del historial?")) return;
    try {
      await eliminarEntradaHistorial(id);
      setEntradas((es) => es.filter((e) => e.id !== id));
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <hr className="mb-4 border-gray-200" />
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase text-gray-400">Historial clínico</p>
        <button
          type="button"
          onClick={() => (mostrarNueva ? cancelar() : setMostrarNueva(true))}
          className="rounded-md border border-brand-brown/40 px-3 py-1 text-xs font-medium text-brand-brown hover:bg-brand-tan/30"
        >
          + Nuevo historial clínico
        </button>
      </div>

      {error && <p className="mb-2 text-xs text-red-700">{error}</p>}

      {mostrarNueva && (
        <div className="mb-3 flex flex-col gap-2 rounded-md border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs font-semibold text-gray-500">{editando ? "Editando entrada" : "Nueva entrada"}</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs text-gray-700">
              Fecha
              <input
                type="date"
                value={nueva.fecha}
                onChange={(e) => setNueva((n) => ({ ...n, fecha: e.target.value }))}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-700">
              Quién lo hizo
              <select
                value={nueva.profesionalId}
                onChange={(e) => setNueva((n) => ({ ...n, profesionalId: e.target.value }))}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="">(sin especificar)</option>
                {profesionales.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1 text-xs text-gray-700">
            Nota
            <textarea
              value={nueva.nota}
              onChange={(e) => setNueva((n) => ({ ...n, nota: e.target.value }))}
              rows={3}
              placeholder="Ej. Niti 0,16 sup + resorte para el 12..."
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={cancelar}
              className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-white"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={guardarNueva}
              disabled={guardando}
              className="rounded-md bg-brand-brown px-3 py-1 text-xs font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
            >
              {guardando ? "Guardando..." : editando ? "Guardar cambios" : "Guardar"}
            </button>
          </div>
        </div>
      )}

      {cargando ? (
        <p className="text-xs text-gray-500">Cargando historial...</p>
      ) : entradas.length === 0 ? (
        <p className="text-xs text-gray-500">Todavía no hay entradas cargadas.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entradas.map((e) => (
            <li key={e.id} className="rounded-md border border-gray-200 px-3 py-2 text-sm">
              <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                <span className="font-medium text-gray-700">
                  {e.fecha}
                  {e.profesional ? ` — ${e.profesional}` : ""}
                </span>
                <span className="flex gap-2">
                  <button type="button" onClick={() => editar(e)} className="text-brand-brown hover:underline">
                    Editar
                  </button>
                  <button type="button" onClick={() => borrar(e.id)} className="text-red-600 hover:underline">
                    Borrar
                  </button>
                </span>
              </div>
              <p className="whitespace-pre-wrap text-gray-700">{e.nota}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
