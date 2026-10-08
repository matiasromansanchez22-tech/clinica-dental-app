"use client";

import { useState } from "react";
import { crearPagoProfesional } from "@/lib/data/pagosProfesionales";

const MEDIOS_PAGO = ["Efectivo", "Transferencia", "Débito", "Crédito", "Mercado Pago", "QR"];
const TIPOS = ["Copago/Particular", "Particular", "Copago"];

export default function PagoProfesionalCajaModal({ fecha, profesionales, onClose, onGuardado }) {
  const [profesionalId, setProfesionalId] = useState("");
  const [tipo, setTipo] = useState("Copago/Particular");
  const [monto, setMonto] = useState("");
  const [medioPago, setMedioPago] = useState("Efectivo");
  const [observaciones, setObservaciones] = useState("");
  const [montoReserva, setMontoReserva] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold text-brand-brown">💰 Pago a profesional</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            ✕
          </button>
        </div>

        <p className="mb-3 text-sm text-gray-600">
          Se descuenta del total disponible de la caja del día {fecha}.
        </p>

        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          ⚠️ Usar solo si le pagás <strong>hoy mismo</strong>, con la plata que entró hoy. Si el pago es para más
          adelante (por ejemplo, cuando el paciente vuelva a atenderse), no lo cargues acá — registralo desde{" "}
          <strong>Gerencial → Producción y liquidación</strong>.
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Profesional
            <select
              value={profesionalId}
              onChange={(e) => setProfesionalId(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            >
              <option value="">Elegir...</option>
              {profesionales.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Tipo
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5">
              {TIPOS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Monto total del pago
            <input
              type="number"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Medio de pago
            <select
              value={medioPago}
              onChange={(e) => setMedioPago(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            >
              {MEDIOS_PAGO.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            ¿Cuánto de ese total sale de la reserva del Consultorio? (opcional)
            <input
              type="number"
              min={0}
              value={montoReserva}
              onChange={(e) => setMontoReserva(e.target.value)}
              placeholder="0"
              className="rounded-md border border-gray-300 bg-white px-2 py-1.5"
            />
            {Number(monto) > 0 && Number(montoReserva) > 0 && Number(montoReserva) <= Number(monto) && (
              <span className="text-xs">
                Sale de la caja: <strong>${(Number(monto) - Number(montoReserva)).toLocaleString("es-AR")}</strong> · Sale de
                la reserva ({medioPago === "Efectivo" ? "Efectivo" : "Banco"}):{" "}
                <strong>${Number(montoReserva).toLocaleString("es-AR")}</strong>
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Observaciones
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={2}
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
              {guardando ? "Guardando..." : "Registrar pago"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
