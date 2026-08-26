"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import SoloDuena from "@/components/SoloDuena";
import { fechaDeHoyISO } from "@/lib/agenda";
import { obtenerProduccionPorProfesional } from "@/lib/data/produccionProfesionales";
import { actualizarPorcentajeHonorarios } from "@/lib/data/profesionales";

function primerYUltimoDiaDelMes(mesISO) {
  const [anio, mes] = mesISO.split("-").map(Number);
  const primero = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const ultimoDia = new Date(anio, mes, 0).getDate();
  const ultimo = `${anio}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
  return { primero, ultimo };
}

function ProduccionPorProfesionalContenido() {
  const [mes, setMes] = useState(fechaDeHoyISO().slice(0, 7));
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [expandido, setExpandido] = useState(null);

  const { primero, ultimo } = useMemo(() => primerYUltimoDiaDelMes(mes), [mes]);

  async function recargar() {
    setCargando(true);
    try {
      const data = await obtenerProduccionPorProfesional(primero, ultimo);
      setFilas(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mes]);

  async function guardarPorcentaje(fila, nuevoPorcentaje) {
    if (fila.profesionalId === "sin-asignar") return;
    try {
      await actualizarPorcentajeHonorarios(fila.profesionalId, nuevoPorcentaje);
      setFilas((fs) =>
        fs.map((f) =>
          f.profesionalId === fila.profesionalId
            ? { ...f, porcentajeHonorarios: nuevoPorcentaje, aLiquidar: f.totalFacturado * (nuevoPorcentaje / 100) }
            : f
        )
      );
    } catch (e) {
      setError(e.message);
    }
  }

  const totalFacturado = filas.reduce((acc, f) => acc + f.totalFacturado, 0);
  const totalALiquidar = filas.reduce((acc, f) => acc + f.aLiquidar, 0);
  const totalAtenciones = filas.reduce((acc, f) => acc + f.cantidadAtenciones, 0);

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">Producción y liquidación por profesional</h1>
      <p className="mt-1 text-sm text-gray-500">
        Cuánto atendió cada profesional este período (Odontología General + Ortodoncia) y cuánto corresponde
        liquidarle según su porcentaje de honorarios.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="month"
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
        <div className="ml-auto flex gap-3">
          <div className="rounded-md border border-gray-200 px-3 py-2 text-sm">
            <span className="text-gray-500">Atenciones: </span>
            <span className="font-semibold text-gray-900">{totalAtenciones}</span>
          </div>
          <div className="rounded-md border border-gray-200 px-3 py-2 text-sm">
            <span className="text-gray-500">Facturado: </span>
            <span className="font-semibold text-gray-900">${totalFacturado.toLocaleString("es-AR")}</span>
          </div>
          <div className="rounded-md bg-gray-900 px-3 py-2 text-sm text-white">
            A liquidar: <span className="font-semibold">${totalALiquidar.toLocaleString("es-AR")}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="px-3 py-2 text-left font-semibold">Profesional</th>
              <th className="px-3 py-2 text-left font-semibold">Especialidad</th>
              <th className="px-2 py-2 text-center font-semibold">Atenciones</th>
              <th className="px-3 py-2 text-right font-semibold">Facturado</th>
              <th className="px-2 py-2 text-center font-semibold">% Honorarios</th>
              <th className="px-3 py-2 text-right font-semibold">A liquidar</th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-gray-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!cargando && filas.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-gray-500">
                  No hay cobros registrados en este período.
                </td>
              </tr>
            )}
            {filas.map((f) => (
              <Fragment key={f.profesionalId}>
                <tr
                  key={f.profesionalId}
                  onClick={() => setExpandido((e) => (e === f.profesionalId ? null : f.profesionalId))}
                  className="cursor-pointer border-t border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-3 py-2 font-medium text-gray-900">
                    {expandido === f.profesionalId ? "▾" : "▸"} {f.nombre}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{f.especialidad}</td>
                  <td className="px-2 py-2 text-center text-gray-600">{f.cantidadAtenciones}</td>
                  <td className="px-3 py-2 text-right text-gray-600">${f.totalFacturado.toLocaleString("es-AR")}</td>
                  <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                    {f.profesionalId === "sin-asignar" ? (
                      "—"
                    ) : (
                      <input
                        type="number"
                        defaultValue={f.porcentajeHonorarios}
                        onBlur={(e) => guardarPorcentaje(f, Number(e.target.value))}
                        className="w-16 rounded-md border border-gray-300 px-1 py-0.5 text-center"
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-emerald-700">
                    ${f.aLiquidar.toLocaleString("es-AR")}
                  </td>
                </tr>
                {expandido === f.profesionalId && (
                  <tr className="bg-gray-50">
                    <td colSpan={6} className="px-3 py-2">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-500">
                            <th className="px-2 py-1 text-left font-medium">Fecha</th>
                            <th className="px-2 py-1 text-left font-medium">Paciente</th>
                            <th className="px-2 py-1 text-left font-medium">Prestación / concepto</th>
                            <th className="px-2 py-1 text-right font-medium">Monto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {f.detalle.map((d, i) => (
                            <tr key={i} className="border-t border-gray-200">
                              <td className="px-2 py-1">{d.fecha}</td>
                              <td className="px-2 py-1">{d.paciente}</td>
                              <td className="px-2 py-1">{d.concepto}</td>
                              <td className="px-2 py-1 text-right">${d.monto.toLocaleString("es-AR")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

export default function ProduccionPorProfesionalPage() {
  return (
    <SoloDuena>
      <ProduccionPorProfesionalContenido />
    </SoloDuena>
  );
}
