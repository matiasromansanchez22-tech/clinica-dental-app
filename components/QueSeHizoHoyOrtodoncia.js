"use client";

import { useEffect, useRef, useState } from "react";
import {
  CONCEPTO_CONTINUACION,
  CONCEPTOS_ORTODONCIA,
  CONCEPTOS_TURNO_ORTODONCIA,
  precioContinuacionSugerido,
  TIPOS_BRACKET_ORTODONCIA,
} from "@/lib/ortodoncia";
import {
  definirContinuacionEnFicha,
  obtenerConfiguracionOrtodoncia,
  obtenerPacienteOrtodonciaPorId,
} from "@/lib/data/pacientesOrtodoncia";
import {
  marcarTurnoOrtodonciaRealizado,
  obtenerPendienteCobroOrtodoncia,
  obtenerVisitaPorCompletarDePaciente,
  obtenerVisitaYaCobradaOrtodoncia,
  registrarVisitaCobradaPorCompletar,
} from "@/lib/data/prestacionesRealizadas";
import { actualizarEstadoTurnoOrtodoncia } from "@/lib/data/turnosOrtodoncia";
import CompletarVisitaOrtodoncia from "@/components/CompletarVisitaOrtodoncia";
import { avisarVisitasPorCompletarCambiaron } from "@/components/AvisoVisitasPorCompletar";

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
  const [seDespegoBracket, setSeDespegoBracket] = useState(false);
  const [bracketReposicion, setBracketReposicion] = useState(TIPOS_BRACKET_ORTODONCIA[0]);
  const [cantidadBrackets, setCantidadBrackets] = useState(1);
  const [notaProximoTurno, setNotaProximoTurno] = useState("");
  const [cargoExtraDescripcion, setCargoExtraDescripcion] = useState("");
  const [cargoExtraMonto, setCargoExtraMonto] = useState("");
  const [proximaPrestacion, setProximaPrestacion] = useState("");
  const [tiempoProximoTurno, setTiempoProximoTurno] = useState("");
  // Alta: el paciente termina el tratamiento y no se realiza nada más (no hace falta elegir
  // la prestación del próximo turno).
  const [altaPaciente, setAltaPaciente] = useState(false);
  // Para la continuación: tipo de brackets ("Metalicos"/"Porcelana", como en la
  // ficha) y los precios del catálogo para mostrar cuánto se cobra.
  const [tipoBracketsContinuacion, setTipoBracketsContinuacion] = useState("");
  const [preciosCatalogo, setPreciosCatalogo] = useState({});
  const [pendiente, setPendiente] = useState(null);
  // La secretaria ya cobró esta visita antes de que se marcara qué se hizo.
  const [visitaPorCompletar, setVisitaPorCompletar] = useState(null);
  const [visitaCompletada, setVisitaCompletada] = useState(false);
  // Lo que ya pasó con esta visita: si la cobraron y si el ortodoncista ya la completó.
  const [visitaCobrada, setVisitaCobrada] = useState(null);
  const creandoPorCompletar = useRef(false);
  // Por las dudas: aunque la visita ya esté cobrada, el profesional puede abrir el formulario completo (con un aviso).
  const [verFormularioCompleto, setVerFormularioCompleto] = useState(false);
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
    obtenerVisitaPorCompletarDePaciente(turno.pacienteId).then((v) => setVisitaPorCompletar(v?.fecha === fecha ? v : null));
    obtenerVisitaYaCobradaOrtodoncia(turno.pacienteId, fecha)
      .then(setVisitaCobrada)
      .catch(() => {});
    obtenerConfiguracionOrtodoncia()
      .then(setPreciosCatalogo)
      .catch(() => {});
    obtenerPacienteOrtodonciaPorId(turno.pacienteId)
      .then((p) => setTipoBracketsContinuacion(p?.tipoBrackets || ""))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turno.pacienteId]);

  // Si la visita ya está cobrada pero no hay un aviso para completarla (por ejemplo se cobró de una forma que no lo generó), se arma
  // uno acá: al ortodoncista le queda el formulario reducido (brackets y próximo turno) y no el de "qué hiciste hoy".
  useEffect(() => {
    if (cargando || visitaPorCompletar || pendiente || !visitaCobrada?.cobro || visitaCobrada.completada) return;
    if (creandoPorCompletar.current) return;
    creandoPorCompletar.current = true;
    registrarVisitaCobradaPorCompletar({
      fecha,
      pacienteOrtodonciaId: turno.pacienteId,
      ortodoncistaId: turno.profesionalDeTurnoId || visitaCobrada.cobro.ortodoncista_id,
      turnoOrtodonciaId: turno.id,
      concepto: visitaCobrada.cobro.concepto,
      cajaOrtodonciaId: visitaCobrada.cobro.id,
    })
      .then(() => obtenerVisitaPorCompletarDePaciente(turno.pacienteId))
      .then((v) => setVisitaPorCompletar(v?.fecha === fecha ? v : null))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargando, visitaPorCompletar, pendiente, visitaCobrada]);

  async function marcarRealizado() {
    setError(null);
    if (!proximaPrestacion && !altaPaciente) {
      setError("Elegí la prestación para el próximo turno, o marcá que el paciente está de alta, antes de marcar como hecho.");
      return;
    }
    const esContinuacion = concepto === CONCEPTO_CONTINUACION;
    if (esContinuacion && !tipoBracketsContinuacion) {
      setError("Elegí el tipo de brackets de la continuación para que aparezca el valor a cobrar.");
      return;
    }
    setGuardando(true);
    try {
      if (esContinuacion) await definirContinuacionEnFicha(turno.pacienteId, tipoBracketsContinuacion);
      await marcarTurnoOrtodonciaRealizado({
        turnoOrtodonciaId: turno.id,
        pacienteOrtodonciaId: turno.pacienteId,
        ortodoncistaId: turno.profesionalDeTurnoId,
        concepto,
        bracketReposicion: concepto === "Control" && seDespegoBracket ? bracketReposicion : null,
        cantidadBrackets: concepto === "Control" && seDespegoBracket ? cantidadBrackets : null,
        notaProximoTurno: notaProximoTurno.trim() || null,
        cargoExtraDescripcion: cargoExtraDescripcion.trim() || null,
        cargoExtraMonto: cargoExtraMonto ? Number(cargoExtraMonto) : null,
        proximaPrestacionNombre: altaPaciente ? null : proximaPrestacion || null,
        proximaPrestacionTiempoMin: !altaPaciente && tiempoProximoTurno ? Number(tiempoProximoTurno) : null,
        alta: altaPaciente,
        precioManual: esContinuacion ? precioContinuacionSugerido(tipoBracketsContinuacion, preciosCatalogo) : null,
        fecha,
      });
      if (turno.presencia !== "Finalizado") {
        const actualizado = await actualizarEstadoTurnoOrtodoncia(turno.id, { presencia: "Finalizado" });
        onTurnoActualizado?.(actualizado);
      }
      setNotaProximoTurno("");
      setCargoExtraDescripcion("");
      setCargoExtraMonto("");
      setProximaPrestacion("");
      setTiempoProximoTurno("");
      setAltaPaciente(false);
      const pendienteNuevo = await obtenerPendienteCobroOrtodoncia(turno.pacienteId);
      setPendiente(pendienteNuevo);
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  async function alCompletarVisita() {
    setVisitaPorCompletar(null);
    setVisitaCompletada(true);
    avisarVisitasPorCompletarCambiaron();
    if (turno.presencia !== "Finalizado") {
      try {
        const actualizado = await actualizarEstadoTurnoOrtodoncia(turno.id, { presencia: "Finalizado" });
        onTurnoActualizado?.(actualizado);
      } catch (e) {
        setError(e.message);
      }
    }
    setPendiente(await obtenerPendienteCobroOrtodoncia(turno.pacienteId).catch(() => null));
  }

  if (!turno.pacienteId) return null;

  if (visitaPorCompletar && !verFormularioCompleto) {
    return (
      <div className="mt-4 border-t border-gray-200 pt-3">
        <p className="mb-2 text-xs font-semibold uppercase text-brand-brown">Actividad de hoy</p>
        <CompletarVisitaOrtodoncia visita={visitaPorCompletar} onCompletado={alCompletarVisita} />
        <button type="button" onClick={() => setVerFormularioCompleto(true)} className="mt-2 text-xs text-gray-500 underline hover:text-gray-700">
          Marcar qué se hizo igual (por las dudas)
        </button>
      </div>
    );
  }

  const visitaYaCobrada = Boolean(visitaCobrada?.cobro || visitaPorCompletar || visitaCompletada || visitaCobrada?.completada);

  return (
    <div className="mt-4 border-t border-gray-200 pt-3">
      <p className="mb-2 text-xs font-semibold uppercase text-brand-brown">Actividad de hoy</p>
      {error && (
        <div className="mb-2 rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800">{error}</div>
      )}
      {cargando ? (
        <p className="text-xs text-gray-500">Buscando...</p>
      ) : (visitaCompletada || visitaCobrada?.completada) && !pendiente && !verFormularioCompleto ? (
        <div className="text-sm text-emerald-700">
          <p>✓ Visita completada: ya estaba cobrada y quedó registrado qué sigue.</p>
          {visitaCobrada?.completada?.nota_proximo_turno && (
            <p className="mt-1 text-xs text-emerald-600">📌 Próximo turno: {visitaCobrada.completada.nota_proximo_turno}</p>
          )}
          {visitaCobrada?.completada?.proxima_prestacion_nombre && (
            <p className="mt-1 text-xs text-emerald-600">
              📅 La próxima vez viene para: {visitaCobrada.completada.proxima_prestacion_nombre}
              {visitaCobrada.completada.proxima_prestacion_tiempo_min ? ` (turno de ${visitaCobrada.completada.proxima_prestacion_tiempo_min} min)` : ""}
            </p>
          )}
          <button type="button" onClick={() => setVerFormularioCompleto(true)} className="mt-2 text-xs text-gray-500 underline hover:text-gray-700">
            Marcar qué se hizo igual (por las dudas)
          </button>
        </div>
      ) : pendiente ? (
        <div className="text-sm text-emerald-700">
          <p>
            ✓ Marcado como <strong>{pendiente.prestacion}</strong>
            {pendiente.bracket_reposicion && (
              <>
                {" "}
                + bracket {pendiente.bracket_reposicion} x{pendiente.cantidad_brackets || 1}
              </>
            )}
            {pendiente.prestacion === CONCEPTO_CONTINUACION && pendiente.precio_manual ? (
              <>
                {" "}
                (valor a cobrar: ${Number(pendiente.precio_manual).toLocaleString("es-AR")})
              </>
            ) : null}
            {pendiente.cargo_extra_monto ? (
              <>
                {" "}
                + {pendiente.cargo_extra_descripcion || "cargo extra"} ($
                {Number(pendiente.cargo_extra_monto).toLocaleString("es-AR")})
              </>
            ) : null}{" "}
            — pendiente de que lo cobren.
          </p>
          {pendiente.nota_proximo_turno && (
            <p className="mt-1 text-xs text-emerald-600">📌 Próximo turno: {pendiente.nota_proximo_turno}</p>
          )}
          {pendiente.proxima_prestacion_nombre && (
            <p className="mt-1 text-xs text-emerald-600">
              📅 La próxima vez viene para: {pendiente.proxima_prestacion_nombre}
              {pendiente.proxima_prestacion_tiempo_min ? ` (turno de ${pendiente.proxima_prestacion_tiempo_min} min)` : ""}
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visitaYaCobrada && (
            <div className="rounded-md border-2 border-red-400 bg-red-50 px-3 py-2 text-xs text-red-900">
              <p className="font-semibold">⚠️ Esta visita ya se cobró.</p>
              <p className="mt-0.5">
                Si marcás qué hiciste, puede aparecer otra vez como algo para cobrar. Usalo solo si hiciste algo distinto a lo que ya se cobró (por ejemplo una reposición de bracket). Si no, indicá los brackets y el próximo turno en el formulario de «Actividad de hoy».
              </p>
              <button type="button" onClick={() => setVerFormularioCompleto(false)} className="mt-1 font-medium underline">
                Volver
              </button>
            </div>
          )}
          <p className="mb-1 text-xs font-semibold text-gray-700">¿Qué hiciste hoy?</p>

          <select
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            {CONCEPTOS_ORTODONCIA.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          {concepto === CONCEPTO_CONTINUACION && (
            <div className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1.5 text-xs text-blue-900">
              <label className="flex flex-col gap-1">
                Es continuación — tipo de brackets <span className="text-red-600">*</span>
                <select
                  value={tipoBracketsContinuacion}
                  onChange={(e) => setTipoBracketsContinuacion(e.target.value)}
                  className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
                >
                  <option value="">(elegir)</option>
                  <option value="Metalicos">Metálico</option>
                  <option value="Porcelana">Porcelana</option>
                </select>
              </label>
              <p className="mt-1.5">
                {tipoBracketsContinuacion ? (
                  <>
                    Valor a cobrar:{" "}
                    <strong>
                      ${(precioContinuacionSugerido(tipoBracketsContinuacion, preciosCatalogo) || 0).toLocaleString("es-AR")}
                    </strong>{" "}
                    (2 veces el control). Se paga una sola vez y cuenta como el control de este mes.
                  </>
                ) : (
                  "Elegí el tipo de brackets y te muestro cuánto se cobra."
                )}
              </p>
            </div>
          )}

          {concepto === "Control" && (
            <div className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5">
              <label className="flex items-center gap-2 text-xs text-gray-700">
                <input
                  type="checkbox"
                  checked={seDespegoBracket}
                  onChange={(e) => setSeDespegoBracket(e.target.checked)}
                />
                Se despegó algún bracket (se suma al total del control)
              </label>
              {seDespegoBracket && (
                <div className="mt-2 flex items-center gap-2">
                  <select
                    value={bracketReposicion}
                    onChange={(e) => setBracketReposicion(e.target.value)}
                    className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                  >
                    {TIPOS_BRACKET_ORTODONCIA.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={cantidadBrackets}
                    onChange={(e) => setCantidadBrackets(e.target.value)}
                    className="w-14 rounded-md border border-gray-300 px-2 py-1 text-xs"
                  />
                  <span className="text-xs text-gray-500">bracket(s)</span>
                </div>
              )}
            </div>
          )}

          <div className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5">
            <p className="mb-1 text-xs text-gray-600">Cargo extra (opcional, se suma al total)</p>
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

          <div className="mt-2 border-t border-gray-100 pt-3">
            <p className="mb-1 text-xs font-semibold text-gray-700">¿Qué vas a realizar la próxima vez?</p>

            <label
              className={`mb-2 flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2 text-xs ${
                altaPaciente ? "border-emerald-400 bg-emerald-50 text-emerald-900" : "border-gray-200 bg-gray-50 text-gray-700"
              }`}
            >
              <input type="checkbox" checked={altaPaciente} onChange={(e) => setAltaPaciente(e.target.checked)} className="mt-0.5" />
              <span>
                <strong>🏁 Paciente de alta: no se realiza nada más.</strong>
                <span className="block text-[11px] text-gray-500">
                  No hace falta elegir una prestación para el próximo turno. Si después le quieren dar un turno, se les avisa que figura de alta.
                </span>
              </span>
            </label>

            {!altaPaciente && (
            <label className="flex flex-col gap-1 text-xs text-gray-600">
              Prestación para el próximo turno <span className="text-red-600">*</span>
              <select
                value={proximaPrestacion}
                onChange={(e) => setProximaPrestacion(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="">(elegir)</option>
                {CONCEPTOS_TURNO_ORTODONCIA.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-gray-400">
                Obligatorio: hasta que no elijas esto (o marques el alta) no se puede marcar como hecho ni mandar a cobrar.
                Cuando le den el próximo turno a este paciente, va a venir pre-cargado con esto.
              </span>
            </label>
            )}

            {!altaPaciente && (
            <label className="mt-2 flex flex-col gap-1 text-xs text-gray-600">
              ¿Cuánto tiempo necesitás para el próximo turno?
              <select
                value={tiempoProximoTurno}
                onChange={(e) => setTiempoProximoTurno(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="">(el habitual de esa prestación)</option>
                {[15, 30, 45, 60].map((m) => (
                  <option key={m} value={m}>
                    {m} minutos
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-gray-400">
                Cuando le den el turno, el secretario lo va a ver cargado con este tiempo.
              </span>
            </label>
            )}

            <label className="mt-2 flex flex-col gap-1 text-xs text-gray-600">
              Nota para el próximo turno (opcional)
              <textarea
                value={notaProximoTurno}
                onChange={(e) => setNotaProximoTurno(e.target.value)}
                rows={2}
                placeholder="Ej: cambiar arco"
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
          </div>

          <button
            type="button"
            onClick={marcarRealizado}
            disabled={guardando || (!proximaPrestacion && !altaPaciente)}
            className="mt-1 w-full rounded-md bg-brand-brown px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
          >
            ✓ Marcar hecho
          </button>
        </div>
      )}
      <p className="mt-2 text-xs text-gray-400">Lo que marques acá le va a quedar pre-cargado al secretario cuando cobre.</p>
    </div>
  );
}
