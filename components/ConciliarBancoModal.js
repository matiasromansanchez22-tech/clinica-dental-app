"use client";

import { useState } from "react";
import { registrarConciliacionBanco } from "@/lib/data/conciliacionBanco";

function formatoPesos(n) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

const CUENTAS = ["Banco", "Efectivo"];

export default function ConciliarBancoModal({ saldos, onClose, onGuardado }) {
  const [cuenta, setCuenta] = useState("Banco");
  const [saldoReal, setSaldoReal] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const saldoSistema = saldos[cuenta] || 0;
  const diferencia = saldoReal === "" ? null : Number(saldoReal) - saldoSistema;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (saldoReal === "" || isNaN(Number(saldoReal))) {
      setError("Poné el saldo real que te muestra el banco.");
      return;
    }
    setGuardando(true);
    try {
      await registrarConciliacionBanco({ cuenta, saldoSistema, saldoReal, observaciones });
      onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold text-brand-brown">🔍 Conciliar banco</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            ✕
          </button>
        </div>
        <p className="mb-3 text-sm text-gray-600">
          Poné el saldo real que te muestra el banco (o lo que contaste en efectivo) y te digo si coincide con lo
          que tiene calculado el sistema.
        </p>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Cuenta
            <select value={cuenta} onChange={(e) => setCuenta(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5">
              {CUENTAS.map((c) => (
                <option key={c} value={c}>
                  {c === "Banco" ? "🏦 Banco" : "💵 Efectivo"}
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
            Según el sistema: <span className="font-semibold text-gray-900">{formatoPesos(saldoSistema)}</span>
          </div>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Saldo real (según el banco)
            <input
              type="number"
              autoFocus
              value={saldoReal}
              onChange={(e) => setSaldoReal(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            />
          </label>

          {diferencia !== null && (
            <div
              className={`rounded-md border px-3 py-2 text-sm font-medium ${
                Math.abs(diferencia) < 1
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-amber-200 bg-amber-50 text-amber-900"
              }`}
            >
              {Math.abs(diferencia) < 1
                ? "✅ Coincide, no hay diferencia."
                : diferencia > 0
                  ? `⚠️ Tenés ${formatoPesos(diferencia)} más en el banco que lo que dice el sistema — puede faltar cargar un ingreso, o hay un egreso de más cargado.`
                  : `⚠️ Tenés ${formatoPesos(-diferencia)} menos en el banco que lo que dice el sistema — puede faltar cargar un egreso, o hay un ingreso de más cargado.`}
            </div>
          )}

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Observaciones (opcional)
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={2}
              placeholder="Ej. todavía no encontré a qué corresponde la diferencia"
              className="rounded-md border border-gray-300 px-2 py-1.5"
            />
          </label>

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
              {guardando ? "Guardando..." : "Guardar conciliación"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
