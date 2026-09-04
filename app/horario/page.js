"use client";

import { useEffect, useState } from "react";
import { fechaDeHoyISO, sumarDias } from "@/lib/agenda";
import {
  formatoHoras,
  guardarRegistroPropio,
  horasTrabajadas,
  marcarEntrada,
  marcarSalida,
  obtenerMisRegistros,
  obtenerRegistroDeFecha,
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
  const [fecha, setFecha] = useState(hoy);
  const [registro, setRegistro] = useState(null);
  const [horaEntradaManual, setHoraEntradaManual] = useState("");
  const [horaSalidaManual, setHoraSalidaManual] = useState("");
  const [registros, setRegistros] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState(null);
  const [mensaje, setMensaje] = useState(null);

  const esHoy = fecha === hoy;

  async function recargar() {
    setCargando(true);
    setError(null);
    try {
      const [reg, mes] = await Promise.all([
        obtenerRegistroDeFecha(fecha),
        obtenerMisRegistros({ fechaInicio: primero, fechaFin: ultimo }),
      ]);
      setRegistro(reg);
      setHoraEntradaManual(reg?.horaEntrada || "");
      setHoraSalidaManual(reg?.horaSalida || "");
      setRegistros(mes);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    setMensaje(null);
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha]);

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
      await marcarSalida(registro.id);
      await recargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setProcesando(false);
    }
  }

  async function guardarManual() {
    setProcesando(true);
    setError(null);
    setMensaje(null);
    try {
      await guardarRegistroPropio({
        id: registro?.id,
        fecha,
        horaEntrada: horaEntradaManual,
        horaSalida: horaSalidaManual,
      });
      setMensaje("Guardado.");
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

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setFecha((f) => sumarDias(f, -1))}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50"
        >
          ← Día anterior
        </button>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm"
        />
        <button
          onClick={() => setFecha((f) => sumarDias(f, 1))}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50"
        >
          Día siguiente →
        </button>
        {!esHoy && (
          <button onClick={() => setFecha(hoy)} className="rounded-md border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50">
            Hoy
          </button>
        )}
      </div>

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
      {mensaje && <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{mensaje}</div>}

      <div className="mt-4 rounded-lg border border-gray-200 bg-white p-5">
        {cargando ? (
          <p className="text-center text-sm text-gray-500">Cargando...</p>
        ) : esHoy ? (
          // Hoy: los botones de "en el momento" para marcar de verdad.
          <div className="text-center">
            {!registro ? (
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
            ) : !registro.horaSalida ? (
              <>
                <p className="mb-3 text-sm text-gray-500">
                  Entrada de hoy: <span className="font-semibold text-gray-900">{registro.horaEntrada}</span>
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
                Hoy: <span className="font-semibold">{registro.horaEntrada}</span> a{" "}
                <span className="font-semibold">{registro.horaSalida}</span> ·{" "}
                <span className="font-semibold text-emerald-700">{formatoHoras(horasTrabajadas(registro))}</span>
              </p>
            )}
          </div>
        ) : (
          // Otro día: carga o corrección a mano.
          <>
            <p className="mb-3 text-sm font-medium text-gray-700">Cargar {formatoFecha(fecha)}</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs text-gray-700">
                Entrada
                <input
                  type="time"
                  value={horaEntradaManual}
                  onChange={(e) => setHoraEntradaManual(e.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-gray-700">
                Salida
                <input
                  type="time"
                  value={horaSalidaManual}
                  onChange={(e) => setHoraSalidaManual(e.target.value)}
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
            </div>
            <button
              onClick={guardarManual}
              disabled={procesando}
              className="mt-3 w-full rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
            >
              {procesando ? "Guardando..." : "Guardar"}
            </button>
          </>
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
                <tr
                  key={r.id}
                  onClick={() => setFecha(r.fecha)}
                  className={`cursor-pointer border-t border-gray-100 hover:bg-gray-50 ${r.fecha === fecha ? "bg-brand-tan/20" : ""}`}
                >
                  <td className="px-3 py-2 text-gray-600">{formatoFecha(r.fecha)}</td>
                  <td className="px-3 py-2 text-gray-600">{r.horaEntrada || "—"}</td>
                  <td className="px-3 py-2 text-gray-600">{r.horaSalida || "—"}</td>
                  <td className="px-3 py-2 text-right text-gray-900">{formatoHoras(horasTrabajadas(r))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-400">Tip: tocá cualquier fila de la lista para editarla arriba.</p>
      </div>
    </main>
  );
}
