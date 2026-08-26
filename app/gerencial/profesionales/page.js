"use client";

import { useEffect, useState } from "react";
import NuevoProfesionalModal from "@/components/NuevoProfesionalModal";
import SoloDuena from "@/components/SoloDuena";
import { NOMBRES_DIA_SEMANA } from "@/lib/agenda";
import { obtenerProfesionales } from "@/lib/data/profesionales";

function resumenDisponibilidad(profesional) {
  const bloques = (profesional.disponibilidad_profesional || []).filter((b) => b.activo);
  if (bloques.length === 0) return "Sin disponibilidad cargada";
  return bloques
    .sort((a, b) => a.dia_semana - b.dia_semana)
    .map((b) => `${NOMBRES_DIA_SEMANA[b.dia_semana]} ${b.hora_inicio.slice(0, 5)}-${b.hora_fin.slice(0, 5)}${b.consultorio ? ` (Cons. ${b.consultorio})` : ""}`)
    .join(" · ");
}

function ProfesionalesContenido() {
  const [profesionales, setProfesionales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [mostrarNuevo, setMostrarNuevo] = useState(false);

  async function recargar() {
    setCargando(true);
    try {
      const data = await obtenerProfesionales();
      setProfesionales(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    recargar();
  }, []);

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Profesionales</h1>
        <button
          onClick={() => setMostrarNuevo(true)}
          className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark"
        >
          + Nuevo profesional
        </button>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Personal que atiende en la clínica, su especialidad, honorarios y disponibilidad semanal.
      </p>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {cargando && <p className="text-sm text-gray-500">Cargando...</p>}
        {!cargando && profesionales.length === 0 && (
          <p className="text-sm text-gray-500">No hay profesionales cargados todavía.</p>
        )}
        {profesionales.map((p) => (
          <div key={p.id} className="rounded-lg border border-gray-200 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-heading font-semibold text-brand-brown">{p.nombre}</p>
              <p className="text-xs text-gray-400">
                Honorarios: {p.porcentaje_honorarios_copago}% copago · {p.porcentaje_honorarios_os}% obra social
              </p>
            </div>
            <p className="text-sm text-gray-600">{p.especialidad || "—"}</p>
            <p className="mt-1 text-xs text-gray-500">{resumenDisponibilidad(p)}</p>
            {p.observaciones && <p className="mt-1 text-xs text-gray-400">{p.observaciones}</p>}
          </div>
        ))}
      </div>

      {mostrarNuevo && (
        <NuevoProfesionalModal
          onClose={() => setMostrarNuevo(false)}
          onGuardado={async () => {
            await recargar();
            setMostrarNuevo(false);
          }}
        />
      )}
    </main>
  );
}

export default function ProfesionalesPage() {
  return (
    <SoloDuena>
      <ProfesionalesContenido />
    </SoloDuena>
  );
}
