"use client";

import { useState } from "react";
import AgendaGrid from "@/components/AgendaGrid";
import { generarBloquesHorarios } from "@/lib/agenda";
import { turnosDeEjemplo } from "@/lib/mockTurnos";

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
  const [mensaje, setMensaje] = useState(null);
  const hoy = new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">Agenda — Odontología General</h1>
      <p className="mt-1 text-sm capitalize text-gray-500">{hoy}</p>

      <div className="mt-2 rounded-md bg-yellow-50 px-3 py-2 text-sm text-yellow-800 border border-yellow-200">
        Estos turnos son datos de prueba (todavía no está conectada la base de datos real).
      </div>

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
        <AgendaGrid
          turnos={turnosDeEjemplo}
          bloques={bloques}
          onSlotClick={(consultorio, bloque) =>
            setMensaje(`Hiciste clic en un horario libre: Consultorio ${consultorio} a las ${bloque}. (Acá, más adelante, se va a abrir el formulario para cargar un turno nuevo.)`)
          }
        />
      </div>
    </main>
  );
}
