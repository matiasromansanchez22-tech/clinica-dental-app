"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  crearRecordatorio,
  eliminarRecordatorio,
  marcarRecordatorioHecho,
  obtenerRecordatorios,
} from "@/lib/data/recordatoriosAgenda";

function formatoCorto(fechaISO) {
  const [, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}`;
}

function NuevoRecordatorioModal({ fechaInicial, agendaInicial, onClose, onGuardado }) {
  const [texto, setTexto] = useState("");
  const [fecha, setFecha] = useState(fechaInicial);
  const [agenda, setAgenda] = useState(agendaInicial);
  const [horaAviso, setHoraAviso] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  async function guardar() {
    if (!texto.trim()) {
      setError("Escribí qué hay que recordar.");
      return;
    }
    if (!fecha) {
      setError("Elegí el día.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await crearRecordatorio({ fecha, texto, agenda, horaAviso });
      onGuardado();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">📌 Nuevo recordatorio</h2>
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

        <label className="mt-3 flex flex-col gap-1 text-xs text-gray-700">
          ¿Qué hay que recordar?
          <input
            autoFocus
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && guardar()}
            placeholder="Ej. Llamar a Dental Pin por el trabajo"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs text-gray-700">
            Día
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-700">
            Avisar a las (opcional)
            <input
              type="time"
              value={horaAviso}
              onChange={(e) => setHoraAviso(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
        <p className="mt-1 text-[11px] text-gray-400">
          Con hora, ese día suena un aviso en la pantalla y llega al celular de las dueñas y secretarias que tengan la app abierta.
        </p>

        <label className="mt-3 flex flex-col gap-1 text-xs text-gray-700">
          Se ve en
          <select value={agenda} onChange={(e) => setAgenda(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="General">Agenda de Odontología General</option>
            <option value="Ortodoncia">Agenda de Ortodoncia</option>
            <option value="Ambas">Las dos agendas</option>
          </select>
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={guardando}
            className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
          >
            {guardando ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Franja de recordatorios arriba de la grilla de la Agenda. Muestra los del día
// (o los de la semana, con el día adelante) y deja agregar, tildar como hecho o
// borrar. Solo para Dueñas y Secretarias.
//   agenda: "General" | "Ortodoncia"
export default function RecordatoriosDelDia({ agenda, desde, hasta }) {
  const { perfil } = useAuth();
  const habilitado = perfil?.rol === "Duena" || perfil?.rol === "Secretaria";
  const [recordatorios, setRecordatorios] = useState([]);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(false);

  const recargar = useCallback(() => {
    obtenerRecordatorios(desde, hasta, agenda)
      .then((r) => {
        setRecordatorios(r);
        setError(null);
      })
      .catch((e) => setError(e.message));
  }, [desde, hasta, agenda]);

  useEffect(() => {
    if (!habilitado) return;
    recargar();
  }, [habilitado, recargar]);

  if (!habilitado) return null;

  const esSemana = desde !== hasta;

  async function alternarHecho(r) {
    try {
      await marcarRecordatorioHecho(r.id, !r.hecho);
      recargar();
    } catch (e) {
      setError(e.message);
    }
  }

  async function borrar(r) {
    if (!window.confirm(`¿Borrar el recordatorio "${r.texto}"?`)) return;
    try {
      await eliminarRecordatorio(r.id);
      recargar();
    } catch (e) {
      setError(e.message);
    }
  }

  const pendientes = recordatorios.filter((r) => !r.hecho).length;

  return (
    <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-amber-900">
          📌 Recordatorios{recordatorios.length > 0 && <span className="ml-1 font-normal text-amber-700">({pendientes} pendiente{pendientes === 1 ? "" : "s"})</span>}
        </p>
        <button
          onClick={() => setModal(true)}
          className="rounded-md border border-amber-400 bg-white px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
        >
          + Agregar
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
      {recordatorios.length === 0 && !error && (
        <p className="mt-0.5 text-xs text-amber-700">{esSemana ? "No hay recordatorios esta semana." : "No hay recordatorios para este día."}</p>
      )}
      {recordatorios.length > 0 && (
        <ul className="mt-1.5 flex flex-col gap-1">
          {recordatorios.map((r) => (
            <li key={r.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={r.hecho} onChange={() => alternarHecho(r)} className="h-4 w-4 shrink-0 accent-amber-700" />
              <span className={`min-w-0 flex-1 ${r.hecho ? "text-gray-400 line-through" : "text-gray-900"}`}>
                {esSemana && <span className="mr-1.5 text-xs font-semibold text-amber-800">{formatoCorto(r.fecha)}</span>}
                {r.texto}
                {r.agenda === "Ambas" && <span className="ml-1.5 text-[10px] text-gray-400">(ambas agendas)</span>}
              </span>
              {r.horaAviso && (
                <span className="shrink-0 rounded bg-white px-1.5 py-0.5 text-[11px] text-amber-800" title="Hora del aviso">
                  🔔 {r.horaAviso}
                </span>
              )}
              <button onClick={() => borrar(r)} aria-label="Borrar recordatorio" className="shrink-0 text-xs text-gray-400 hover:text-red-600">
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      {modal && (
        <NuevoRecordatorioModal
          fechaInicial={desde}
          agendaInicial={agenda}
          onClose={() => setModal(false)}
          onGuardado={() => {
            setModal(false);
            recargar();
          }}
        />
      )}
    </div>
  );
}
