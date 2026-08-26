"use client";

import { useEffect, useState } from "react";
import AgendaGrid from "@/components/AgendaGrid";
import AgendaSemanalGrid from "@/components/AgendaSemanalGrid";
import ConfiguracionDuracionOrtodonciaModal from "@/components/ConfiguracionDuracionOrtodonciaModal";
import NuevoTurnoOrtodonciaModal from "@/components/NuevoTurnoOrtodonciaModal";
import TurnoOrtodonciaDetalleModal from "@/components/TurnoOrtodonciaDetalleModal";
import {
  diaSemanaDeFecha,
  fechaDeHoyISO,
  generarBloquesHorarios,
  inicioDeSemana,
  NOMBRES_DIA_SEMANA,
  sumarDias,
} from "@/lib/agenda";
import { obtenerDuracionesOrtodoncia } from "@/lib/data/duracionOrtodoncia";
import { obtenerPacientesOrtodoncia } from "@/lib/data/pacientesOrtodoncia";
import { obtenerProfesionales } from "@/lib/data/profesionales";
import { obtenerTurnosOrtodonciaPorFecha, obtenerTurnosOrtodonciaPorRango } from "@/lib/data/turnosOrtodoncia";

const CONSULTORIOS_ORTO = [2, 3];
const bloques = generarBloquesHorarios("08:00", "19:30", 15);

const leyenda = [
  { color: "bg-emerald-600", etiqueta: "Asistió" },
  { color: "bg-red-600", etiqueta: "No asistió" },
  { color: "bg-gray-400", etiqueta: "Cancelado" },
  { color: "bg-amber-400", etiqueta: "En espera" },
  { color: "bg-sky-500", etiqueta: "En consultorio" },
  { color: "bg-violet-500", etiqueta: "Finalizado" },
  { color: "bg-orange-400", etiqueta: "Reprogramar" },
  { color: "bg-pink-400", etiqueta: "No responde" },
  { color: "bg-green-300", etiqueta: "Confirmado" },
  { color: "bg-gray-200", etiqueta: "Agendado" },
];

export default function AgendaOrtodonciaPage() {
  const [fecha, setFecha] = useState(fechaDeHoyISO());
  const [vista, setVista] = useState("dia"); // "dia" | "semana"
  const [turnos, setTurnos] = useState([]);
  const [ortodoncistas, setOrtodoncistas] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [duraciones, setDuraciones] = useState({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [slotElegido, setSlotElegido] = useState(null);
  const [turnoElegido, setTurnoElegido] = useState(null);
  const [mostrarConfigDuracion, setMostrarConfigDuracion] = useState(false);

  const nombreDia = NOMBRES_DIA_SEMANA[diaSemanaDeFecha(fecha)];
  const inicioSemana = inicioDeSemana(fecha);
  const finSemana = sumarDias(inicioSemana, 6);

  async function recargarTurnos() {
    const data =
      vista === "semana"
        ? await obtenerTurnosOrtodonciaPorRango(inicioSemana, finSemana)
        : await obtenerTurnosOrtodonciaPorFecha(fecha);
    setTurnos(data);
  }

  useEffect(() => {
    setCargando(true);
    const turnosPromise =
      vista === "semana"
        ? obtenerTurnosOrtodonciaPorRango(inicioSemana, finSemana)
        : obtenerTurnosOrtodonciaPorFecha(fecha);
    Promise.all([turnosPromise, obtenerProfesionales(), obtenerPacientesOrtodoncia(), obtenerDuracionesOrtodoncia()])
      .then(([t, prof, pac, dur]) => {
        setTurnos(t);
        setOrtodoncistas(prof.filter((p) => p.especialidad === "Ortodoncia"));
        setPacientes(pac);
        setDuraciones(dur);
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha, vista]);

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Agenda — Ortodoncia</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setVista((v) => (v === "dia" ? "semana" : "dia"))}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {vista === "dia" ? "📅 Ver semana" : "📆 Ver día"}
          </button>
          <button
            onClick={() => setMostrarConfigDuracion(true)}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            ⚙ Configurar duración
          </button>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={() => setFecha((f) => sumarDias(f, vista === "semana" ? -7 : -1))}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50"
        >
          {vista === "semana" ? "← Semana anterior" : "← Día anterior"}
        </button>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm"
        />
        <button
          onClick={() => setFecha((f) => sumarDias(f, vista === "semana" ? 7 : 1))}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50"
        >
          {vista === "semana" ? "Semana siguiente →" : "Día siguiente →"}
        </button>
        <button
          onClick={() => setFecha(fechaDeHoyISO())}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50"
        >
          Hoy
        </button>
        <span className="ml-2 text-sm capitalize text-gray-500">
          {vista === "semana" ? `Semana del ${inicioSemana} al ${finSemana}` : nombreDia}
        </span>
      </div>

      {error && (
        <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      {!error && !cargando && turnos.length === 0 && (
        <div className="mt-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
          {vista === "semana"
            ? "No hay turnos cargados para esta semana."
            : "No hay turnos cargados para este día. Hacé clic en un horario libre de la grilla para cargar el primero."}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        {leyenda.map((item) => (
          <span key={item.etiqueta} className="flex items-center gap-1.5 text-xs text-gray-600">
            <span className={`h-3 w-3 rounded-sm ${item.color}`} />
            {item.etiqueta}
          </span>
        ))}
      </div>

      <div className="mt-4">
        {cargando ? (
          <p className="text-sm text-gray-500">Cargando turnos...</p>
        ) : vista === "semana" ? (
          <AgendaSemanalGrid
            fechaInicio={inicioSemana}
            turnos={turnos}
            bloques={bloques}
            onTurnoClick={(turno) => setTurnoElegido(turno)}
          />
        ) : (
          <AgendaGrid
            turnos={turnos}
            bloques={bloques}
            consultorios={CONSULTORIOS_ORTO}
            minutosPorBloque={15}
            onSlotClick={(consultorio, hora) => setSlotElegido({ consultorio, hora })}
            onTurnoClick={(turno) => setTurnoElegido(turno)}
          />
        )}
      </div>

      {turnoElegido && (
        <TurnoOrtodonciaDetalleModal
          turno={turnoElegido}
          fecha={turnoElegido.fecha || fecha}
          onClose={() => setTurnoElegido(null)}
          onCambiado={recargarTurnos}
        />
      )}

      {slotElegido && (
        <NuevoTurnoOrtodonciaModal
          fecha={fecha}
          consultorioInicial={slotElegido.consultorio}
          horaInicial={slotElegido.hora}
          ortodoncistas={ortodoncistas}
          pacientes={pacientes}
          duraciones={duraciones}
          onClose={() => setSlotElegido(null)}
          onCreado={async () => {
            await recargarTurnos();
            const pacientesActualizados = await obtenerPacientesOrtodoncia();
            setPacientes(pacientesActualizados);
            setSlotElegido(null);
          }}
        />
      )}

      {mostrarConfigDuracion && (
        <ConfiguracionDuracionOrtodonciaModal
          duraciones={duraciones}
          onClose={() => setMostrarConfigDuracion(false)}
          onCambiado={async () => {
            const dur = await obtenerDuracionesOrtodoncia();
            setDuraciones(dur);
          }}
        />
      )}
    </main>
  );
}
