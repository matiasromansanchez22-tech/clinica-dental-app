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
  const [precioElegido, setPrecioElegido] = useState("");
  const [notaProximoTurno, setNotaProximoTurno] = useState("");
  const [cargoExtraDescripcion, setCargoExtraDescripcion] = useState("");
  const [cargoExtraMonto, setCargoExtraMonto] = useState("");
  const [proximaPrestacionCatalogoId, setProximaPrestacionCatalogoId] = useState("");
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
    if (!paso.realizadoId && catalogo?.length > 0 && !proximaPrestacionCatalogoId) {
      setError("Elegí la prestación para el próximo turno antes de marcarlo como hecho.");
      return;
    }
    setGuardando(true);
    try {
      if (paso.realizadoId) {
        await desmarcarPasoRealizado(paso.realizadoId);
      } else {
        const proximoItem = catalogo?.find((c) => c.id === proximaPrestacionCatalogoId);
        await marcarPasoPlanRealizado({
          presupuestoId: planActivo.presupuesto_id,
          prestacion: paso.nombre,
          pacienteId: turno.pacienteId,
          profesionalId: profesionalId || null,
          turnoGeneralId: turno.id,
          notaProximoTurno: notaProximoTurno.trim() || null,
          cargoExtraDescripcion: cargoExtraDescripcion.trim() || null,
          cargoExtraMonto: cargoExtraMonto ? Number(cargoExtraMonto) : null,
          proximaPrestacionCatalogoId: proximoItem?.id,
          proximaPrestacionNombre: proximoItem?.prestacion,
          fecha,
        });
        // La nota, el cargo extra y la próxima prestación son por visita,
        // no por paso — se limpian después de usarse una vez para no
        // duplicarlos si se tildan varios pasos seguidos.
        setNotaProximoTurno("");
        setCargoExtraDescripcion("");
        setCargoExtraMonto("");
        setProximaPrestacionCatalogoId("");
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
    if (catalogo?.length > 0 && !proximaPrestacionCatalogoId) {
      setError("Elegí la prestación para el próximo turno antes de marcarlo como hecho.");
      return;
    }
    setGuardando(true);
    try {
      const proximoItem = catalogo?.find((c) => c.id === proximaPrestacionCatalogoId);
      await marcarPrestacionAdHocRealizada({
        catalogoId: item.id,
        prestacion: item.prestacion,
        cantidad: Number(cantidadElegida) || 1,
        precioManual: precioElegido ? Number(precioElegido) : null,
        pacienteId: turno.pacienteId,
        profesionalId: profesionalId || null,
        turnoGeneralId: turno.id,
        notaProximoTurno: notaProximoTurno.trim() || null,
        proximaPrestacionCatalogoId: proximoItem?.id,
        proximaPrestacionNombre: proximoItem?.prestacion,
        fecha,
      });
      await marcarTurnoFinalizado();
      setCatalogoIdElegido("");
      setCantidadElegida(1);
      setPrecioElegido("");
      setNotaProximoTurno("");
      setProximaPrestacionCatalogoId("");
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

  const pasosPendientes = pasos.filter((p) => !p.realizadoId && !p.cobrado).map((p) => p.nombre);

  if (!turno.pacienteId) return null;

  return (
    <div className="mt-4 border-t border-gray-200 pt-3">
      <p className="mb-2 text-xs font-semibold uppercase text-brand-brown">Actividad de hoy</p>

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

      <p className="mb-1 text-xs font-semibold text-gray-700">¿Qué hiciste hoy?</p>

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
                  disabled={
                    paso.cobrado ||
                    guardando ||
                    (!paso.realizadoId && catalogo?.length > 0 && !proximaPrestacionCatalogoId)
                  }
                  onChange={() => togglePaso(paso)}
                />
                Paso {i + 1}: {paso.nombre}
                {paso.cobrado && <span className="text-xs text-emerald-600">(ya cobrado)</span>}
                {!paso.cobrado && paso.realizadoId && (
                  <span className="text-xs text-amber-600">(pendiente de cobro)</span>
                )}
                {paso.cargoExtraMonto ? (
                  <span className="text-xs text-gray-500">
                    + {paso.cargoExtraDescripcion || "cargo extra"} (${Number(paso.cargoExtraMonto).toLocaleString("es-AR")})
                  </span>
                ) : null}
                {paso.notaProximoTurno && (
                  <span className="text-xs text-gray-500">📌 Sigue: {paso.notaProximoTurno}</span>
                )}
                {paso.proximaPrestacionNombre && (
                  <span className="text-xs text-gray-500">
                    📅 Próxima vez: {paso.proximaPrestacionNombre}
                  </span>
                )}
              </label>
            ))}
            {catalogo?.length > 0 && !proximaPrestacionCatalogoId && pasos.some((p) => !p.realizadoId && !p.cobrado) && (
              <p className="text-[11px] text-amber-600">
                ⚠ Elegí primero, más abajo, qué vas a realizar la próxima vez — recién ahí se puede tildar un paso.
              </p>
            )}
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
                    {p.cantidad > 1 ? ` x${p.cantidad}` : ""}
                    {p.precio_manual ? ` — $${Number(p.precio_manual).toLocaleString("es-AR")}` : ""}{" "}
                    <span className="text-xs text-amber-600">(pendiente de cobro)</span>
                    {p.nota_proximo_turno && (
                      <span className="block text-xs text-gray-500">📌 Próximo turno: {p.nota_proximo_turno}</span>
                    )}
                    {p.proxima_prestacion_nombre && (
                      <span className="block text-xs text-gray-500">
                        📅 Próxima vez: {p.proxima_prestacion_nombre}
                      </span>
                    )}
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
            <div className="flex flex-col gap-1.5">
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
                  title="Cantidad"
                  className="w-14 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <input
                type="number"
                min={0}
                value={precioElegido}
                onChange={(e) => setPrecioElegido(e.target.value)}
                placeholder="Precio distinto por unidad (opcional)"
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
              <p className="text-[11px] text-gray-400">
                Dejalo vacío para usar el precio de lista/efectivo del catálogo.
              </p>
            </div>
          ) : (
            <p className="text-xs text-gray-500">No hay catálogo de prestaciones para elegir.</p>
          )}
        </div>
      )}

      {!cargando && turno.pacienteId && planActivo && (
        <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5">
          <p className="mb-1 text-xs text-gray-600">Cargo extra (opcional, algo aparte del plan)</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={cargoExtraDescripcion}
              onChange={(e) => setCargoExtraDescripcion(e.target.value)}
              placeholder="Ej: Estudio radiográfico"
              className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-xs"
            />
            <input
              type="number"
              min={0}
              value={cargoExtraMonto}
              onChange={(e) => setCargoExtraMonto(e.target.value)}
              placeholder="Monto"
              className="w-24 rounded-md border border-gray-300 px-2 py-1 text-xs"
            />
          </div>
        </div>
      )}

      {!cargando && turno.pacienteId && (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <p className="mb-1 text-xs font-semibold text-gray-700">¿Qué vas a realizar la próxima vez?</p>

          {catalogo?.length > 0 && (
            <label className="mb-2 flex flex-col gap-1 text-xs text-gray-600">
              Prestación para el próximo turno <span className="text-red-600">*</span>
              <select
                value={proximaPrestacionCatalogoId}
                onChange={(e) => setProximaPrestacionCatalogoId(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="">(elegir prestación)</option>
                {catalogo.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.prestacion}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-gray-400">
                Obligatorio: hasta que no elijas esto no se puede marcar como hecho arriba ni mandar a cobrar.
                Cuando le den el próximo turno a este paciente, va a venir pre-cargado con esto.
              </span>
            </label>
          )}

          {planActivo ? (
            pasosPendientes.length > 0 && (
              <label className="flex flex-col gap-1 text-xs text-gray-600">
                ¿Cuál sigue? (opcional)
                <select
                  value={notaProximoTurno}
                  onChange={(e) => setNotaProximoTurno(e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                >
                  <option value="">(no indicar)</option>
                  {pasosPendientes.map((nombre, i) => (
                    <option key={`${nombre}-${i}`} value={nombre}>
                      {nombre}
                    </option>
                  ))}
                </select>
              </label>
            )
          ) : (
            <label className="flex flex-col gap-1 text-xs text-gray-600">
              Nota para el próximo turno (opcional)
              <textarea
                value={notaProximoTurno}
                onChange={(e) => setNotaProximoTurno(e.target.value)}
                rows={2}
                placeholder="Ej: continuar con el conducto"
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
          )}
        </div>
      )}

      {!cargando && !planActivo && catalogo?.length > 0 && (
        <button
          type="button"
          onClick={agregarAdHoc}
          disabled={!catalogoIdElegido || guardando || !proximaPrestacionCatalogoId}
          className="mt-3 w-full rounded-md bg-brand-brown px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
        >
          ✓ Marcar hecho
        </button>
      )}
      <p className="mt-2 text-xs text-gray-400">Lo que marques acá le va a quedar pre-cargado al secretario cuando cobre.</p>
    </div>
  );
}
