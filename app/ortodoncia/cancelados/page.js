"use client";

import { useEffect, useMemo, useState } from "react";
import { obtenerTurnosCanceladosOrtodoncia } from "@/lib/data/turnosCancelados";
import { fechaDeHoyISO } from "@/lib/agenda";
import { linkWhatsApp } from "@/lib/whatsapp";

function formatoFecha(fechaISO) {
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}

export default function CanceladosOrtodonciaPage() {
  const mesActual = fechaDeHoyISO().slice(0, 7);
  const [mesElegido, setMesElegido] = useState(mesActual);
  const [busqueda, setBusqueda] = useState("");
  const [turnos, setTurnos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const [anio, mes] = mesElegido.split("-").map(Number);
    setCargando(true);
    obtenerTurnosCanceladosOrtodoncia(anio, mes)
      .then(setTurnos)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [mesElegido]);

  const turnosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return turnos;
    return turnos.filter(
      (t) => t.paciente.toLowerCase().includes(termino) || t.profesionalDeTurno.toLowerCase().includes(termino)
    );
  }, [turnos, busqueda]);

  // Agrupados por fecha del turno original, igual que en "Reprogramar".
  const gruposPorFecha = useMemo(() => {
    const mapa = {};
    for (const t of turnosFiltrados) {
      if (!mapa[t.fecha]) mapa[t.fecha] = [];
      mapa[t.fecha].push(t);
    }
    return Object.entries(mapa)
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([fecha, items]) => ({ fecha, items }));
  }, [turnosFiltrados]);

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">Turnos cancelados — Ortodoncia</h1>
      <p className="mt-1 text-sm text-gray-500">
        Registro de todos los turnos cancelados, con el motivo que se cargó al cancelarlos. Es solo para consulta —
        no se pueden reabrir desde acá.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="month"
          value={mesElegido}
          onChange={(e) => setMesElegido(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por paciente o profesional..."
          className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        />
        {!cargando && (
          <span className="text-sm text-gray-500">
            {turnosFiltrados.length} turno{turnosFiltrados.length === 1 ? "" : "s"} cancelado
            {turnosFiltrados.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      {cargando && <p className="mt-4 text-sm text-gray-500">Cargando...</p>}

      {!cargando && turnosFiltrados.length === 0 && (
        <p className="mt-4 text-sm text-gray-500">No hay turnos cancelados en este mes.</p>
      )}

      <div className="mt-4 flex flex-col gap-4">
        {gruposPorFecha.map((grupo) => (
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
                  <th className="px-3 py-2 font-semibold">Hora</th>
                  <th className="px-3 py-2 font-semibold">Consultorio / Tipo</th>
                  <th className="px-3 py-2 font-semibold">Ortodoncista</th>
                  <th className="px-3 py-2 font-semibold">Motivo</th>
                </tr>
              </thead>
              <tbody>
                {grupo.items.map((t) => (
                  <tr key={t.id} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-medium text-gray-900">{t.paciente}</td>
                    <td className="px-3 py-2 text-gray-600">
                      <span className="flex items-center gap-1.5">
                        {t.whatsapp}
                        {linkWhatsApp(t.whatsapp) && (
                          <a
                            href={linkWhatsApp(t.whatsapp)}
                            title="Escribir por WhatsApp"
                            className="text-emerald-600 hover:text-emerald-700"
                          >
                            💬
                          </a>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-600">{t.horaInicio}</td>
                    <td className="px-3 py-2 text-gray-600">
                      Consultorio {t.consultorio} · {t.concepto}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{t.profesionalDeTurno}</td>
                    <td className="px-3 py-2 text-gray-500">{t.motivo || "—"}</td>
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
