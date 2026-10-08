"use client";

import { useState } from "react";
import { crearPagoProfesional } from "@/lib/data/pagosProfesionales";

const MEDIOS_PAGO = ["Efectivo", "Transferencia", "Débito", "Crédito", "Mercado Pago", "QR"];
const TIPOS = ["Copago/Particular", "Particular", "Copago"];

// `disponible` es lo que hay en la caja del día por medio de pago (ya descontados
// los pagos y gastos de ese día). Si el pago es más grande que eso, la
// diferencia se propone como "sale de la reserva" (se puede cambiar a mano).
export default function PagoProfesionalCajaModal({ fecha, profesionales, disponible = {}, onClose, onGuardado }) {
  const [profesionalId, setProfesionalId] = useState("");
  const [tipo, setTipo] = useState("Copago/Particular");
  const [monto, setMonto] = useState("");
  const [medioPago, setMedioPago] = useState("Efectivo");
  const [observaciones, setObservaciones] = useState("");
  const [montoReservaManual, setMontoReservaManual] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const disponibleDelMedio = Math.max(0, Number(disponible[medioPago]) || 0);
  const faltante = Math.max(0, (Number(monto) || 0) - disponibleDelMedio);
  const montoReserva = montoReservaManual !== null ? montoReservaManual : faltante > 0 ? String(faltante) : "";

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!profesionalId) {
      setError("Elegí a qué profesional se le pagó.");
      return;
    }
    if (!monto || Number(monto) <= 0) {
      setError("El monto tiene que ser mayor a cero.");
      return;
    }
    const deReserva = Number(montoReserva) || 0;
    if (deReserva < 0 || deReserva > Number(monto)) {
      setError("Lo que sale de la reserva no puede ser más que el monto total del pago.");
      return;
    }
    const deCaja = Number(monto) - deReserva;
    setGuardando(true);
    try {
      // El pago se parte en dos: lo que sale de la caja (descuenta del disponible
      // del día) y lo que sale de la reserva (no toca la caja ni lo limpio).
      if (deCaja > 0) {
        await crearPagoProfesional({ fecha, profesionalId, tipo, monto: deCaja, medioPago, observaciones, origen: "Caja" });
      }
      if (deReserva > 0) {
        await crearPagoProfesional({
          fecha, profesionalId, tipo, monto: deReserva, medioPago, observaciones, origen: "Produccion", desdeReserva: true,
        });
      }
      onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  const sale = Number(monto) > 0 && Number(montoReserva) > 0 && Number(montoReserva) <= Number(monto);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold text-brand-brown">💰 Pago a profesional</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            ✕
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Caja del {fecha}. Solo si le pagás <strong>hoy</strong> con la plata de hoy; los pagos diferidos van en{" "}
          <strong>Producción y liquidación</strong>.
        </p>

        {error && (
          <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm text-red-800">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
          <label className="col-span-2 flex flex-col gap-0.5 text-xs text-gray-600">
            Profesional
            <select
              value={profesionalId}
              onChange={(e) => setProfesionalId(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
            >
              <option value="">Elegir...</option>
              {profesionales.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-0.5 text-xs text-gray-600">
            Tipo
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
            >
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-0.5 text-xs text-gray-600">
            Medio de pago
            <select
              value={medioPago}
              onChange={(e) => setMedioPago(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
            >
              {MEDIOS_PAGO.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-0.5 text-xs text-gray-600">
            Monto total
            <input
              type="number"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
            />
          </label>

          <label className="flex flex-col gap-0.5 text-xs text-amber-900">
            De la reserva
            <input
              type="number"
              min={0}
              value={montoReserva}
              onChange={(e) => setMontoReservaManual(e.target.value)}
              placeholder="0"
              className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-sm text-gray-900"
            />
          </label>

          <p className="col-span-2 text-[11px] leading-snug text-gray-500">
            En caja hay <strong>${disponibleDelMedio.toLocaleString("es-AR")}</strong> en {medioPago}
            {faltante > 0 ? ": lo que falta se propone de la reserva." : "."}
            {sale && (
              <>
                {" "}
                → Caja <strong>${(Number(monto) - Number(montoReserva)).toLocaleString("es-AR")}</strong> · Reserva (
                {medioPago === "Efectivo" ? "Efectivo" : "Banco"}){" "}
                <strong>${Number(montoReserva).toLocaleString("es-AR")}</strong>
              </>
            )}
          </p>

          <label className="col-span-2 flex flex-col gap-0.5 text-xs text-gray-600">
            Observaciones (opcional)
            <input
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
            />
          </label>

          <div className="col-span-2 mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="rounded-md bg-brand-brown px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
            >
              {guardando ? "Guardando..." : "Registrar pago"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
