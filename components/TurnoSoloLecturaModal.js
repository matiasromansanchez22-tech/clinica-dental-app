"use client";

export default function TurnoSoloLecturaModal({ turno, fecha, onClose }) {
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
          <p><span className="text-gray-500">Tipo de atención:</span> {turno.tipoAtencion}</p>
          <p><span className="text-gray-500">Profesional:</span> {turno.profesionalDeTurno}</p>
          <p><span className="text-gray-500">Cobertura:</span> {turno.cobertura}</p>
          <p><span className="text-gray-500">Estado:</span> {turno.estado}</p>
          <p><span className="text-gray-500">Confirmación:</span> {turno.confirmacion}</p>
          <p><span className="text-gray-500">Presencia:</span> {turno.presencia}</p>
          <p><span className="text-gray-500">Asistencia:</span> {turno.asistencia}</p>
          {turno.observaciones && (
            <p><span className="text-gray-500">Observaciones:</span> {turno.observaciones}</p>
          )}
        </div>

        <p className="mt-4 text-xs text-gray-400">
          Vista de solo lectura — para hacer cambios, usá la Agenda normal.
        </p>
      </div>
    </div>
  );
}
