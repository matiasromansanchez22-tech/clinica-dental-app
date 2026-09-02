"use client";

import { useState } from "react";
import { fechaDeHoyISO } from "@/lib/agenda";
import { marcarTrabajoEnviado } from "@/lib/data/laboratorio";

export default function MarcarEnviadoModal({ trabajo, laboratoriosSugeridos, onClose, onGuardado }) {
  const [laboratorio, setLaboratorio] = useState(trabajo.laboratorio || "");
  const [fecha, setFecha] = useState(fechaDeHoyISO());
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  async function confirmar() {
    if (!laboratorio.trim()) {
      setError("Elegí a qué mecánico se lo mandaste.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await marcarTrabajoEnviado(trabajo.id, fecha, laboratorio.trim());
      await onGuardado();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">Marcar enviado</h2>
        <p className="mt-1 text-sm text-gray-500">
          {trabajo.pacienteNombre} — {trabajo.tipoTrabajo}
          {trabajo.pieza ? ` (${trabajo.pieza})` : ""}
        </p>

        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

        <label className="mt-4 flex flex-col gap-1 text-xs text-gray-700">
          Laboratorio / Mecánico
          <input
            list="laboratorios-sugeridos-envio"
            value={laboratorio}
            onChange={(e) => setLaboratorio(e.target.value)}
            autoFocus
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <datalist id="laboratorios-sugeridos-envio">
            {laboratoriosSugeridos.map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
        </label>

        <label className="mt-3 flex flex-col gap-1 text-xs text-gray-700">
          Fecha de envío
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
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
            {guardando ? "Guardando..." : "📤 Confirmar envío"}
          </button>
        </div>
      </div>
    </div>
  );
}
