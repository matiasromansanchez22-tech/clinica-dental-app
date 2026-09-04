"use client";

import { useEffect, useState } from "react";
import SoloDuena from "@/components/SoloDuena";
import { fechaDeHoyISO } from "@/lib/agenda";
import { obtenerAccesos } from "@/lib/data/accesos";

function formatoFechaHora(iso) {
  const fecha = new Date(iso);
  return fecha.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

function AccesosContenido() {
  const hoy = fechaDeHoyISO();
  const [fechaInicio, setFechaInicio] = useState(hoy);
  const [fechaFin, setFechaFin] = useState(hoy);
  const [accesos, setAccesos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setCargando(true);
    obtenerAccesos({ fechaInicio, fechaFin })
      .then(setAccesos)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [fechaInicio, fechaFin]);

  function irAHoy() {
    setFechaInicio(hoy);
    setFechaFin(hoy);
  }

  const porUsuario = accesos.reduce((acc, a) => {
    acc[a.nombre] = (acc[a.nombre] || 0) + 1;
    return acc;
  }, {});

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">🔑 Accesos</h1>
      <p className="mt-1 text-sm text-gray-500">Quién entró al sistema y cuándo (cada login real, no cada refresco de pestaña).</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button onClick={irAHoy} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
          Hoy
        </button>
        <input
          type="date"
          value={fechaInicio}
          onChange={(e) => setFechaInicio(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
        <span className="text-sm text-gray-500">a</span>
        <input
          type="date"
          value={fechaFin}
          onChange={(e) => setFechaFin(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
      </div>

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      {!cargando && accesos.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {Object.entries(porUsuario).map(([nombre, cantidad]) => (
            <span key={nombre} className="rounded-md bg-brand-tan/30 px-3 py-1.5 text-sm text-brand-brown">
              {nombre}: {cantidad}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-brand-brown text-white">
              <th className="px-3 py-2 text-left font-semibold">Nombre</th>
              <th className="px-3 py-2 text-left font-semibold">Rol</th>
              <th className="px-3 py-2 text-left font-semibold">Fecha y hora</th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-center text-gray-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!cargando && accesos.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-center text-gray-500">
                  No hay accesos registrados en este período.
                </td>
              </tr>
            )}
            {accesos.map((a) => (
              <tr key={a.id} className="border-t border-gray-100">
                <td className="px-3 py-2 font-medium text-gray-900">{a.nombre}</td>
                <td className="px-3 py-2 text-gray-500">{a.rol}</td>
                <td className="px-3 py-2 text-gray-600">{formatoFechaHora(a.logueadoEn)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

export default function AccesosPage() {
  return (
    <SoloDuena>
      <AccesosContenido />
    </SoloDuena>
  );
}
