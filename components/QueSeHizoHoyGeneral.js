"use client";

import { useEffect, useState } from "react";
import { obtenerPlanActivoPaciente } from "@/lib/data/caja";
import { actualizarEstadoTurnoGeneral } from "@/lib/data/turnosGeneral";
import {
  desmarcarPasoRealizado,
  marcarPasoPlanRealizado,
  marcarPrestacionAdHocRealizada,
  obtenerPasosDelPlan,
  obtenerPrestacionesAdHocPendientes,
  quitarPrestacionAdHocPendiente,
} from "@/lib/data/prestacionesRealizadas";

// Se usa tanto en la Agenda normal (secretaria) como en "Ver Agenda del
// Día" (solo lectura) — es el mismo mecanismo en los dos lugares, para que
// no importe por dónde entre el profesional a marcar qué hizo.
//
// `onTurnoActualizado` es opcional: si el que lo usa quiere mantener su
// propio estado del turno sincronizado (ej. para repintar la grilla), se le
// avisa acá cada vez que el turno pasa a "Finalizado".
export default function QueSeHizoHoyGeneral({ turno, fecha, profesionales, catalogo, onTurnoActualizado }) {
  const [profesionalId, setProfesionalId] = useState(turno.profesionalDeTurnoId || "");
  const [planActivo, setPlanActivo] = useState(null);
  const [pasos, setPasos] = useState([]);
  const [adHocPendientes, setAdHocPendientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [catalogoIdElegido, setCatalogoIdElegido] = useState("");
  const [cantidadElegida, setCantidadElegida] = useState(1);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  async function recargar() {
    if (!turno.pacienteId) {
      setCargando(false);
      return;
    }
    const plan = await obtenerPlanActivoPaciente(turno.pacienteId);
    setPlanActivo(plan);
    if (plan) {
      const pasosPlan = await obtenerPasosDelPlan(plan.presupuesto_id);
      setPasos(pasosPlan);
      setAdHocPendientes([]);
    } else {
      const pendientes = await obtenerPrestacionesAdHocPendientes(turno.pacienteId);
      setAdHocPendientes(pendientes);
      setPasos([]);
    }
  }

  useEffect(() => {
    setCargando(true);
    recargar()
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turno.pacienteId]);

  // Marcar algo como hecho también cierra el turno (presencia:
  // "Finalizado") — así queda a la vista en la grilla de la Agenda sin
  // tener que ir a tildarlo aparte. No se toca al desmarcar: si se
  // equivocaron y sacan una prestación, el turno se sigue viendo
  // finalizado (se destilda a mano si hace falta).
  async function marcarTurnoFinalizado() {
    if (turno.presencia === "Finalizado") return;
    const actualizado = await actualizarEstadoTurnoGeneral(turno.id, { presencia: "Finalizado" });
    onTurnoActualizado?.(actualizado);
  }

  async function togglePaso(paso) {
    setError(null);
    setGuardando(true);
    try {
      if (paso.realizadoId) {
        await desmarcarPasoRealizado(paso.realizadoId);
      } else {
        await marcarPasoPlanRealizado({
          presupuestoId: planActivo.presupuesto_id,
          prestacion: paso.nombre,
          pacienteId: turno.pacienteId,
          profesionalId: profesionalId || null,
          turnoGeneralId: turno.id,
          fecha,
        });
        await marcarTurnoFinalizado();
      }
      await recargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  async function agregarAdHoc() {
    if (!catalogoIdElegido) return;
    const item = catalogo.find((c) => c.id === catalogoIdElegido);
    if (!item) return;
    setError(null);
    setGuardando(true);
    try {
      await marcarPrestacionAdHocRealizada({
        catalogoId: item.id,
        prestacion: item.prestacion,
        cantidad: Number(cantidadElegida) || 1,
        pacienteId: turno.pacienteId,
        profesionalId: profesionalId || null,
        turnoGeneralId: turno.id,
        fecha,
      });
      await marcarTurnoFinalizado();
      setCatalogoIdElegido("");
      setCantidadElegida(1);
      await recargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  async function quitarAdHoc(id) {
    setError(null);
    setGuardando(true);
    try {
      await quitarPrestacionAdHocPendiente(id);
      await recargar();
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

      {profesionales?.length > 0 && (
        <label className="mb-2 flex flex-col gap-1 text-xs text-gray-600">
          Profesional que lo hizo
          <select
            value={profesionalId}
            onChange={(e) => setProfesionalId(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-800"
          >
            <option value="">(sin asignar)</option>
            {profesionales.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
      )}

      {error && (
        <div className="mb-2 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800">{error}</div>
      )}

      {cargando ? (
        <p className="text-xs text-gray-500">Buscando el plan de tratamiento...</p>
      ) : planActivo ? (
        pasos.length === 0 ? (
          <p className="text-xs text-gray-500">El plan de este paciente no tiene pasos cargados.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {pasos.map((paso, i) => (
              <label
                key={`${paso.nombre}-${i}`}
                className={`flex items-center gap-2 text-sm ${paso.cobrado ? "text-gray-400" : "text-gray-700"}`}
              >
                <input
                  type="checkbox"
                  checked={Boolean(paso.realizadoId) || paso.cobrado}
                  disabled={paso.cobrado || guardando}
                  onChange={() => togglePaso(paso)}
                />
                Paso {i + 1}: {paso.nombre}
                {paso.cobrado && <span className="text-xs text-emerald-600">(ya cobrado)</span>}
                {!paso.cobrado && paso.realizadoId && (
                  <span className="text-xs text-amber-600">(pendiente de cobro)</span>
                )}
              </label>
            ))}
          </div>
        )
      ) : (
        <div className="flex flex-col gap-2">
          {adHocPendientes.length > 0 && (
            <div className="flex flex-col gap-1">
              {adHocPendientes.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 text-sm text-gray-700">
                  <span>
                    {p.prestacion}
                    {p.cantidad > 1 ? ` x${p.cantidad}` : ""}{" "}
                    <span className="text-xs text-amber-600">(pendiente de cobro)</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => quitarAdHoc(p.id)}
                    disabled={guardando}
                    className="text-xs text-gray-400 hover:text-red-600"
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          )}
          {catalogo?.length > 0 ? (
            <div className="flex items-center gap-2">
              <select
                value={catalogoIdElegido}
                onChange={(e) => setCatalogoIdElegido(e.target.value)}
                className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="">(elegir prestación)</option>
                {catalogo.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.prestacion}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={cantidadElegida}
                onChange={(e) => setCantidadElegida(e.target.value)}
                className="w-14 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={agregarAdHoc}
                disabled={!catalogoIdElegido || guardando}
                className="rounded-md bg-brand-brown px-2 py-1.5 text-xs font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
              >
                + Agregar
              </button>
            </div>
          ) : (
            <p className="text-xs text-gray-500">No hay catálogo de prestaciones para elegir.</p>
          )}
        </div>
      )}
      <p className="mt-2 text-xs text-gray-400">Lo que marques acá le va a quedar pre-cargado al secretario cuando cobre.</p>
    </div>
  );
}
