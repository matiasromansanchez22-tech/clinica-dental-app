"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import { horaYFechaEnArgentina } from "@/lib/pendientesPorProfesional";
import { calcularResumenJornada, esDestinatarioDelResumen, JORNADAS } from "@/lib/resumenJornada";

// Cartel de cierre de jornada: desde las 12:30 (mañana) y desde las 18:30 (tarde) avisa cuántos pacientes quedaron sin cargar
// "qué se hizo" y "qué sigue", y no se va hasta que se completen. Es solo para Matías: ve los de todos los profesionales.
const DESDE = { manana: "12:30", tarde: "18:30" };
const REVISAR_CADA_MS = 5 * 60 * 1000;

// Qué jornada "está cerrando" según la hora: de 12:30 a 18:29, la mañana; desde las 18:30, la tarde. Antes de las 12:30, nada.
function jornadaQueCierra(ahora) {
  if (ahora >= DESDE.tarde) return "tarde";
  if (ahora >= DESDE.manana) return "manana";
  return null;
}

export default function AvisoCierreJornada() {
  const { perfil } = useAuth();
  const pathname = usePathname();
  const habilitado = esDestinatarioDelResumen(perfil);
  const [datos, setDatos] = useState(null);

  const revisar = useCallback(async () => {
    const { hoy, ahora } = horaYFechaEnArgentina();
    const jornada = jornadaQueCierra(ahora);
    if (!jornada) return setDatos(null);
    try {
      const r = await calcularResumenJornada(supabase, { fecha: hoy, jornada, hoy, ahora });
      setDatos({ jornada, pendientes: r.total.pacientesPendientes, vinieron: r.total.vinieron });
    } catch {
      setDatos(null);
    }
  }, []);

  useEffect(() => {
    if (!habilitado) return;
    revisar();
    const t = setInterval(revisar, REVISAR_CADA_MS);
    return () => clearInterval(t);
  }, [habilitado, revisar, pathname]);

  if (!habilitado || !datos || datos.pendientes === 0 || pathname === "/resumen-jornada") return null;

  return (
    <div className="fixed bottom-4 left-4 z-[105] w-96 max-w-[calc(100vw-2rem)] rounded-xl border-2 border-red-500 bg-white p-4 shadow-2xl" role="alert">
      <p className="font-heading text-base font-bold text-red-800">
        📋 {JORNADAS[datos.jornada].titulo}: {datos.pendientes} paciente{datos.pendientes === 1 ? "" : "s"} sin cargar
      </p>
      <p className="mt-1 text-sm text-gray-800">
        Vinieron {datos.vinieron}. Falta marcar <strong>qué se hizo</strong> y <strong>qué sigue</strong>.
      </p>
      <Link href="/resumen-jornada" className="mt-3 block rounded-md bg-red-700 px-3 py-2 text-center text-sm font-bold text-white hover:bg-red-800">
        Ver quiénes faltan →
      </Link>
    </div>
  );
}
