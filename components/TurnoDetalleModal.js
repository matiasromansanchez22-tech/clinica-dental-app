"use client";

import { useEffect, useState } from "react";
import { obtenerHistorialTurnosGeneral } from "@/lib/data/pacientes";
import { actualizarEstadoTurnoGeneral } from "@/lib/data/turnosGeneral";

function BotonAccion({ activo, children, ...props }) {
  return (
    <button
      {...props}
      className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
        activo
          ? "border-gray-900 bg-gray-900 text-white"
          : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}

export default function TurnoDetalleModal({ turno, fecha, onClose, onCambiado }) {
  const [turnoActual, setTurnoActual] = useState(turno);
  const [guardando, setGuardando] = useState(null); // qué acción se está guardando
  const [error, setError] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);

  useEffect(() => {
    if (!turnoActual.pacienteId) {
      setCargandoHistorial(false);
      return;
    }
    obtenerHistorialTurnosGeneral(turnoActual.pacienteId)
      .then(setHistorial)
      .catch((e) => setError(e.message))
      .finally(() => setCargandoHistorial(false));
  }, [turnoActual.pacienteId]);

  async function aplicarCambio(nombreAccion, cambios) {
    setError(null);
    setGuardando(nombreAccion);
    try {
      const actualizado = await actualizarEstadoTurnoGeneral(turnoActual.id, cambios);
      setTurnoActual(actualizado);
      onCambiado();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(null);
    }
  }

  function cancelarTurno() {
    if (!window.confirm("¿Cancelar este turno? Se va a liberar el horario en la grilla.")) return;
    aplicarCambio("cancelar", { estado: "Cancelado" });
  }

  function reprogramarTurno() {
    if (
      !window.confirm(
        "¿Marcar para reprogramar? Se va a liberar el horario en la grilla y va a aparecer en el reporte de seguimiento para llamar al paciente."
      )
    )
      return;
    aplicarCambio("reprogramar", { estado: "Reprogramado", confirmacion: "Reprogramar" });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{turnoActual.paciente}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            ✕
          </button>
        </div>
        <p className="mb-4 text-sm text-gray-500">
          {fecha} · {turnoActual.horaInicio} · Consultorio {turnoActual.consultorio} · {turnoActual.tipoAtencion} ·{" "}
          {turnoActual.profesionalDeTurno}
        </p>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
          <span>Estado: <span className="font-medium text-gray-700">{turnoActual.estado}</span></span>
          <span>Confirmación: <span className="font-medium text-gray-700">{turnoActual.confirmacion}</span></span>
          <span>Presencia: <span className="font-medium text-gray-700">{turnoActual.presencia}</span></span>
          <span>Asistencia: <span className="font-medium text-gray-700">{turnoActual.asistencia}</span></span>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-gray-400">Confirmación</p>
            <BotonAccion
              activo={turnoActual.confirmacion === "Confirmado"}
              disabled={guardando !== null}
              onClick={() => aplicarCambio("confirmar", { confirmacion: "Confirmado" })}
            >
              {guardando === "confirmar" ? "Guardando..." : "✓ Confirmar turno"}
            </BotonAccion>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-gray-400">Presencia del paciente hoy</p>
            <div className="flex flex-wrap gap-2">
              <BotonAccion
                activo={turnoActual.presencia === "En espera"}
                disabled={guardando !== null}
                onClick={() => aplicarCambio("espera", { presencia: "En espera" })}
              >
                {guardando === "espera" ? "Guardando..." : "🕐 En sala de espera"}
              </BotonAccion>
              <BotonAccion
                activo={turnoActual.presencia === "En consultorio"}
                disabled={guardando !== null}
                onClick={() => aplicarCambio("consultorio", { presencia: "En consultorio" })}
              >
                {guardando === "consultorio" ? "Guardando..." : "🦷 En consultorio"}
              </BotonAccion>
              <BotonAccion
                activo={turnoActual.presencia === "Finalizado"}
                disabled={guardando !== null}
                onClick={() => aplicarCambio("finalizado", { presencia: "Finalizado" })}
              >
                {guardando === "finalizado" ? "Guardando..." : "✅ Finalizó el turno"}
              </BotonAccion>
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs font-semibold uppercase text-gray-400">Asistencia (para el cierre del día)</p>
            <div className="flex flex-wrap gap-2">
              <BotonAccion
                activo={turnoActual.asistencia === "Asistió"}
                disabled={guardando !== null}
                onClick={() => aplicarCambio("asistio", { asistencia: "Asistió" })}
              >
                Asistió
              </BotonAccion>
              <BotonAccion
                activo={turnoActual.asistencia === "No asistió"}
                disabled={guardando !== null}
                onClick={() => aplicarCambio("noasistio", { asistencia: "No asistió" })}
              >
                No asistió
              </BotonAccion>
            </div>
          </div>

          <div className="mt-1 flex gap-4">
            <button
              onClick={reprogramarTurno}
              disabled={guardando !== null}
              className="w-fit text-sm text-orange-600 hover:underline disabled:opacity-50"
            >
              Reprogramar
            </button>
            <button
              onClick={cancelarTurno}
              disabled={guardando !== null}
              className="w-fit text-sm text-red-600 hover:underline disabled:opacity-50"
            >
              Cancelar turno
            </button>
          </div>
        </div>

        <hr className="my-4 border-gray-200" />

        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Historial del paciente</h3>
          {!turnoActual.pacienteId && (
            <p className="text-sm text-gray-500">Este turno no tiene un paciente vinculado.</p>
          )}
          {turnoActual.pacienteId && cargandoHistorial && (
            <p className="text-sm text-gray-500">Cargando historial...</p>
          )}
          {turnoActual.pacienteId && !cargandoHistorial && historial.length === 0 && (
            <p className="text-sm text-gray-500">Todavía no tiene otros turnos registrados.</p>
          )}
          {turnoActual.pacienteId && historial.length > 0 && (
            <ul className="flex max-h-48 flex-col gap-2 overflow-y-auto text-sm">
              {historial.map((h) => (
                <li key={h.id} className="rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-800">{h.fecha}</span>
                    <span className="text-gray-500">{h.horaInicio}</span>
                  </div>
                  <div className="text-gray-600">
                    {h.tipoAtencion} · {h.profesionalDeTurno} · {h.cobertura}
                  </div>
                  <div className="text-xs text-gray-400">
                    Estado: {h.estado} · Asistencia: {h.asistencia}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
