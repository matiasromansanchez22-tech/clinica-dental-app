"use client";

export default function TurnoOrtodonciaSoloLecturaModal({ turno, fecha, onClose }) {
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
