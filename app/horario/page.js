"use client";

import { useEffect, useState } from "react";
import { fechaDeHoyISO } from "@/lib/agenda";
import {
  formatoHoras,
  horasTrabajadas,
  marcarEntrada,
  marcarSalida,
  obtenerMisRegistros,
  obtenerRegistroDeHoy,
} from "@/lib/data/horarios";

function primerYUltimoDiaDelMes(fechaISO) {
  const [anio, mes] = fechaISO.split("-").map(Number);
  const primero = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const ultimoDia = new Date(anio, mes, 0).getDate();
  const ultimo = `${anio}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
  return { primero, ultimo };
}

function formatoFecha(fechaISO) {
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}

export default function MiHorarioPage() {
  const hoy = fechaDeHoyISO();
  const { primero, ultimo } = primerYUltimoDiaDelMes(hoy);
  const [registroHoy, setRegistroHoy] = useState(null);
  const [registros, setRegistros] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState(null);

  async function recargar() {
    setCargando(true);
    setError(null);
    try {
      const [hoyReg, mes] = await Promise.all([
        obtenerRegistroDeHoy(),
        obtenerMisRegistros({ fechaInicio: primero, fechaFin: ultimo }),
      ]);
      setRegistroHoy(hoyReg);
      setRegistros(mes);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function alMarcarEntrada() {
    setProcesando(true);
    setError(null);
    try {
      await marcarEntrada();
      await recargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setProcesando(false);
    }
  }

  async function alMarcarSalida() {
    setProcesando(true);
    setError(null);
    try {
      await marcarSalida(registroHoy.id);
      await recargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setProcesando(false);
    }
  }

  const totalMes = registros.reduce((acc, r) => acc + (horasTrabajadas(r) || 0), 0);

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">🕐 Mi horario</h1>

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      <div className="mt-4 rounded-lg border border-gray-200 bg-white p-5 text-center">
        {cargando ? (
          <p className="text-sm text-gray-500">Cargando...</p>
        ) : !registroHoy ? (
          <>
            <p className="mb-3 text-sm text-gray-500">Todavía no marcaste entrada hoy.</p>
            <button
              onClick={alMarcarEntrada}
              disabled={procesando}
              className="rounded-md bg-brand-brown px-6 py-3 text-base font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
            >
              {procesando ? "Marcando..." : "🟢 Marcar entrada"}
            </button>
          </>
        ) : !registroHoy.horaSalida ? (
          <>
            <p className="mb-3 text-sm text-gray-500">
              Entrada de hoy: <span className="font-semibold text-gray-900">{registroHoy.horaEntrada}</span>
            </p>
            <button
              onClick={alMarcarSalida}
              disabled={procesando}
              className="rounded-md bg-red-600 px-6 py-3 text-base font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {procesando ? "Marcando..." : "🔴 Marcar salida"}
            </button>
          </>
        ) : (
          <p className="text-sm text-gray-700">
            Hoy: <span className="font-semibold">{registroHoy.horaEntrada}</span> a{" "}
            <span className="font-semibold">{registroHoy.horaSalida}</span> ·{" "}
            <span className="font-semibold text-emerald-700">{formatoHoras(horasTrabajadas(registroHoy))}</span>
          </p>
        )}
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">Este mes</p>
          <span className="rounded-md bg-brand-tan/30 px-3 py-1 text-sm font-semibold text-brand-brown">
            Total: {formatoHoras(totalMes)}
          </span>
        </div>
        <div className="mt-2 overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-brand-brown text-white">
                <th className="px-3 py-2 text-left font-semibold">Fecha</th>
                <th className="px-3 py-2 text-left font-semibold">Entrada</th>
                <th className="px-3 py-2 text-left font-semibold">Salida</th>
                <th className="px-3 py-2 text-right font-semibold">Horas</th>
              </tr>
            </thead>
            <tbody>
              {!cargando && registros.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-gray-500">
                    Todavía no hay registros este mes.
                  </td>
                </tr>
              )}
              {registros.map((r) => (
                <tr key={r.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 text-gray-600">{formatoFecha(r.fecha)}</td>
                  <td className="px-3 py-2 text-gray-600">{r.horaEntrada || "—"}</td>
                  <td className="px-3 py-2 text-gray-600">{r.horaSalida || "—"}</td>
                  <td className="px-3 py-2 text-right text-gray-900">{formatoHoras(horasTrabajadas(r))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
