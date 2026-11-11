"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ActivarAvisosBoton from "@/components/ActivarAvisosBoton";
import { useAuth } from "@/lib/auth/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import { calcularCumplimientoRegistro, horaYFechaEnArgentina, sumarDiasISO, textoFechaCorta } from "@/lib/pendientesPorProfesional";

const DIAS = 30;

// Cartel de la pantalla de inicio sobre los pacientes que vinieron y todavía no tienen cargado "qué se hizo" en la Agenda.
//  · Odontólogo: cartel rojo con SUS pacientes pendientes y un botón para cargarlos (más el botón de activar avisos, para que el
//    recordatorio diario le llegue al celular).
//  · Dueña: una línea con el total y quién debe más, que lleva a Pendientes de registro.
export default function AvisoTurnosSinCargar() {
  const { perfil } = useAuth();
  const [datos, setDatos] = useState(null);
  const rol = perfil?.rol;
  const profesionalId = perfil?.profesional_id || null;

  useEffect(() => {
    if (rol !== "Duena" && !(rol === "Odontologo" && profesionalId)) return;
    const { hoy, ahora } = horaYFechaEnArgentina();
    calcularCumplimientoRegistro(supabase, { desde: sumarDiasISO(hoy, -DIAS), hasta: hoy, hoy, ahora })
      .then(setDatos)
      .catch(() => {});
  }, [rol, profesionalId]);

  if (!datos) return null;

  if (rol === "Odontologo") {
    const mios = datos.pendientes.filter((p) => p.profesionalId === profesionalId);
    if (mios.length === 0) {
      return (
        <div className="mt-6 flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          <span>✅ Tenés todos tus pacientes cargados. ¡Gracias!</span>
          <ActivarAvisosBoton />
        </div>
      );
    }
    return (
      <div className="mt-6 w-full rounded-xl border-2 border-red-400 bg-red-50 p-4 text-left shadow-sm">
        <p className="font-heading text-base font-bold text-red-800">
          📝 Tenés {mios.length} paciente{mios.length === 1 ? "" : "s"} sin cargar
        </p>
        <p className="mt-1 text-sm text-red-900">
          Falta marcar <strong>qué se hizo</strong> y <strong>qué sigue</strong>. Sin eso no se puede cobrar ni liquidar bien. El más viejo es del{" "}
          {textoFechaCorta(mios[0].fecha)} ({mios[0].paciente}).
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Link href="/pendientes-de-registro" className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800">
            Cargarlos ahora →
          </Link>
          <ActivarAvisosBoton />
          <span className="text-xs text-red-800">Activá los avisos y te lo recordamos cada mañana en el celular.</span>
        </div>
      </div>
    );
  }

  // Dueña
  if (datos.sinCargar === 0) return null;
  const peor = datos.porProfesional.filter((p) => p.sinCargar > 0).sort((a, b) => b.sinCargar - a.sinCargar)[0];
  return (
    <Link
      href="/pendientes-de-registro"
      className="mt-3 block rounded-md border border-red-300 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-800 hover:bg-red-100"
    >
      📝 {datos.sinCargar} paciente{datos.sinCargar === 1 ? "" : "s"} sin cargar en los últimos {DIAS} días
      {peor ? ` — la que más debe: ${peor.nombre} (${peor.sinCargar})` : ""}. Ver quién →
    </Link>
  );
}
