"use client";

import { useEffect, useMemo, useState } from "react";
import SoloDuena from "@/components/SoloDuena";
import { fechaDeHoyISO } from "@/lib/agenda";
import { obtenerRankingPrestaciones } from "@/lib/data/rankingPrestaciones";

function primerYUltimoDiaDelMes(fechaISO) {
  const [anio, mes] = fechaISO.split("-").map(Number);
  const primero = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const ultimoDia = new Date(anio, mes, 0).getDate();
  const ultimo = `${anio}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
  return { primero, ultimo };
}

function ColorEspecialidad(especialidad) {
  return especialidad === "Ortodoncia" ? "bg-violet-500" : "bg-sky-500";
}

function RankingPrestacionesContenido() {
  const hoy = fechaDeHoyISO();
  const [fechaInicio, setFechaInicio] = useState(() => primerYUltimoDiaDelMes(hoy).primero);
  const [fechaFin, setFechaFin] = useState(() => primerYUltimoDiaDelMes(hoy).ultimo);
  const [orden, setOrden] = useState("monto");
  const [datos, setDatos] = useState({ filas: [], totalCantidad: 0, totalMonto: 0 });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  async function recargar() {
    setCargando(true);
    try {
      const data = await obtenerRankingPrestaciones(fechaInicio, fechaFin);
      setDatos(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaInicio, fechaFin]);

  function irAHoy() {
    setFechaInicio(hoy);
    setFechaFin(hoy);
  }

  function irAEsteMes() {
    const { primero, ultimo } = primerYUltimoDiaDelMes(hoy);
    setFechaInicio(primero);
    setFechaFin(ultimo);
  }

  const filasOrdenadas = useMemo(() => {
    return [...datos.filas].sort((a, b) => (orden === "monto" ? b.monto - a.monto : b.cantidad - a.cantidad));
  }, [datos, orden]);

  const maximo = useMemo(() => {
    if (filasOrdenadas.length === 0) return 1;
    return orden === "monto" ? filasOrdenadas[0].monto : filasOrdenadas[0].cantidad;
  }, [filasOrdenadas, orden]);

  const masFuerte = filasOrdenadas[0];
  const masDebil = filasOrdenadas[filasOrdenadas.length - 1];

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">Ranking de prestaciones</h1>
      <p className="mt-1 text-sm text-gray-500">
        Qué se hace más y qué se hace menos en la clínica (Odontología General + Ortodoncia), para saber dónde está
        el fuerte y qué conviene mejorar o promocionar.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button onClick={irAHoy} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
          Hoy
        </button>
        <button onClick={irAEsteMes} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
          Este mes
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
        <select
          value={orden}
          onChange={(e) => setOrden(e.target.value)}
          className="ml-auto rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="monto">Ordenar por facturación</option>
          <option value="cantidad">Ordenar por cantidad</option>
        </select>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      {!cargando && filasOrdenadas.length > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
            <span className="text-emerald-700">💪 El fuerte: </span>
            <span className="font-semibold text-emerald-900">{masFuerte.nombre}</span>
            <span className="text-emerald-700"> ({masFuerte.especialidad})</span>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
            <span className="text-amber-700">🐢 El menos vendido: </span>
            <span className="font-semibold text-amber-900">{masDebil.nombre}</span>
            <span className="text-amber-700"> ({masDebil.especialidad})</span>
          </div>
        </div>
      )}

      <div className="mt-4 rounded-lg border border-gray-200">
        {cargando && <p className="px-3 py-4 text-center text-sm text-gray-500">Cargando...</p>}
        {!cargando && filasOrdenadas.length === 0 && (
          <p className="px-3 py-4 text-center text-sm text-gray-500">No hay cobros registrados en este período.</p>
        )}
        {!cargando &&
          filasOrdenadas.map((f, i) => (
            <div key={`${f.especialidad}-${f.nombre}`} className="flex items-center gap-3 border-t border-gray-100 px-3 py-2 first:border-t-0">
              <span className="w-6 text-right text-xs text-gray-400">{i + 1}</span>
              <div className="flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {f.nombre} <span className="text-xs font-normal text-gray-400">({f.especialidad})</span>
                  </span>
                  <span className="whitespace-nowrap text-sm text-gray-600">
                    {f.cantidad} {f.cantidad === 1 ? "vez" : "veces"} · ${f.monto.toLocaleString("es-AR")}
                  </span>
                </div>
                <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={`h-full rounded-full ${ColorEspecialidad(f.especialidad)}`}
                    style={{ width: `${Math.max(((orden === "monto" ? f.monto : f.cantidad) / maximo) * 100, 2)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
      </div>

      <div className="mt-3 flex gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-sky-500" /> Odontología General
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-violet-500" /> Ortodoncia
        </span>
      </div>
    </main>
  );
}

export default function RankingPrestacionesPage() {
  return (
    <SoloDuena>
      <RankingPrestacionesContenido />
    </SoloDuena>
  );
}
