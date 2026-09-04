"use client";

import { useEffect, useState } from "react";
import { obtenerTurnosAReprogramar } from "@/lib/data/turnosReprogramar";
import { actualizarEstadoTurnoGeneral } from "@/lib/data/turnosGeneral";
import { linkWhatsApp } from "@/lib/whatsapp";

export default function ReprogramarPage() {
  const [turnos, setTurnos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [procesando, setProcesando] = useState(null);

  async function recargar() {
    const data = await obtenerTurnosAReprogramar();
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
      await actualizarEstadoTurnoGeneral(turno.id, { estado: "Cancelado" });
      await recargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setProcesando(null);
    }
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">Turnos a reprogramar</h1>
      <p className="mt-1 text-sm text-gray-500">
        Pacientes que quedaron sin un horario fijo — llamalos y agendales un turno nuevo desde la Agenda.
      </p>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-brand-brown text-white">
              <th className="px-3 py-2 text-left font-semibold">Paciente</th>
              <th className="px-3 py-2 text-left font-semibold">Celular</th>
              <th className="px-3 py-2 text-left font-semibold">Turno original</th>
              <th className="px-3 py-2 text-left font-semibold">Profesional</th>
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
                <td className="px-3 py-2 text-gray-600">{t.celular}</td>
                <td className="px-3 py-2 text-gray-600">
                  {t.fecha} · {t.horaInicio} · Consultorio {t.consultorio} · {t.tipoAtencion}
                </td>
                <td className="px-3 py-2 text-gray-600">{t.profesionalDeTurno}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-3">
                    {linkWhatsApp(t.celular) && (
                      <a
                        href={linkWhatsApp(
                          t.celular,
                          `Hola ${t.paciente}, te escribimos de Clínica Dental Marianela Ramírez para reprogramar tu turno.`
                        )}
                        target="whatsapp_clinica"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-emerald-600 hover:underline"
                      >
                        💬 WhatsApp
                      </a>
                    )}
                    <button
                      disabled={procesando === t.id}
                      onClick={() => marcarResuelto(t)}
                      className="text-xs font-medium text-emerald-700 hover:underline disabled:opacity-50"
                    >
                      Ya lo reprogramé
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
