"use client";

import { useEffect, useState } from "react";
import { CONCEPTOS_ORTODONCIA } from "@/lib/ortodoncia";
import { marcarTurnoOrtodonciaRealizado, obtenerPendienteCobroOrtodoncia } from "@/lib/data/prestacionesRealizadas";
import { actualizarEstadoTurnoOrtodoncia } from "@/lib/data/turnosOrtodoncia";

// Se usa tanto en la Agenda normal (secretaria) como en "Ver Agenda del
// Día" (solo lectura) de Ortodoncia.
//
// `onTurnoActualizado` es opcional: si el que lo usa quiere mantener su
// propio estado del turno sincronizado (ej. para repintar la grilla), se le
// avisa acá cuando el turno pasa a "Finalizado".
export default function QueSeHizoHoyOrtodoncia({ turno, fecha, onTurnoActualizado }) {
  const [concepto, setConcepto] = useState(
    CONCEPTOS_ORTODONCIA.includes(turno.concepto) ? turno.concepto : CONCEPTOS_ORTODONCIA[0]
  );
  const [pendiente, setPendiente] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!turno.pacienteId) {
      setCargando(false);
      return;
    }
    obtenerPendienteCobroOrtodoncia(turno.pacienteId)
      .then(setPendiente)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turno.pacienteId]);

  async function marcarRealizado() {
    setError(null);
    setGuardando(true);
    try {
      await marcarTurnoOrtodonciaRealizado({
        turnoOrtodonciaId: turno.id,
        pacienteOrtodonciaId: turno.pacienteId,
        ortodoncistaId: turno.profesionalDeTurnoId,
        concepto,
        fecha,
      });
      if (turno.presencia !== "Finalizado") {
        const actualizado = await actualizarEstadoTurnoOrtodoncia(turno.id, { presencia: "Finalizado" });
        onTurnoActualizado?.(actualizado);
      }
      const pendienteNuevo = await obtenerPendienteCobroOrtodoncia(turno.pacienteId);
      setPendiente(pendienteNuevo);
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  if (!turno.pacienteId) return null;

  return (
    <div className="mt-4 border-t border-gray-200 pt-3">
      <p className="mb-2 text-xs font-semibold uppercase text-brand-brown">¿Qué le hiciste hoy?</p>
      {error && (
        <div className="mb-2 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800">{error}</div>
      )}
      {cargando ? (
        <p className="text-xs text-gray-500">Buscando...</p>
      ) : pendiente ? (
        <p className="text-sm text-emerald-700">
          ✓ Marcado como <strong>{pendiente.prestacion}</strong> — pendiente de que lo cobren.
        </p>
      ) : (
        <div className="flex items-center gap-2">
          <select
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            {CONCEPTOS_ORTODONCIA.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={marcarRealizado}
            disabled={guardando}
            className="rounded-md bg-brand-brown px-2 py-1.5 text-xs font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
          >
            ✓ Marcar hecho
          </button>
        </div>
      )}
      <p className="mt-2 text-xs text-gray-400">Lo que marques acá le va a quedar pre-cargado al secretario cuando cobre.</p>
    </div>
  );
}
