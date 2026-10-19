"use client";

import { useState } from "react";
import { CONCEPTOS_TURNO_ORTODONCIA, TIPOS_BRACKET_ORTODONCIA } from "@/lib/ortodoncia";
import { completarVisitaOrtodoncia } from "@/lib/data/prestacionesRealizadas";

// Formulario para completar una visita de Ortodoncia que la secretaria ya cobró antes de que el
// ortodoncista marcara qué hizo: qué se hace la próxima vez (o el alta), la nota y si se despegó
// algún bracket. Se usa dentro del turno (Agenda) y en "Pendientes de registro".
export default function CompletarVisitaOrtodoncia({ visita, onCompletado }) {
  const [seDespegoBracket, setSeDespegoBracket] = useState(false);
  const [bracketReposicion, setBracketReposicion] = useState(TIPOS_BRACKET_ORTODONCIA[0]);
  const [cantidadBrackets, setCantidadBrackets] = useState(1);
  const [altaPaciente, setAltaPaciente] = useState(false);
  const [proximaPrestacion, setProximaPrestacion] = useState("");
  const [tiempoProximoTurno, setTiempoProximoTurno] = useState("");
  const [notaProximoTurno, setNotaProximoTurno] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  // Si la secretaria ya cobró el bracket junto con el control, no se vuelve a pedir.
  const bracketYaCobrado = Boolean(visita.bracketReposicion);

  async function guardar() {
    setError(null);
    if (!proximaPrestacion && !altaPaciente) {
      setError("Elegí la prestación para el próximo turno, o marcá que el paciente está de alta.");
      return;
    }
    setGuardando(true);
    try {
      await completarVisitaOrtodoncia({
        visita,
        seDespegoBracket: seDespegoBracket && !bracketYaCobrado,
        bracketReposicion,
        cantidadBrackets,
        notaProximoTurno: notaProximoTurno.trim() || null,
        proximaPrestacionNombre: proximaPrestacion || null,
        proximaPrestacionTiempoMin: tiempoProximoTurno ? Number(tiempoProximoTurno) : null,
        alta: altaPaciente,
      });
      onCompletado?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs text-amber-900">
        💰 Secretaría ya cobró esta visita (<strong>{visita.prestacion}</strong>
        {bracketYaCobrado && (
          <>
            {" "}+ bracket {visita.bracketReposicion} x{visita.cantidadBrackets || 1}
          </>
        )}
        ). Completá lo que falta.
      </div>

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800">{error}</div>}

      {bracketYaCobrado ? (
        <p className="text-xs text-gray-500">El bracket que se despegó ya está incluido en el cobro.</p>
      ) : (
        <div className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5">
          <label className="flex items-center gap-2 text-xs text-gray-700">
            <input type="checkbox" checked={seDespegoBracket} onChange={(e) => setSeDespegoBracket(e.target.checked)} />
            Se despegó algún bracket (secretaría lo va a cobrar aparte)
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

      <div className="border-t border-gray-100 pt-2">
        <p className="mb-1 text-xs font-semibold text-gray-700">¿Qué vas a realizar la próxima vez?</p>

        <label
          className={`mb-2 flex cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2 text-xs ${
            altaPaciente ? "border-emerald-400 bg-emerald-50 text-emerald-900" : "border-gray-200 bg-gray-50 text-gray-700"
          }`}
        >
          <input type="checkbox" checked={altaPaciente} onChange={(e) => setAltaPaciente(e.target.checked)} className="mt-0.5" />
          <span>
            <strong>🏁 Paciente de alta: no se realiza nada más.</strong>
          </span>
        </label>

        {!altaPaciente && (
          <>
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
            </label>
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
            </label>
          </>
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
        onClick={guardar}
        disabled={guardando || (!proximaPrestacion && !altaPaciente)}
        className="w-full rounded-md bg-brand-brown px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
      >
        {guardando ? "Guardando..." : "✓ Guardar"}
      </button>
    </div>
  );
}
