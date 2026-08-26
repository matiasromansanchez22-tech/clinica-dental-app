"use client";

import { useState } from "react";
import { calcularCopagoSugerido } from "@/lib/copago";
import { actualizarFilaNomenclador } from "@/lib/data/nomenclador";

export default function NomencladorFilaModal({ fila, porcentajeParticular, excepciones, onClose, onGuardado }) {
  const [valorOS, setValorOS] = useState(fila.valor_os);
  const [copago, setCopago] = useState(fila.copago_oficial);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const sugerido = calcularCopagoSugerido(
    Number(valorOS) || 0,
    Number(fila.valor_efectivo) || 0,
    fila.obra_social,
    porcentajeParticular,
    excepciones
  );

  async function handleSubmit(e) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      await actualizarFilaNomenclador(fila.id, {
        valor_os: Number(valorOS),
        copago_oficial: Number(copago),
      });
      onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{fila.prestacion_os}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            ✕
          </button>
        </div>
        <p className="mb-4 text-sm text-gray-500">
          {fila.obra_social} {fila.codigo ? `· Código ${fila.codigo}` : ""}
        </p>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Valor OS (lo que factura la clínica a la obra social)
            <input
              type="number"
              value={valorOS}
              onChange={(e) => setValorOS(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Copago Oficial (lo que le corresponde pagar al paciente)
            <input
              type="number"
              value={copago}
              onChange={(e) => setCopago(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            />
          </label>

          <div className="rounded-md border border-brand-mint/40 bg-brand-mint/15 px-3 py-2 text-sm text-brand-green">
            Según la configuración actual, el copago sugerido sería{" "}
            <strong>${sugerido.copago.toLocaleString("es-AR")}</strong> ({sugerido.porcentajeAplicado}%
            {sugerido.origen === "excepcion" ? ", excepción de esta obra social" : ""}).
            <button
              type="button"
              onClick={() => setCopago(sugerido.copago)}
              className="ml-2 text-blue-700 underline"
            >
              Usar este valor
            </button>
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
            >
              {guardando ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
