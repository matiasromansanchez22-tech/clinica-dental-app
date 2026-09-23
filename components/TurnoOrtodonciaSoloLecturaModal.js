"use client";

import { useEffect, useState } from "react";
import { CONCEPTOS_ORTODONCIA } from "@/lib/ortodoncia";
import { marcarTurnoOrtodonciaRealizado, obtenerPendienteCobroOrtodoncia } from "@/lib/data/prestacionesRealizadas";

export default function TurnoOrtodonciaSoloLecturaModal({ turno, fecha, onClose }) {
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
      const pendienteNuevo = await obtenerPendienteCobroOrtodoncia(turno.pacienteId);
      setPendiente(pendienteNuevo);
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{turno.paciente}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            ✕
          </button>
        </div>
        <p className="mb-4 text-sm text-gray-500">
          {fecha} · {turno.horaInicio} · Consultorio {turno.consultorio}
        </p>

        <div className="flex flex-col gap-1 text-sm text-gray-700">
          <p><span className="text-gray-500">Concepto:</span> {turno.concepto}</p>
          <p><span className="text-gray-500">Ortodoncista:</span> {turno.profesionalDeTurno}</p>
          {turno.whatsapp && <p><span className="text-gray-500">WhatsApp:</span> {turno.whatsapp}</p>}
          <p><span className="text-gray-500">Estado:</span> {turno.estado}</p>
          <p><span className="text-gray-500">Confirmación:</span> {turno.confirmacion}</p>
          <p><span className="text-gray-500">Presencia:</span> {turno.presencia}</p>
          <p><span className="text-gray-500">Asistencia:</span> {turno.asistencia}</p>
          {turno.observaciones && (
            <p><span className="text-gray-500">Observaciones:</span> {turno.observaciones}</p>
          )}
        </div>

        {turno.pacienteId && (
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
        )}

        <p className="mt-4 text-xs text-gray-400">
          Vista de solo lectura — para hacer cambios, usá la Agenda normal.
        </p>
      </div>
    </div>
  );
}
