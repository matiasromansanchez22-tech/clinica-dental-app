"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { suscribirseAPrestacionesRealizadas } from "@/lib/data/prestacionesRealizadas";
import { obtenerPacientePorId } from "@/lib/data/pacientes";
import { obtenerPacienteOrtodonciaPorId } from "@/lib/data/pacientesOrtodoncia";
import { reproducirSonidoAviso } from "@/lib/sonidoAviso";

// Aviso flotante (con sonido) que le aparece al secretario esté donde esté
// en la app — no solo parado en Caja — apenas el profesional marca algo
// como hecho en Agenda. Un click lo manda directo a Caja con ese paciente
// ya elegido (y todo pre-cargado, gracias a "pacienteIdInicial"). Mismo
// patrón que AvisoPresupuestoNuevo.
export default function AvisoPrestacionRealizada() {
  const { perfil } = useAuth();
  const [avisos, setAvisos] = useState([]);

  const puedeCobrar = perfil?.rol === "Secretaria" || perfil?.rol === "Duena";

  useEffect(() => {
    if (!puedeCobrar) return;
    const cortar = suscribirseAPrestacionesRealizadas((payload) => {
      const fila = payload.new;
      const esOrtodoncia = Boolean(fila.paciente_ortodoncia_id);
      const pacienteId = esOrtodoncia ? fila.paciente_ortodoncia_id : fila.paciente_id;
      if (!pacienteId) return;
      const clave = `${esOrtodoncia ? "orto" : "general"}-${pacienteId}`;

      const buscarNombre = esOrtodoncia ? obtenerPacienteOrtodonciaPorId(pacienteId) : obtenerPacientePorId(pacienteId);
      buscarNombre
        .then((paciente) => {
          const nombre = esOrtodoncia ? paciente.nombre : paciente.apellidoYNombre;
          setAvisos((actual) => {
            // Si ya hay un aviso de este paciente sin cerrar, no se apila
            // otro — se suma la prestación nueva a la lista de lo marcado.
            const existente = actual.find((a) => a.clave === clave);
            if (existente) {
              return actual.map((a) =>
                a.clave === clave ? { ...a, prestaciones: [...a.prestaciones, fila.prestacion] } : a
              );
            }
            return [...actual, { clave, pacienteId, nombre, esOrtodoncia, prestaciones: [fila.prestacion] }];
          });
          reproducirSonidoAviso();
        })
        .catch(() => {});
    });
    return cortar;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puedeCobrar]);

  if (!puedeCobrar || avisos.length === 0) return null;

  function cerrar(clave) {
    setAvisos((actual) => actual.filter((a) => a.clave !== clave));
  }

  return (
    <div className="fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 p-4">
      {avisos.map((a) => (
        <div
          key={a.clave}
          className="flex w-full max-w-lg items-center justify-between gap-3 rounded-lg border-2 border-brand-brown bg-white p-4 shadow-2xl"
        >
          <div>
            <p className="font-heading text-base font-bold text-brand-brown">
              ✅ {a.nombre} — listo para cobrar
            </p>
            <p className="mt-0.5 text-sm text-gray-700">{a.prestaciones.join(", ")}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={
                a.esOrtodoncia
                  ? `/ortodoncia/caja?pacienteId=${a.pacienteId}&abrir=1`
                  : `/caja?pacienteId=${a.pacienteId}&abrir=1`
              }
              onClick={() => cerrar(a.clave)}
              className="rounded-md bg-brand-brown px-3 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark"
            >
              💰 Cobrar
            </a>
            <button onClick={() => cerrar(a.clave)} aria-label="Cerrar aviso" className="text-gray-400 hover:text-gray-600">
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
