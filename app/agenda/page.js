"use client";

import { useEffect, useState } from "react";
import AgendaGrid from "@/components/AgendaGrid";
import NuevoTurnoModal from "@/components/NuevoTurnoModal";
import TurnoDetalleModal from "@/components/TurnoDetalleModal";
import {
  diaSemanaDeFecha,
  fechaDeHoyISO,
  generarBloquesHorarios,
  NOMBRES_DIA_SEMANA,
  seMuestraEnGrilla,
  sumarDias,
} from "@/lib/agenda";
import { obtenerPacientesActivos } from "@/lib/data/pacientes";
import { obtenerProfesionales } from "@/lib/data/profesionales";
import { obtenerTurnosGeneralPorFecha } from "@/lib/data/turnosGeneral";
import { supabase } from "@/lib/supabaseClient";

const bloques = generarBloquesHorarios("08:00", "20:00", 30);

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

export default function AgendaPage() {
  const [fecha, setFecha] = useState(fechaDeHoyISO());
  const [turnos, setTurnos] = useState([]);
  const [profesionales, setProfesionales] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [slotElegido, setSlotElegido] = useState(null); // { consultorio, hora }
  const [turnoElegido, setTurnoElegido] = useState(null);

  const nombreDia = NOMBRES_DIA_SEMANA[diaSemanaDeFecha(fecha)];

  async function recargarTurnos() {
    const data = await obtenerTurnosGeneralPorFecha(fecha);
    setTurnos(data);
  }

  useEffect(() => {
    if (!supabase) {
      setError("Falta configurar la conexión a Supabase (.env.local).");
      setCargando(false);
      return;
    }
    setCargando(true);
    Promise.all([obtenerTurnosGeneralPorFecha(fecha), obtenerProfesionales(), obtenerPacientesActivos()])
      .then(([turnosData, profesionalesData, pacientesData]) => {
        setTurnos(turnosData);
        setProfesionales(profesionalesData);
        setPacientes(pacientesData);
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [fecha]);

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">Agenda — Odontología General</h1>

      <div className="mt-2 flex items-center gap-2">
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
        <span className="ml-2 text-sm text-gray-500">{nombreDia}</span>
      </div>

      {error && (
        <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          Ocurrió un problema al conectar con la base de datos: {error}
        </div>
      )}

      {!error && !cargando && turnos.length === 0 && (
        <div className="mt-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
          No hay turnos cargados para este día. Hacé clic en un horario libre de la grilla para cargar el primero.
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
        ) : (
          <AgendaGrid
            turnos={turnos}
            bloques={bloques}
            onSlotClick={(consultorio, hora) => setSlotElegido({ consultorio, hora })}
            onTurnoClick={(turno) => setTurnoElegido(turno)}
          />
        )}
      </div>

      {turnoElegido && (
        <TurnoDetalleModal
          turno={turnoElegido}
          fecha={fecha}
          onClose={() => setTurnoElegido(null)}
          onCambiado={recargarTurnos}
        />
      )}

      {slotElegido && (
        <NuevoTurnoModal
          fecha={fecha}
          consultorioInicial={slotElegido.consultorio}
          horaInicial={slotElegido.hora}
          profesionales={profesionales}
          pacientes={pacientes}
          turnosVisibles={turnos.filter(seMuestraEnGrilla)}
          onClose={() => setSlotElegido(null)}
          onCreado={async () => {
            await recargarTurnos();
            const pacientesActualizados = await obtenerPacientesActivos();
            setPacientes(pacientesActualizados);
            setSlotElegido(null);
          }}
        />
      )}
    </main>
  );
}
