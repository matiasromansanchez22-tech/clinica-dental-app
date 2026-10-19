"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  obtenerVisitasPorCompletarOrtodoncia,
  suscribirseAPrestacionesRealizadas,
} from "@/lib/data/prestacionesRealizadas";
import { reproducirSonidoAviso } from "@/lib/sonidoAviso";

const EVENTO = "visitas-por-completar-cambiaron";

// Se llama después de completar una visita, para que el aviso (y el contador del menú) se
// actualicen al toque sin recargar.
export function avisarVisitasPorCompletarCambiaron() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENTO));
}

// Aviso flotante para el ortodoncista: la secretaria cobró a un paciente suyo antes de que
// marcara qué hizo. Queda a la vista hasta que complete qué sigue (o el alta) y si se despegó
// algún bracket. Cada ortodoncista ve solo lo suyo.
export default function AvisoVisitasPorCompletar() {
  const { perfil } = useAuth();
  const [visitas, setVisitas] = useState([]);

  const profesionalId = perfil?.rol === "Odontologo" ? perfil.profesional_id : null;

  useEffect(() => {
    if (!profesionalId) return;
    let cancelado = false;

    function cargar({ sonido } = {}) {
      obtenerVisitasPorCompletarOrtodoncia(profesionalId).then((nuevas) => {
        if (cancelado) return;
        setVisitas((actuales) => {
          if (sonido && nuevas.length > actuales.length) reproducirSonidoAviso();
          return nuevas;
        });
      });
    }

    cargar();
    const cortarNuevos = suscribirseAPrestacionesRealizadas(() => cargar({ sonido: true }));
    const alCambiar = () => cargar();
    window.addEventListener(EVENTO, alCambiar);
    return () => {
      cancelado = true;
      cortarNuevos();
      window.removeEventListener(EVENTO, alCambiar);
    };
  }, [profesionalId]);

  if (!profesionalId || visitas.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[100] flex w-72 flex-col items-stretch gap-2">
      {visitas.slice(0, 3).map((v) => (
        <div key={v.id} className="flex flex-col gap-2 rounded-lg border-2 border-amber-500 bg-white p-3 shadow-2xl">
          <div>
            <p className="font-heading text-sm font-bold text-amber-800">💰 {v.paciente} — ya lo cobraron</p>
            <p className="mt-0.5 text-xs text-gray-700">
              Falta que completes qué hacer la próxima vez y si se despegó algún bracket.
            </p>
          </div>
          <a
            href="/pendientes-de-registro"
            className="rounded-md bg-brand-brown px-3 py-1.5 text-center text-sm font-medium text-white hover:bg-brand-brown-dark"
          >
            Completar
          </a>
        </div>
      ))}
      {visitas.length > 3 && (
        <p className="rounded-md bg-white px-2 py-1 text-center text-xs text-gray-600 shadow">
          y {visitas.length - 3} más en Pendientes de registro
        </p>
      )}
    </div>
  );
}
