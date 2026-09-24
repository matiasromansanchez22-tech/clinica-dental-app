"use client";

import { useState } from "react";
import QueSeHizoHoyGeneral from "@/components/QueSeHizoHoyGeneral";
import HistorialClinicoGeneral from "@/components/HistorialClinicoGeneral";
import Odontograma from "@/components/Odontograma";

export default function TurnoSoloLecturaModal({ turno, fecha, profesionales, catalogo, onClose, onCambiado }) {
  const [turnoActual, setTurnoActual] = useState(turno);
  const [versionHistorial, setVersionHistorial] = useState(0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{turnoActual.paciente}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            ✕
          </button>
        </div>
        <p className="mb-1 text-sm text-gray-500">
          {fecha} · {turnoActual.horaInicio} · Consultorio {turnoActual.consultorio}
        </p>
        {turnoActual.pacienteId && (
          <a
            href={`/panoramicas?tipoPaciente=General&pacienteId=${turnoActual.pacienteId}&pacienteNombre=${encodeURIComponent(turnoActual.paciente)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-3 inline-block text-xs text-brand-brown hover:underline"
          >
            📁 Ver carpeta (fotos y panorámica)
          </a>
        )}

        <div className="flex flex-col gap-1 text-sm text-gray-700">
          <p><span className="text-gray-500">Tipo de atención:</span> {turnoActual.tipoAtencion}</p>
          <p><span className="text-gray-500">Profesional:</span> {turnoActual.profesionalDeTurno}</p>
          <p><span className="text-gray-500">Cobertura:</span> {turnoActual.cobertura}</p>
          <p><span className="text-gray-500">Estado:</span> {turnoActual.estado}</p>
          <p><span className="text-gray-500">Confirmación:</span> {turnoActual.confirmacion}</p>
          <p><span className="text-gray-500">Presencia:</span> {turnoActual.presencia}</p>
          <p><span className="text-gray-500">Asistencia:</span> {turnoActual.asistencia}</p>
          {turnoActual.observaciones && (
            <p><span className="text-gray-500">Observaciones:</span> {turnoActual.observaciones}</p>
          )}
        </div>

        <QueSeHizoHoyGeneral
          turno={turnoActual}
          fecha={fecha}
          profesionales={profesionales}
          catalogo={catalogo}
          onTurnoActualizado={(actualizado) => {
            setTurnoActual(actualizado);
            onCambiado?.();
          }}
        />

        {turnoActual.pacienteId && (
          <div className="mt-4">
            <Odontograma
              pacienteId={turnoActual.pacienteId}
              profesionales={profesionales}
              onCambio={() => setVersionHistorial((v) => v + 1)}
            />
            <HistorialClinicoGeneral
              key={versionHistorial}
              pacienteId={turnoActual.pacienteId}
              profesionales={profesionales}
            />
          </div>
        )}

        <p className="mt-4 text-xs text-gray-400">
          Vista de solo lectura — para hacer cambios al turno en sí, usá la Agenda normal.
        </p>
      </div>
    </div>
  );
}
