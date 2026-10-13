"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { fechaDeHoyISO } from "@/lib/agenda";
import { enviarAviso } from "@/lib/data/avisos";
import { marcarRecordatorioHecho, obtenerRecordatoriosParaAvisar, reclamarEnvioDePush } from "@/lib/data/recordatoriosAgenda";
import { reproducirSonidoAviso } from "@/lib/sonidoAviso";

const CADA_CUANTO_MS = 30 * 1000;
// Si la app se abre mucho después de la hora del aviso, se muestra igual en
// pantalla, pero ya no se manda el push (llegaría tarde y confunde).
const MINUTOS_PARA_PUSH = 30;

function minutosDesdeMedianoche(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function leerCerrados() {
  try {
    return new Set(JSON.parse(sessionStorage.getItem("recordatorios-cerrados") || "[]"));
  } catch {
    return new Set();
  }
}

// Aviso grande en pantalla (con sonido) cuando llega la hora de un recordatorio
// de la Agenda, para Dueñas y Secretarias. Además, la primera pantalla que lo
// ve manda un push a los celulares con avisos activados. Funciona mientras haya
// al menos una pantalla con la app abierta a esa hora.
export default function AvisoRecordatorios() {
  const { perfil } = useAuth();
  const habilitado = perfil?.rol === "Duena" || perfil?.rol === "Secretaria";
  const [avisos, setAvisos] = useState([]);
  const yaSonaron = useRef(new Set());

  useEffect(() => {
    if (!habilitado) return;
    let activo = true;

    async function revisar() {
      try {
        const ahora = new Date();
        const hoy = fechaDeHoyISO();
        const hhmm = ahora.toTimeString().slice(0, 5);
        const cerrados = leerCerrados();
        const vencidos = (await obtenerRecordatoriosParaAvisar(hoy, hhmm)).filter((r) => !cerrados.has(r.id));
        if (!activo) return;
        setAvisos(vencidos);

        const hayNuevo = vencidos.some((r) => !yaSonaron.current.has(r.id));
        if (hayNuevo) reproducirSonidoAviso();
        for (const r of vencidos) yaSonaron.current.add(r.id);

        const minutosAhora = minutosDesdeMedianoche(hhmm);
        for (const r of vencidos) {
          if (r.avisoEnviado || minutosAhora - minutosDesdeMedianoche(r.horaAviso) > MINUTOS_PARA_PUSH) continue;
          if (await reclamarEnvioDePush(r.id)) {
            enviarAviso({
              titulo: "📌 Recordatorio",
              mensaje: r.texto,
              url: r.agenda === "Ortodoncia" ? "/ortodoncia/agenda" : "/agenda",
              roles: ["Duena", "Secretaria"],
            }).catch(() => {});
          }
        }
      } catch {
        // sin conexión o sin permiso: simplemente no se muestra
      }
    }

    revisar();
    const intervalo = setInterval(revisar, CADA_CUANTO_MS);
    return () => {
      activo = false;
      clearInterval(intervalo);
    };
  }, [habilitado]);

  if (!habilitado || avisos.length === 0) return null;

  function cerrar(id) {
    try {
      const cerrados = leerCerrados();
      cerrados.add(id);
      sessionStorage.setItem("recordatorios-cerrados", JSON.stringify([...cerrados]));
    } catch {
      // si no se puede guardar, igual se oculta en esta pantalla
    }
    setAvisos((actual) => actual.filter((a) => a.id !== id));
  }

  async function listo(id) {
    try {
      await marcarRecordatorioHecho(id, true);
    } catch {
      // si falla, al menos se cierra el aviso
    }
    setAvisos((actual) => actual.filter((a) => a.id !== id));
  }

  return (
    <div className="fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 p-4">
      {avisos.map((r) => (
        <div key={r.id} className="flex w-full max-w-lg items-center justify-between gap-3 rounded-lg border-2 border-amber-500 bg-white p-4 shadow-2xl">
          <div className="min-w-0">
            <p className="font-heading text-base font-bold text-amber-800">📌 Recordatorio · {r.horaAviso}</p>
            <p className="mt-0.5 break-words text-sm text-gray-800">{r.texto}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={() => listo(r.id)} className="rounded-md bg-brand-brown px-3 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark">
              Listo ✓
            </button>
            <button onClick={() => cerrar(r.id)} aria-label="Cerrar aviso" title="Cerrar (sigue pendiente en la Agenda)" className="text-gray-400 hover:text-gray-600">
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
