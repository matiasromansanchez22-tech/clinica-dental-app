"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { fechaDeHoyISO } from "@/lib/agenda";
import {
  marcarPromesaDePago,
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
  const [pidiendoFechaPara, setPidiendoFechaPara] = useState(null);
  const [fechaPromesa, setFechaPromesa] = useState(fechaDeHoyISO());
  const [guardandoPromesa, setGuardandoPromesa] = useState(false);

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

  function abrirPedidoDeFecha(clave) {
    setPidiendoFechaPara(clave);
    setFechaPromesa(fechaDeHoyISO());
  }

  async function confirmarPromesa(aviso) {
    setGuardandoPromesa(true);
    try {
      await marcarPromesaDePago({
        pacienteId: aviso.pacienteId,
        esOrtodoncia: aviso.esOrtodoncia,
        fechaPromesa,
      });
      // El propio guardado ya lo saca de obtenerAvisosPendientesDeCobro,
      // pero lo sacamos también acá al toque para no esperar la próxima
      // recarga (en vivo o al entrar a otra pantalla).
      setAvisos((actuales) => actuales.filter((a) => a.clave !== aviso.clave));
      setPidiendoFechaPara(null);
    } catch {
      // Si falla, se queda la tarjeta como estaba — no hace falta más.
    } finally {
      setGuardandoPromesa(false);
    }
  }

  if (!puedeCobrar || avisos.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[100] flex w-72 flex-col items-stretch gap-2">
      {avisos.map((a) => (
        <div
          key={a.clave}
          className="flex flex-col gap-2 rounded-lg border-2 border-brand-brown bg-white p-3 shadow-2xl"
        >
          <div>
            <p className="font-heading text-sm font-bold text-brand-brown">✅ {a.nombre} — listo para cobrar</p>
            <p className="mt-0.5 text-xs text-gray-700">{a.prestaciones.join(", ")}</p>
          </div>

          {pidiendoFechaPara === a.clave ? (
            <div className="flex flex-col gap-1.5 rounded-md border border-gray-200 bg-gray-50 p-2">
              <label className="flex flex-col gap-1 text-xs text-gray-600">
                ¿Qué día va a pagar?
                <input
                  type="date"
                  value={fechaPromesa}
                  onChange={(e) => setFechaPromesa(e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                />
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => confirmarPromesa(a)}
                  disabled={guardandoPromesa}
                  className="flex-1 rounded-md bg-brand-brown px-2 py-1 text-xs font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
                >
                  {guardandoPromesa ? "..." : "Confirmar"}
                </button>
                <button
                  type="button"
                  onClick={() => setPidiendoFechaPara(null)}
                  disabled={guardandoPromesa}
                  className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-white"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <a
                href={
                  a.esOrtodoncia
                    ? `/ortodoncia/caja?pacienteId=${a.pacienteId}&profesionalId=${a.profesionalId || ""}&abrir=1`
                    : `/caja?pacienteId=${a.pacienteId}&profesionalId=${a.profesionalId || ""}&abrir=1`
                }
                className="flex-1 rounded-md bg-brand-brown px-3 py-1.5 text-center text-sm font-medium text-white hover:bg-brand-brown-dark"
              >
                💰 Cobrar
              </a>
              <button
                type="button"
                onClick={() => abrirPedidoDeFecha(a.clave)}
                title="El paciente va a pagar otro día"
                className="rounded-md border border-brand-brown/40 px-2 py-1.5 text-xs font-medium text-brand-brown hover:bg-brand-tan/30"
              >
                📅 Después
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
