"use client";

import { useState } from "react";
import { generarBloquesHorarios, hayConflictoDeHorario, seMuestraEnGrilla } from "@/lib/agenda";
import { actualizarEstadoTurnoOrtodoncia, obtenerTurnosOrtodonciaPorFecha } from "@/lib/data/turnosOrtodoncia";

const bloques = generarBloquesHorarios("08:00", "19:30", 15);
const CONSULTORIOS = [2, 3];

function BotonAccion({ activo, children, ...props }) {
  return (
    <button
      {...props}
      className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
        activo ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}

export default function TurnoOrtodonciaDetalleModal({ turno, fecha, onClose, onCambiado }) {
  const [turnoActual, setTurnoActual] = useState(turno);
  const [guardando, setGuardando] = useState(null);
  const [error, setError] = useState(null);

  const [mostrarMover, setMostrarMover] = useState(false);
  const [nuevaFecha, setNuevaFecha] = useState(fecha);
  const [nuevaHora, setNuevaHora] = useState(turno.horaInicio);
  const [nuevoConsultorio, setNuevoConsultorio] = useState(turno.consultorio);
  const [moviendo, setMoviendo] = useState(false);

  async function aplicarCambio(nombreAccion, cambios) {
    setError(null);
    setGuardando(nombreAccion);
    try {
      const actualizado = await actualizarEstadoTurnoOrtodoncia(turnoActual.id, cambios);
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
    if (!window.confirm("¿Marcar para reprogramar? Va a aparecer en el reporte de seguimiento.")) return;
    aplicarCambio("reprogramar", { estado: "Reprogramado", confirmacion: "Reprogramar" });
  }

  async function confirmarMovimiento() {
    setError(null);
    setMoviendo(true);
    try {
      const turnosDestino = await obtenerTurnosOrtodonciaPorFecha(nuevaFecha);
      const conflicto = hayConflictoDeHorario({
        turnosVisibles: turnosDestino.filter(seMuestraEnGrilla),
        consultorio: Number(nuevoConsultorio),
        profesionalDeTurnoId: turnoActual.profesionalDeTurnoId,
        horaInicio: nuevaHora,
        duracionMin: turnoActual.duracionMin,
        idExcluido: turnoActual.id,
      });
      if (conflicto) {
        setError("Ese horario ya está ocupado en ese consultorio, o el ortodoncista ya tiene otro turno a esa hora.");
        return;
      }
      await actualizarEstadoTurnoOrtodoncia(turnoActual.id, {
        fecha: nuevaFecha,
        hora_inicio: nuevaHora,
        consultorio: Number(nuevoConsultorio),
      });
      onCambiado();
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setMoviendo(false);
    }
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
          {fecha} · {turnoActual.horaInicio} · Consultorio {turnoActual.consultorio} · {turnoActual.concepto} ·{" "}
          {turnoActual.profesionalDeTurno}
        </p>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
        )}

        <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-500">
          <span>Estado: <span className="font-medium text-gray-700">{turnoActual.estado}</span></span>
          <span>Confirmación: <span className="font-medium text-gray-700">{turnoActual.confirmacion}</span></span>
          <span>Presencia: <span className="font-medium text-gray-700">{turnoActual.presencia}</span></span>
          {turnoActual.whatsapp && <span>WhatsApp: <span className="font-medium text-gray-700">{turnoActual.whatsapp}</span></span>}
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

          {!mostrarMover ? (
            <button
              onClick={() => setMostrarMover(true)}
              disabled={guardando !== null}
              className="w-fit text-sm text-blue-600 hover:underline disabled:opacity-50"
            >
              Mover turno
            </button>
          ) : (
            <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase text-blue-800">Mover a</p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={nuevaFecha}
                  onChange={(e) => setNuevaFecha(e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                />
                <select
                  value={nuevaHora}
                  onChange={(e) => setNuevaHora(e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                >
                  {bloques.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                <select
                  value={nuevoConsultorio}
                  onChange={(e) => setNuevoConsultorio(e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                >
                  {CONSULTORIOS.map((c) => (
                    <option key={c} value={c}>
                      Consultorio {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  onClick={confirmarMovimiento}
                  disabled={moviendo}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {moviendo ? "Moviendo..." : "Confirmar movimiento"}
                </button>
                <button
                  onClick={() => setMostrarMover(false)}
                  disabled={moviendo}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

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
      </div>
    </div>
  );
}
