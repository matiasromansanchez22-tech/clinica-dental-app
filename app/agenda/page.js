"use client";

import { useEffect, useState } from "react";
import AgendaGrid from "@/components/AgendaGrid";
import { generarBloquesHorarios } from "@/lib/agenda";
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

function fechaDeHoyISO() {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const dia = String(hoy.getDate()).padStart(2, "0");
  return `${hoy.getFullYear()}-${mes}-${dia}`;
}

export default function AgendaPage() {
  const [mensaje, setMensaje] = useState(null);
  const [turnos, setTurnos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const fechaISO = fechaDeHoyISO();

  const hoy = new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  useEffect(() => {
    if (!supabase) {
      setError("Falta configurar la conexión a Supabase (.env.local).");
      setCargando(false);
      return;
    }
    obtenerTurnosGeneralPorFecha(fechaISO)
      .then(setTurnos)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [fechaISO]);

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">Agenda — Odontología General</h1>
      <p className="mt-1 text-sm capitalize text-gray-500">{hoy}</p>

      {error && (
        <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          Ocurrió un problema al conectar con la base de datos: {error}
        </div>
      )}

      {!error && !cargando && turnos.length === 0 && (
        <div className="mt-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
          Todavía no hay turnos cargados para hoy en la base de datos real. La grilla está vacía porque es información real, no de prueba.
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

      {mensaje && (
        <div className="mt-4 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800 border border-blue-200">
          {mensaje}
        </div>
      )}

      <div className="mt-4">
        {cargando ? (
          <p className="text-sm text-gray-500">Cargando turnos...</p>
        ) : (
          <AgendaGrid
            turnos={turnos}
            bloques={bloques}
            onSlotClick={(consultorio, bloque) =>
              setMensaje(`Hiciste clic en un horario libre: Consultorio ${consultorio} a las ${bloque}. (Acá, más adelante, se va a abrir el formulario para cargar un turno nuevo.)`)
            }
          />
        )}
      </div>
    </main>
  );
}
