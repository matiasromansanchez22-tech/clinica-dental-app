"use client";

import { useEffect, useState } from "react";
import { fechaDeHoyISO } from "@/lib/agenda";
import {
  agregarSaldoAFavor,
  eliminarMovimientoSaldoAFavor,
  obtenerMovimientosSaldoAFavor,
} from "@/lib/data/saldosAFavor";

function formatoFecha(fechaISO) {
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}

// Saldo a favor del paciente — se carga a mano acá (ej. pagó de más, se le
// devolvió un trabajo) y después se puede aplicar en Caja para descontarlo
// de un cobro nuevo.
export default function SaldoAFavor({ pacienteId, esOrtodoncia }) {
  const [movimientos, setMovimientos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [monto, setMonto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [fecha, setFecha] = useState(fechaDeHoyISO());
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    setCargando(true);
    try {
      setMovimientos(await obtenerMovimientosSaldoAFavor(pacienteId, esOrtodoncia));
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteId]);

  const saldoActual = movimientos.reduce((acc, m) => acc + Number(m.monto), 0);

  async function guardar() {
    if (!monto || Number(monto) <= 0) {
      setError("Poné un monto mayor a cero.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await agregarSaldoAFavor({ pacienteId, esOrtodoncia, monto: Number(monto), motivo: motivo.trim(), fecha });
      setMonto("");
      setMotivo("");
      setFecha(fechaDeHoyISO());
      setMostrarNuevo(false);
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(id) {
    if (!window.confirm("¿Borrar este movimiento? Se recalcula el saldo actual.")) return;
    try {
      await eliminarMovimientoSaldoAFavor(id);
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <hr className="mb-4 border-gray-200" />
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase text-gray-400">
          Saldo a favor
          {!cargando && (
            <span className={`ml-2 normal-case ${saldoActual > 0 ? "text-emerald-600" : "text-gray-400"}`}>
              ${saldoActual.toLocaleString("es-AR")}
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={() => (mostrarNuevo ? setMostrarNuevo(false) : setMostrarNuevo(true))}
          className="rounded-md border border-brand-brown/40 px-3 py-1 text-xs font-medium text-brand-brown hover:bg-brand-tan/30"
        >
          + Agregar saldo a favor
        </button>
      </div>

      {error && <p className="mb-2 text-xs text-red-700">{error}</p>}

      {mostrarNuevo && (
        <div className="mb-3 flex flex-col gap-2 rounded-md border border-gray-200 bg-gray-50 p-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs text-gray-700">
              Monto
              <input
                type="number"
                min={0}
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-700">
              Fecha
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-xs text-gray-700">
            Motivo (opcional)
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: pagó de más, se le devolvió un trabajo..."
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setMostrarNuevo(false)}
              className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-white"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={guardar}
              disabled={guardando}
              className="rounded-md bg-brand-brown px-3 py-1 text-xs font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
            >
              {guardando ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      )}

      {cargando ? (
        <p className="text-xs text-gray-500">Cargando...</p>
      ) : movimientos.length === 0 ? (
        <p className="text-xs text-gray-500">Todavía no tiene movimientos de saldo a favor.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {movimientos.map((m) => (
            <li key={m.id} className="flex items-center justify-between text-xs text-gray-700">
              <span>
                {formatoFecha(m.fecha)} —{" "}
                <span className={Number(m.monto) > 0 ? "text-emerald-600" : "text-red-600"}>
                  {Number(m.monto) > 0 ? "+" : ""}${Number(m.monto).toLocaleString("es-AR")}
                </span>
                {m.motivo ? ` — ${m.motivo}` : ""}
              </span>
              <button type="button" onClick={() => borrar(m.id)} className="text-gray-400 hover:text-red-600">
                Borrar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
