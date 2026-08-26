"use client";

import { useEffect, useState } from "react";
import { CONSULTORIOS, generarBloquesHorarios, hayConflictoDeHorario, seMuestraEnGrilla } from "@/lib/agenda";
import { obtenerCatalogo } from "@/lib/data/catalogo";
import { obtenerPrestacionesObraSocial } from "@/lib/data/caja";
import { obtenerHistorialTurnosGeneral } from "@/lib/data/pacientes";
import { actualizarEstadoTurnoGeneral, obtenerTurnosGeneralPorFecha } from "@/lib/data/turnosGeneral";

const bloques = generarBloquesHorarios("08:00", "20:00", 30);
const MAX_PRESTACIONES_TURNO = 4;

function BotonAccion({ activo, children, ...props }) {
  return (
    <button
      {...props}
      className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
        activo
          ? "border-gray-900 bg-brand-brown text-white"
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
  const [mostrarMover, setMostrarMover] = useState(false);
  const [nuevaFecha, setNuevaFecha] = useState(fecha);
  const [nuevaHora, setNuevaHora] = useState(turno.horaInicio);
  const [nuevoConsultorio, setNuevoConsultorio] = useState(turno.consultorio);
  const [moviendo, setMoviendo] = useState(false);

  const [catalogoCompleto, setCatalogoCompleto] = useState([]);
  const [prestacionesDisponibles, setPrestacionesDisponibles] = useState([]);
  const [prestacionesTurno, setPrestacionesTurno] = useState(turno.prestaciones || []);
  const [nuevaPrestacionId, setNuevaPrestacionId] = useState("");
  const [guardandoPrestaciones, setGuardandoPrestaciones] = useState(false);

  useEffect(() => {
    obtenerCatalogo().then(setCatalogoCompleto);
  }, []);

  useEffect(() => {
    if (turnoActual.cobertura === "Particular") {
      setPrestacionesDisponibles(
        catalogoCompleto
          .filter((c) => c.estado === "Activo" && c.particular)
          .map((c) => ({ itemId: c.id, prestacion: c.prestacion, tiempoEstimadoMin: c.tiempo_estimado_min || 0 }))
      );
      return;
    }
    const catalogoPorId = new Map(catalogoCompleto.map((c) => [c.id, c]));
    obtenerPrestacionesObraSocial(turnoActual.cobertura).then((filas) => {
      setPrestacionesDisponibles(
        filas.map((f) => ({
          itemId: f.id,
          prestacion: f.prestacion_os,
          tiempoEstimadoMin: catalogoPorId.get(f.id_catalogo)?.tiempo_estimado_min || 0,
        }))
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnoActual.cobertura, catalogoCompleto]);

  function agregarPrestacion() {
    const item = prestacionesDisponibles.find((p) => p.itemId === nuevaPrestacionId);
    if (!item) return;
    setPrestacionesTurno((filas) => [...filas, { prestacion: item.prestacion, tiempoEstimadoMin: item.tiempoEstimadoMin }]);
    setNuevaPrestacionId("");
  }

  function quitarPrestacion(indice) {
    setPrestacionesTurno((filas) => filas.filter((_, i) => i !== indice));
  }

  async function guardarPrestaciones() {
    setError(null);
    setGuardandoPrestaciones(true);
    try {
      // Si eligió una prestación en el desplegable pero no llegó a tocar
      // "+ Agregar", la sumamos igual antes de guardar — no tiene por qué
      // acordarse de ese paso intermedio.
      let listaFinal = prestacionesTurno;
      const pendiente = prestacionesDisponibles.find((p) => p.itemId === nuevaPrestacionId);
      if (pendiente && listaFinal.length < MAX_PRESTACIONES_TURNO) {
        listaFinal = [...listaFinal, { prestacion: pendiente.prestacion, tiempoEstimadoMin: pendiente.tiempoEstimadoMin }];
      }

      const suma = listaFinal.reduce((acc, p) => acc + (Number(p.tiempoEstimadoMin) || 0), 0);
      const duracionNueva = suma > 0 ? suma : turnoActual.duracionMin;

      if (duracionNueva !== turnoActual.duracionMin) {
        const turnosDelDia = await obtenerTurnosGeneralPorFecha(turnoActual.fecha);
        const conflicto = hayConflictoDeHorario({
          turnosVisibles: turnosDelDia.filter(seMuestraEnGrilla),
          consultorio: turnoActual.consultorio,
          profesionalDeTurnoId: turnoActual.profesionalDeTurnoId,
          horaInicio: turnoActual.horaInicio,
          duracionMin: duracionNueva,
          idExcluido: turnoActual.id,
        });
        if (conflicto) {
          setError(
            "Al ampliar la duración según estas prestaciones, se pisaría con otro turno. Cambiá la duración manualmente o mové alguno de los turnos."
          );
          return;
        }
      }

      const actualizado = await actualizarEstadoTurnoGeneral(turnoActual.id, {
        prestaciones: listaFinal,
        duracion_min: duracionNueva,
      });
      setTurnoActual(actualizado);
      setPrestacionesTurno(listaFinal);
      setNuevaPrestacionId("");
      onCambiado();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardandoPrestaciones(false);
    }
  }

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

  async function confirmarMovimiento() {
    setError(null);
    setMoviendo(true);
    try {
      const turnosDelDiaDestino = await obtenerTurnosGeneralPorFecha(nuevaFecha);
      const conflicto = hayConflictoDeHorario({
        turnosVisibles: turnosDelDiaDestino.filter(seMuestraEnGrilla),
        consultorio: Number(nuevoConsultorio),
        profesionalDeTurnoId: turnoActual.profesionalDeTurnoId,
        horaInicio: nuevaHora,
        duracionMin: turnoActual.duracionMin,
        idExcluido: turnoActual.id,
      });
      if (conflicto) {
        setError("Ese horario ya está ocupado en ese consultorio, o el profesional ya tiene otro turno a esa hora.");
        return;
      }

      await actualizarEstadoTurnoGeneral(turnoActual.id, {
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
        <p className="mb-1 text-sm text-gray-500">
          {fecha} · {turnoActual.horaInicio} · Consultorio {turnoActual.consultorio} · {turnoActual.tipoAtencion} ·{" "}
          {turnoActual.profesionalDeTurno}
        </p>
        <div className="mb-4 rounded-md border border-gray-200 p-3">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase text-gray-400">
              A qué viene (hasta {MAX_PRESTACIONES_TURNO})
            </p>
            <span className="text-xs text-gray-400">Duración actual: {turnoActual.duracionMin} min</span>
          </div>

          {prestacionesTurno.length === 0 && (
            <p className="mb-2 text-sm text-gray-500">Todavía no tiene una prestación cargada.</p>
          )}
          {prestacionesTurno.length > 0 && (
            <ul className="mb-2 flex flex-col gap-1">
              {prestacionesTurno.map((p, i) => (
                <li key={i} className="flex items-center justify-between text-sm text-gray-700">
                  <span>{p.prestacion}</span>
                  <span className="flex items-center gap-2">
                    {p.tiempoEstimadoMin ? <span className="text-xs text-gray-400">{p.tiempoEstimadoMin} min</span> : null}
                    <button type="button" onClick={() => quitarPrestacion(i)} className="text-gray-400 hover:text-red-600">
                      ✕
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {prestacionesTurno.length < MAX_PRESTACIONES_TURNO && (
            <div className="flex items-center gap-2">
              <select
                value={nuevaPrestacionId}
                onChange={(e) => setNuevaPrestacionId(e.target.value)}
                className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="">(elegir prestación)</option>
                {prestacionesDisponibles.map((p) => (
                  <option key={p.itemId} value={p.itemId}>
                    {p.prestacion}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={agregarPrestacion}
                disabled={!nuevaPrestacionId}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                + Agregar
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={guardarPrestaciones}
            disabled={guardandoPrestaciones}
            className="mt-2 rounded-md bg-brand-brown px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
          >
            {guardandoPrestaciones ? "Guardando..." : "Guardar prestación"}
          </button>
        </div>

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

          {!mostrarMover ? (
            <button
              onClick={() => setMostrarMover(true)}
              disabled={guardando !== null}
              className="w-fit text-sm text-blue-600 hover:underline disabled:opacity-50"
            >
              Mover turno
            </button>
          ) : (
            <div className="rounded-md border border-brand-mint/40 bg-brand-mint/15 p-3">
              <p className="mb-2 text-xs font-semibold uppercase text-brand-green">Mover a</p>
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
