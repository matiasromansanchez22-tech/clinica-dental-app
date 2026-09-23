"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  obtenerAvisosPendientesDeCobro,
  suscribirseACobrosDePrestacionesRealizadas,
  suscribirseAPrestacionesRealizadas,
} from "@/lib/data/prestacionesRealizadas";
import { reproducirSonidoAviso } from "@/lib/sonidoAviso";

// Aviso flotante que le aparece al secretario esté donde esté en la app —
// no solo parado en Caja — con lo que el profesional marcó como hecho en
// Agenda y todavía no se cobró. A propósito NO tiene botón para cerrarlo a
// mano: se supone que tiene que quedar a la vista hasta que se registre el
// cobro (ahí desaparece solo, tanto en este dispositivo como en cualquier
// otro que lo tenga abierto). Un click en "Cobrar" manda directo a Caja con
// el paciente y el profesional ya elegidos.
export default function AvisoPrestacionRealizada() {
  const { perfil } = useAuth();
  const [avisos, setAvisos] = useState([]);

  const puedeCobrar = perfil?.rol === "Secretaria" || perfil?.rol === "Duena";

  useEffect(() => {
    if (!puedeCobrar) return;
    let cancelado = false;

    function cargar({ sonido } = {}) {
      obtenerAvisosPendientesDeCobro()
        .then((nuevos) => {
          if (cancelado) return;
          setAvisos((actuales) => {
            if (sonido && nuevos.length > actuales.length) reproducirSonidoAviso();
            return nuevos;
          });
        })
        .catch(() => {});
    }

    cargar();
    const cortarNuevos = suscribirseAPrestacionesRealizadas(() => cargar({ sonido: true }));
    const cortarCobrados = suscribirseACobrosDePrestacionesRealizadas(() => cargar());

    return () => {
      cancelado = true;
      cortarNuevos();
      cortarCobrados();
    };
  }, [puedeCobrar]);

  if (!puedeCobrar || avisos.length === 0) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 p-4">
      {avisos.map((a) => (
        <div
          key={a.clave}
          className="flex w-full max-w-lg items-center justify-between gap-3 rounded-lg border-2 border-brand-brown bg-white p-4 shadow-2xl"
        >
          <div>
            <p className="font-heading text-base font-bold text-brand-brown">✅ {a.nombre} — listo para cobrar</p>
            <p className="mt-0.5 text-sm text-gray-700">{a.prestaciones.join(", ")}</p>
          </div>
          <a
            href={
              a.esOrtodoncia
                ? `/ortodoncia/caja?pacienteId=${a.pacienteId}&profesionalId=${a.profesionalId || ""}&abrir=1`
                : `/caja?pacienteId=${a.pacienteId}&profesionalId=${a.profesionalId || ""}&abrir=1`
            }
            className="shrink-0 rounded-md bg-brand-brown px-3 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark"
          >
            💰 Cobrar
          </a>
        </div>
      ))}
    </div>
  );
}
