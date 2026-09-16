"use client";

import { useState } from "react";
import { colorDeTurno } from "@/lib/agenda";

function formatoFecha(fechaISO) {
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}

// Buscador de "¿cuándo tenía turno este paciente?" — no filtra la grilla de
// la agenda (que solo muestra un día/semana a la vez), sino que busca en
// TODA su historia de turnos y deja saltar directo a la fecha que
// corresponda. Reutilizado por Agenda General y Agenda Ortodoncia, que
// difieren en cómo se llama el paciente y de dónde salen sus turnos.
export default function BuscarTurnoPacienteBox({ pacientes, nombreDe, obtenerTurnos, onElegirFecha }) {
  const [busqueda, setBusqueda] = useState("");
  const [pacienteElegido, setPacienteElegido] = useState(null);
  const [turnos, setTurnos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  const coincidencias =
    !pacienteElegido && busqueda.trim().length >= 2
      ? pacientes
          .filter((p) => (nombreDe(p) || "").toLowerCase().includes(busqueda.trim().toLowerCase()))
          .slice(0, 8)
      : [];

  async function elegirPaciente(p) {
    setPacienteElegido(p);
    setBusqueda(nombreDe(p));
    setCargando(true);
    setError(null);
    try {
      setTurnos(await obtenerTurnos(p.id));
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  function limpiar() {
    setBusqueda("");
    setPacienteElegido(null);
    setTurnos([]);
    setError(null);
  }

  return (
    <div className="relative w-full max-w-sm">
      <div className="flex items-center gap-1">
        <input
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
            setPacienteElegido(null);
          }}
          placeholder="🔍 Buscar paciente — ¿cuándo tenía turno?"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        {(busqueda || pacienteElegido) && (
          <button
            type="button"
            onClick={limpiar}
            className="shrink-0 text-xs text-gray-400 hover:text-gray-600"
            aria-label="Limpiar búsqueda"
          >
            ✕
          </button>
        )}
      </div>

      {coincidencias.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full max-h-48 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {coincidencias.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => elegirPaciente(p)}
                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50"
              >
                {nombreDe(p)}
              </button>
            </li>
          ))}
        </ul>
      )}

      {pacienteElegido && (
        <div className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto rounded-md border border-gray-200 bg-white p-2 shadow-lg">
          {cargando && <p className="px-1 py-1 text-xs text-gray-500">Buscando turnos...</p>}
          {error && <p className="px-1 py-1 text-xs text-red-700">{error}</p>}
          {!cargando && !error && turnos.length === 0 && (
            <p className="px-1 py-1 text-xs text-gray-500">{nombreDe(pacienteElegido)} no tiene turnos cargados.</p>
          )}
          {!cargando && turnos.length > 0 && (
            <ul className="flex flex-col gap-0.5">
              {turnos.map((t) => {
                const color = colorDeTurno(t);
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => onElegirFecha(t.fecha, t)}
                      className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs hover:bg-gray-50"
                    >
                      <span className="text-gray-700">
                        {formatoFecha(t.fecha)} — {t.horaInicio}
                        <span className="text-gray-400"> · {t.profesionalDeTurno}</span>
                      </span>
                      <span className={`rounded-full px-2 py-0.5 font-medium ${color.bg} ${color.text}`}>
                        {color.etiqueta}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
