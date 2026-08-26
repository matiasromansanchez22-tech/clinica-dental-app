"use client";

import { useEffect, useState } from "react";
import { actualizarEstadoTurnoOrtodoncia, obtenerTurnosOrtodonciaAReprogramar } from "@/lib/data/turnosOrtodoncia";

export default function ReprogramarOrtodonciaPage() {
  const [turnos, setTurnos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [procesando, setProcesando] = useState(null);

  async function recargar() {
    const data = await obtenerTurnosOrtodonciaAReprogramar();
    setTurnos(data);
  }

  useEffect(() => {
    recargar()
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  async function marcarResuelto(turno) {
    if (!window.confirm(`¿Ya le conseguiste un nuevo horario a ${turno.paciente}? Esto lo saca de esta lista.`)) return;
    setProcesando(turno.id);
    try {
      await actualizarEstadoTurnoOrtodoncia(turno.id, { estado: "Cancelado" });
      await recargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setProcesando(null);
    }
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">Turnos a reprogramar — Ortodoncia</h1>
      <p className="mt-1 text-sm text-gray-500">
        Pacientes que quedaron sin un horario fijo — llamalos y agendales un turno nuevo desde la Agenda.
      </p>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="px-3 py-2 text-left font-semibold">Paciente</th>
              <th className="px-3 py-2 text-left font-semibold">WhatsApp</th>
              <th className="px-3 py-2 text-left font-semibold">Turno original</th>
              <th className="px-3 py-2 text-left font-semibold">Ortodoncista</th>
              <th className="px-3 py-2 text-left font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-gray-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!cargando && turnos.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-gray-500">
                  No hay turnos pendientes de reprogramar. 🎉
                </td>
              </tr>
            )}
            {turnos.map((t) => (
              <tr key={t.id} className="border-t border-gray-100">
                <td className="px-3 py-2 font-medium text-gray-900">{t.paciente}</td>
                <td className="px-3 py-2 text-gray-600">{t.whatsapp}</td>
                <td className="px-3 py-2 text-gray-600">
                  {t.fecha} · {t.horaInicio} · Consultorio {t.consultorio} · {t.concepto}
                </td>
                <td className="px-3 py-2 text-gray-600">{t.profesionalDeTurno}</td>
                <td className="px-3 py-2">
                  <button
                    disabled={procesando === t.id}
                    onClick={() => marcarResuelto(t)}
                    className="text-xs font-medium text-emerald-700 hover:underline disabled:opacity-50"
                  >
                    Ya lo reprogramé
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
