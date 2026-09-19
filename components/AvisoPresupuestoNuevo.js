"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { obtenerPresupuestoPorId, suscribirseANuevosPresupuestos } from "@/lib/data/presupuestos";
import { reproducirSonidoAviso } from "@/lib/sonidoAviso";

// Aviso grande en pantalla (con sonido) cuando se carga un presupuesto
// nuevo — para las Secretarias, además del push que puede llegar con la
// app cerrada. Se apoya en Supabase Realtime: mientras tenga la app
// abierta en cualquier pantalla, le aparece esto sin que tenga que andar
// revisando Presupuestos a cada rato.
export default function AvisoPresupuestoNuevo() {
  const { perfil } = useAuth();
  const [avisos, setAvisos] = useState([]);

  const esSecretaria = perfil?.rol === "Secretaria";

  useEffect(() => {
    if (!esSecretaria) return;
    const cortar = suscribirseANuevosPresupuestos((payload) => {
      obtenerPresupuestoPorId(payload.new.id)
        .then((presupuesto) => {
          setAvisos((actual) => [...actual, presupuesto]);
          reproducirSonidoAviso();
        })
        .catch(() => {});
    });
    return cortar;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esSecretaria]);

  if (!esSecretaria || avisos.length === 0) return null;

  function cerrar(id) {
    setAvisos((actual) => actual.filter((a) => a.id !== id));
  }

  return (
    <div className="fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 p-4">
      {avisos.map((p) => (
        <div
          key={p.id}
          className="flex w-full max-w-lg items-center justify-between gap-3 rounded-lg border-2 border-brand-brown bg-white p-4 shadow-2xl"
        >
          <div>
            <p className="font-heading text-base font-bold text-brand-brown">📋 Nuevo presupuesto para imprimir</p>
            <p className="mt-0.5 text-sm text-gray-700">
              {p.paciente} — {p.profesional} — ${Number(p.total).toLocaleString("es-AR")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={`/presupuestos/${p.id}/imprimir`}
              target="_blank"
              onClick={() => cerrar(p.id)}
              className="rounded-md bg-brand-brown px-3 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark"
            >
              Imprimir
            </a>
            <button
              onClick={() => cerrar(p.id)}
              aria-label="Cerrar aviso"
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
