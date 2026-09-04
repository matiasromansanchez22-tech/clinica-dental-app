"use client";

import { useState } from "react";
import { fechaDeHoyISO } from "@/lib/agenda";
import {
  CATEGORIAS_EGRESO_PERSONAL,
  CATEGORIAS_INGRESO_PERSONAL,
  CUENTAS_PERSONALES,
  crearMovimientoPersonal,
} from "@/lib/data/finanzasPersonales";

export default function MovimientoPersonalFormModal({ onClose, onGuardado }) {
  const [cuenta, setCuenta] = useState(CUENTAS_PERSONALES[0]);
  const [tipo, setTipo] = useState("Egreso");
  const [categoria, setCategoria] = useState("");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(fechaDeHoyISO());
  const [descripcion, setDescripcion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const categoriasSugeridas = tipo === "Ingreso" ? CATEGORIAS_INGRESO_PERSONAL : CATEGORIAS_EGRESO_PERSONAL;

  async function confirmar() {
    if (!categoria.trim()) {
      setError("Elegí o escribí una categoría.");
      return;
    }
    if (!monto || Number(monto) <= 0) {
      setError("Ingresá un monto válido.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await crearMovimientoPersonal({ cuenta, tipo, categoria: categoria.trim(), monto: Number(monto), fecha, descripcion });
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
        <h2 className="text-lg font-semibold text-gray-900">Nuevo movimiento personal</h2>

        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

        <div className="mt-4 flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={tipo === "Ingreso"} onChange={() => { setTipo("Ingreso"); setCategoria(""); }} />
            Ingreso
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={tipo === "Egreso"} onChange={() => { setTipo("Egreso"); setCategoria(""); }} />
            Egreso (gasto)
          </label>
        </div>

        <label className="mt-3 flex flex-col gap-1 text-xs text-gray-700">
          Cuenta
          <select
            value={cuenta}
            onChange={(e) => setCuenta(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {CUENTAS_PERSONALES.map((c) => (
              <option key={c} value={c}>
                {c === "Efectivo" ? "💵 Efectivo" : "🏦 Banco"}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-3 flex flex-col gap-1 text-xs text-gray-700">
          Categoría
          <input
            list="categorias-personales-sugeridas"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            placeholder={tipo === "Ingreso" ? "Ej. Saldo inicial" : "Ej. Alquiler"}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <datalist id="categorias-personales-sugeridas">
            {categoriasSugeridas.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>

        <label className="mt-3 flex flex-col gap-1 text-xs text-gray-700">
          Monto
          <input
            type="number"
            min={0}
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="mt-3 flex flex-col gap-1 text-xs text-gray-700">
          Fecha
          <input
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="mt-3 flex flex-col gap-1 text-xs text-gray-700">
          Observaciones (opcional)
          <input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
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
