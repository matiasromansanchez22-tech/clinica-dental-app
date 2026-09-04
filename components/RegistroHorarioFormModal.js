"use client";

import { useState } from "react";
import { fechaDeHoyISO } from "@/lib/agenda";
import { actualizarRegistro, crearRegistroManual } from "@/lib/data/horarios";

export default function RegistroHorarioFormModal({ registro, usuarioId, usuarioNombre, onClose, onGuardado }) {
  const [fecha, setFecha] = useState(registro?.fecha || fechaDeHoyISO());
  const [horaEntrada, setHoraEntrada] = useState(registro?.horaEntrada || "");
  const [horaSalida, setHoraSalida] = useState(registro?.horaSalida || "");
  const [observaciones, setObservaciones] = useState(registro?.observaciones || "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  async function confirmar() {
    setGuardando(true);
    setError(null);
    try {
      if (registro) {
        await actualizarRegistro(registro.id, { horaEntrada, horaSalida, observaciones });
      } else {
        await crearRegistroManual({ usuarioId, fecha, horaEntrada, horaSalida, observaciones });
      }
      onGuardado();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">
          {registro ? "Editar registro" : "Agregar registro"}
        </h2>
        <p className="mt-1 text-sm text-gray-500">{usuarioNombre}</p>

        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

        {!registro && (
          <label className="mt-4 flex flex-col gap-1 text-xs text-gray-700">
            Fecha
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        )}

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs text-gray-700">
            Entrada
            <input
              type="time"
              value={horaEntrada}
              onChange={(e) => setHoraEntrada(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-700">
            Salida
            <input
              type="time"
              value={horaSalida}
              onChange={(e) => setHoraSalida(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <label className="mt-3 flex flex-col gap-1 text-xs text-gray-700">
          Observaciones (opcional)
          <input
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            onClick={confirmar}
            disabled={guardando}
            className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
          >
            {guardando ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
