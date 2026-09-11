"use client";

import { useEffect, useMemo, useState } from "react";
import { actualizarEstadoTurnoOrtodoncia, obtenerTurnosOrtodonciaAReprogramar } from "@/lib/data/turnosOrtodoncia";
import { fechaDeHoyISO, sumarDias } from "@/lib/agenda";
import { linkWhatsApp } from "@/lib/whatsapp";

function formatoFecha(fechaISO) {
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}

export default function ReprogramarOrtodonciaPage() {
  const [turnos, setTurnos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [procesando, setProcesando] = useState(null);
  const [fechaFiltro, setFechaFiltro] = useState("");

  async function recargar() {
    const data = await obtenerTurnosOrtodonciaAReprogramar();
    setTurnos(data);
  }

  useEffect(() => {
    recargar()
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  // La forma normal de resolver esto es agendándole un turno nuevo al
  // paciente desde la Agenda — eso ya lo saca solo de esta lista. Este
  // botón es solo para el caso excepcional de que no se le vaya a dar un
  // turno nuevo (ej. decidió no volver) y haya que sacarlo igual.
  async function marcarResuelto(turno) {
    if (!window.confirm(`¿Sacar a ${turno.paciente} de esta lista sin agendarle un turno nuevo?`)) return;
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

  // Agrupados por fecha del turno original, así no quedan todos
  // mezclados en una lista larga — de un vistazo se ve cuántos se cayeron
  // el mismo día.
  const gruposPorFecha = useMemo(() => {
    const mapa = {};
    for (const t of turnos) {
      if (!mapa[t.fecha]) mapa[t.fecha] = [];
      mapa[t.fecha].push(t);
    }
    return Object.entries(mapa)
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([fecha, items]) => ({ fecha, items }));
  }, [turnos]);

  const gruposMostrados = fechaFiltro ? gruposPorFecha.filter((g) => g.fecha === fechaFiltro) : gruposPorFecha;

  function irADia(delta) {
    setFechaFiltro((f) => sumarDias(f || fechaDeHoyISO(), delta));
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">Turnos a reprogramar — Ortodoncia</h1>
      <p className="mt-1 text-sm text-gray-500">
        Pacientes que quedaron sin un horario fijo — llamalos y agendales un turno nuevo desde la Agenda. Apenas le
        cargues el turno nuevo, se saca solo de esta lista.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button onClick={() => irADia(-1)} className="rounded-md border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50">
          ← Día anterior
        </button>
        <input
          type="date"
          value={fechaFiltro}
          onChange={(e) => setFechaFiltro(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm"
        />
        <button onClick={() => irADia(1)} className="rounded-md border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50">
          Día siguiente →
        </button>
        {fechaFiltro && (
          <button
            onClick={() => setFechaFiltro("")}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50"
          >
            Ver todos
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      {cargando && <p className="mt-4 text-sm text-gray-500">Cargando...</p>}

      {!cargando && turnos.length === 0 && (
        <p className="mt-4 text-sm text-gray-500">No hay turnos pendientes de reprogramar. 🎉</p>
      )}

      {!cargando && turnos.length > 0 && gruposMostrados.length === 0 && (
        <p className="mt-4 text-sm text-gray-500">No hay turnos para reprogramar ese día.</p>
      )}

      <div className="mt-4 flex flex-col gap-4">
        {gruposMostrados.map((grupo) => (
          <div key={grupo.fecha} className="overflow-hidden rounded-lg border border-gray-200">
            <div className="bg-brand-tan/30 px-4 py-2">
              <p className="font-heading text-sm font-semibold text-brand-brown">
                {formatoFecha(grupo.fecha)} · {grupo.items.length} turno{grupo.items.length === 1 ? "" : "s"}
              </p>
            </div>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-400">
                  <th className="px-3 py-2 font-semibold">Paciente</th>
                  <th className="px-3 py-2 font-semibold">WhatsApp</th>
                  <th className="px-3 py-2 font-semibold">Horario original</th>
                  <th className="px-3 py-2 font-semibold">Ortodoncista</th>
                  <th className="px-3 py-2 font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {grupo.items.map((t) => (
                  <tr key={t.id} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-medium text-gray-900">{t.paciente}</td>
                    <td className="px-3 py-2 text-gray-600">{t.whatsapp}</td>
                    <td className="px-3 py-2 text-gray-600">
                      {t.horaInicio} · Consultorio {t.consultorio} · {t.concepto}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{t.profesionalDeTurno}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        {linkWhatsApp(t.whatsapp) && (
                          <a
                            href={linkWhatsApp(
                              t.whatsapp,
                              `Hola ${t.paciente}, ¿cómo está? Nos comunicamos desde Clínica Dental Marianela Ramírez. Su turno de ortodoncia quedó pendiente de reprogramar y nos gustaría coordinar uno nuevo. ¿Qué día y horario le resultaría conveniente?`
                            )}
                            target="whatsapp_clinica"
                            className="text-xs font-medium text-emerald-600 hover:underline"
                          >
                            💬 WhatsApp
                          </a>
                        )}
                        <button
                          disabled={procesando === t.id}
                          onClick={() => marcarResuelto(t)}
                          className="text-xs text-gray-400 hover:underline disabled:opacity-50"
                        >
                          Sacar de la lista
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </main>
  );
}
