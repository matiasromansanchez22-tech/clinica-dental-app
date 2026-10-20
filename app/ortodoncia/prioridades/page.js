"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { SITUACION_VUELTA, obtenerPrioridadesOrtodoncia } from "@/lib/data/prioridadesOrtodoncia";

function formatoFecha(fechaISO) {
  if (!fechaISO) return "—";
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}

const ESTILO_VUELTA = {
  [SITUACION_VUELTA.POR_VENIR]: "bg-sky-100 text-sky-800",
  [SITUACION_VUELTA.YA_TIENE_TURNO]: "bg-emerald-100 text-emerald-800",
  [SITUACION_VUELTA.FALTA_TURNO]: "bg-red-100 text-red-800",
  [SITUACION_VUELTA.A_REVISAR]: "bg-amber-100 text-amber-800",
};

function PaginaPrioridades() {
  const { perfil } = useAuth();
  // Cada ortodoncista ve solo sus pacientes; las dueñas y las secretarias ven todo.
  const propioId = perfil?.rol === "Odontologo" ? perfil.profesional_id : null;
  const [prioridades, setPrioridades] = useState([]);
  const [disponible, setDisponible] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [soloPorVolver, setSoloPorVolver] = useState(false);

  useEffect(() => {
    obtenerPrioridadesOrtodoncia(propioId)
      .then((r) => {
        setPrioridades(r.prioridades);
        setDisponible(r.disponible);
      })
      .finally(() => setCargando(false));
  }, [propioId]);

  const visibles = useMemo(() => prioridades.filter((p) => !soloPorVolver || p.porVolver), [prioridades, soloPorVolver]);
  const porVolver = prioridades.filter((p) => p.porVolver).length;

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">⭐ Prioridades — pacientes atendidos por otra ortodoncista</h1>
      <p className="mt-0.5 text-sm text-gray-500">
        Pacientes que se atendieron con otra ortodoncista porque la suya no tenía disponibilidad. Su ficha no cambia: acá se ve a quién hay que
        devolverle a su ortodoncista y darle el próximo turno con ella.
      </p>

      {!disponible && (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Falta activar las prioridades (migración 160).
        </div>
      )}

      {cargando ? (
        <p className="mt-6 text-sm text-gray-500">Cargando...</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="rounded-md bg-red-50 px-3 py-1.5 text-sm font-medium text-red-800">
              Falta darles turno con su ortodoncista: {porVolver}
            </span>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={soloPorVolver} onChange={(e) => setSoloPorVolver(e.target.checked)} />
              Ver solo los que faltan
            </label>
          </div>

          {visibles.length === 0 ? (
            <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              ✅ {prioridades.length === 0 ? "Todavía no hay turnos de prioridad." : "No hay pacientes pendientes de volver con su ortodoncista."}
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr className="bg-brand-brown text-white">
                    <th className="px-3 py-2 text-left font-semibold">Paciente</th>
                    <th className="px-3 py-2 text-left font-semibold">Es de</th>
                    <th className="px-3 py-2 text-left font-semibold">Lo atendió</th>
                    <th className="px-3 py-2 text-left font-semibold">Turno de prioridad</th>
                    <th className="px-3 py-2 text-left font-semibold">Motivo</th>
                    <th className="px-3 py-2 text-left font-semibold">Vuelta con su ortodoncista</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((p) => (
                    <tr key={p.id} className="border-t border-gray-100 align-top">
                      <td className="px-3 py-2 font-medium text-gray-900">{p.paciente}</td>
                      <td className="px-3 py-2 text-gray-700">{p.habitual}</td>
                      <td className="px-3 py-2 text-gray-700">{p.atendidoPor}</td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-gray-700">
                        {formatoFecha(p.fecha)} {p.hora}
                        <span className="block text-xs text-gray-500">{p.situacionTurno}</span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">{p.motivo || "—"}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${ESTILO_VUELTA[p.vuelta]}`}>{p.vuelta}</span>
                        {p.proximoConHabitual && (
                          <span className="mt-0.5 block text-xs text-gray-600">Próximo turno: {formatoFecha(p.proximoConHabitual)}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </main>
  );
}

export default function PrioridadesOrtodonciaPage() {
  const { perfil, cargando } = useAuth();
  if (cargando) return null;
  if (!["Duena", "Secretaria", "Odontologo"].includes(perfil?.rol)) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Acceso restringido — esta sección no está disponible para este usuario.
        </div>
      </main>
    );
  }
  return <PaginaPrioridades />;
}
