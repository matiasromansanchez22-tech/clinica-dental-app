"use client";

import { useEffect, useState } from "react";
import { actualizarPlanTratamiento, obtenerPlanTratamiento } from "@/lib/data/pacientes";

// Plantilla exclusiva para el paso a paso del plan de tratamiento de un
// paciente — un solo texto que se edita y reemplaza (no un historial de
// entradas fechadas, para eso está el Historial clínico de al lado). Se
// usa tanto en la Agenda como en la ficha del paciente.
export default function PlanTratamiento({ pacienteId }) {
  const [texto, setTexto] = useState("");
  const [cargando, setCargando] = useState(true);
  const [mostrar, setMostrar] = useState(false);
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!pacienteId) return;
    setCargando(true);
    obtenerPlanTratamiento(pacienteId)
      .then((t) => setTexto(t || ""))
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [pacienteId]);

  function empezarEdicion() {
    setBorrador(texto);
    setEditando(true);
    setMostrar(true);
    setError(null);
  }

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      await actualizarPlanTratamiento(pacienteId, borrador);
      setTexto(borrador.trim());
      setEditando(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  if (!pacienteId || cargando) return null;

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setMostrar((v) => !v)}
        className="text-[11px] font-medium text-brand-brown hover:underline"
      >
        {mostrar ? "▾" : "▸"} Plan de tratamiento {texto ? "" : "(sin cargar)"}
      </button>

      {mostrar && (
        <div className="mt-1.5 rounded-md border border-gray-200 bg-white p-2">
          {error && <p className="mb-1.5 text-xs text-red-700">{error}</p>}

          {editando ? (
            <>
              <textarea
                value={borrador}
                onChange={(e) => setBorrador(e.target.value)}
                rows={6}
                placeholder="Ej: 1) Extracción 36. 2) Implante a los 3 meses. 3) Corona definitiva."
                className="max-h-40 w-full overflow-y-auto rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
              <div className="mt-1.5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditando(false)}
                  disabled={guardando}
                  className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={guardar}
                  disabled={guardando}
                  className="rounded-md bg-brand-brown px-3 py-1 text-xs font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
                >
                  {guardando ? "Guardando..." : "Guardar"}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="max-h-40 overflow-y-auto whitespace-pre-wrap text-sm text-gray-700">
                {texto || <span className="text-gray-400">Todavía no se cargó el plan de tratamiento.</span>}
              </p>
              <div className="mt-1.5 flex justify-end">
                <button type="button" onClick={empezarEdicion} className="text-xs text-brand-brown hover:underline">
                  {texto ? "Editar" : "+ Cargar plan de tratamiento"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
