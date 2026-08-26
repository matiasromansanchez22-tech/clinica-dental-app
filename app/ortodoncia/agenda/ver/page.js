"use client";

import { useEffect, useState } from "react";
import AgendaGrid from "@/components/AgendaGrid";
import TurnoOrtodonciaSoloLecturaModal from "@/components/TurnoOrtodonciaSoloLecturaModal";
import { diaSemanaDeFecha, fechaDeHoyISO, generarBloquesHorarios, NOMBRES_DIA_SEMANA, sumarDias } from "@/lib/agenda";
import { obtenerTurnosOrtodonciaPorFecha } from "@/lib/data/turnosOrtodoncia";

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

export default function VerAgendaOrtodonciaPage() {
  const [fecha, setFecha] = useState(fechaDeHoyISO());
  const [turnos, setTurnos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [turnoElegido, setTurnoElegido] = useState(null);

  const nombreDia = NOMBRES_DIA_SEMANA[diaSemanaDeFecha(fecha)];

  useEffect(() => {
    setCargando(true);
    obtenerTurnosOrtodonciaPorFecha(fecha)
      .then(setTurnos)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [fecha]);

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">Ver Agenda del Día — Ortodoncia (solo lectura)</h1>
      <p className="mt-1 text-sm text-gray-500">
        Mirá cualquier día sin interferir con lo que esté cargando la secretaria en la pantalla principal.
      </p>

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={() => setFecha((f) => sumarDias(f, -1))}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50"
        >
          ← Día anterior
        </button>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm"
        />
        <button
          onClick={() => setFecha((f) => sumarDias(f, 1))}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50"
        >
          Día siguiente →
        </button>
        <button
          onClick={() => setFecha(fechaDeHoyISO())}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50"
        >
          Hoy
        </button>
        <span className="ml-2 text-sm capitalize text-gray-500">{nombreDia}</span>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
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
        ) : (
          <AgendaGrid
            turnos={turnos}
            bloques={bloques}
            consultorios={CONSULTORIOS_ORTO}
            minutosPorBloque={15}
            onTurnoClick={setTurnoElegido}
          />
        )}
      </div>

      {turnoElegido && (
        <TurnoOrtodonciaSoloLecturaModal turno={turnoElegido} fecha={fecha} onClose={() => setTurnoElegido(null)} />
      )}
    </main>
  );
}
