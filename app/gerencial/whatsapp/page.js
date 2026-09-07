"use client";

import { useState } from "react";
import SoloDuena from "@/components/SoloDuena";

const CONVERSACIONES_EJEMPLO = [
  {
    id: 1,
    nombre: "Julieta Fernández",
    iniciales: "JF",
    hora: "10:24",
    noLeidos: 0,
    mensajes: [
      { yo: false, texto: "Hola, buenas! Quería confirmar mi turno de mañana", hora: "10:10" },
      { yo: true, texto: "Hola Julieta! Sí, mañana miércoles 10/9 a las 15:00 con la Dra. Irigoiti 🦷", hora: "10:15" },
      { yo: false, texto: "Perfecto, ahí voy!", hora: "10:24" },
    ],
  },
  {
    id: 2,
    nombre: "Marcos Giménez",
    iniciales: "MG",
    hora: "09:02",
    noLeidos: 2,
    mensajes: [
      {
        yo: true,
        texto: "Hola Marcos! Te recordamos tu turno de hoy a las 11:00 en Clínica Dental Marianela Ramírez",
        hora: "08:00",
      },
      { yo: false, texto: "Hola, buen día", hora: "09:00" },
      { yo: false, texto: "¿Se puede pasar para la tarde?", hora: "09:02" },
    ],
  },
  {
    id: 3,
    nombre: "Rocío Álvarez",
    iniciales: "RA",
    hora: "Ayer",
    noLeidos: 0,
    mensajes: [
      { yo: true, texto: "Hola Rocío! Te recordamos tu turno mañana jueves a las 16:30", hora: "Ayer · 18:00" },
      { yo: false, texto: "Gracias, nos vemos!", hora: "Ayer · 18:05" },
    ],
  },
  {
    id: 4,
    nombre: "Pedro Sánchez",
    iniciales: "PS",
    hora: "Lunes",
    noLeidos: 0,
    mensajes: [
      { yo: false, texto: "Hola! Necesito reprogramar el turno del jueves", hora: "Lunes · 11:20" },
      { yo: true, texto: "Hola Pedro! Sin problema, ¿qué día y horario te queda mejor?", hora: "Lunes · 11:30" },
      { yo: false, texto: "El viernes a la tarde estaría bien", hora: "Lunes · 11:45" },
      { yo: true, texto: "Perfecto, te dejo el viernes 12/9 a las 17:00", hora: "Lunes · 11:50" },
      { yo: false, texto: "Dale, muchas gracias", hora: "Lunes · 11:52" },
    ],
  },
];

function Avatar({ iniciales }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-tan/50 text-sm font-semibold text-brand-brown">
      {iniciales}
    </div>
  );
}

function WhatsAppPreviewContenido() {
  const [activaId, setActivaId] = useState(CONVERSACIONES_EJEMPLO[0].id);
  const activa = CONVERSACIONES_EJEMPLO.find((c) => c.id === activaId);

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">💬 Bandeja de WhatsApp</h1>
      <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        🧪 <strong>Vista previa</strong> — esto es solo para mostrar cómo se vería. Las conversaciones de acá son de
        ejemplo, todavía no está conectado a WhatsApp de verdad.
      </div>

      <div className="mt-4 flex h-[600px] overflow-hidden rounded-lg border border-gray-200">
        <div className="w-72 shrink-0 overflow-y-auto border-r border-gray-200 bg-gray-50">
          {CONVERSACIONES_EJEMPLO.map((c) => {
            const ultimo = c.mensajes[c.mensajes.length - 1];
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setActivaId(c.id)}
                className={`flex w-full items-center gap-2.5 border-b border-gray-100 px-3 py-3 text-left hover:bg-brand-tan/20 ${
                  activaId === c.id ? "bg-brand-tan/30" : ""
                }`}
              >
                <Avatar iniciales={c.iniciales} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-gray-900">{c.nombre}</span>
                    <span className="shrink-0 text-[11px] text-gray-400">{c.hora}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-gray-500">{ultimo.texto}</span>
                    {c.noLeidos > 0 && (
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-semibold text-white">
                        {c.noLeidos}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex flex-1 flex-col bg-[#e9edef]">
          <div className="flex items-center gap-2.5 border-b border-gray-200 bg-white px-4 py-2.5">
            <Avatar iniciales={activa.iniciales} />
            <span className="text-sm font-semibold text-gray-900">{activa.nombre}</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex flex-col gap-2">
              {activa.mensajes.map((m, i) => (
                <div key={i} className={`flex ${m.yo ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[70%] rounded-lg px-3 py-1.5 text-sm shadow-sm ${
                      m.yo ? "bg-[#d9fdd3] text-gray-900" : "bg-white text-gray-900"
                    }`}
                  >
                    <p>{m.texto}</p>
                    <p className="mt-0.5 text-right text-[10px] text-gray-400">{m.hora}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 border-t border-gray-200 bg-white px-3 py-2.5">
            <input
              disabled
              placeholder="Esto se activa cuando conectemos WhatsApp de verdad..."
              className="flex-1 rounded-full border border-gray-200 bg-gray-100 px-4 py-2 text-sm text-gray-400"
            />
            <button
              disabled
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-200 text-gray-400"
            >
              ➤
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function WhatsAppPreviewPage() {
  return (
    <SoloDuena>
      <WhatsAppPreviewContenido />
    </SoloDuena>
  );
}
