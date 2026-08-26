"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { fechaDeHoyISO, sumarDias } from "@/lib/agenda";
import {
  calcularTotalesDelTurno,
  guardarCierreTurno,
  obtenerCierreTurno,
  obtenerCierresTurnoDelDia,
} from "@/lib/data/cierresTurno";

const ETIQUETAS = [
  { clave: "efectivo", label: "Efectivo" },
  { clave: "transferencia", label: "Transferencia" },
  { clave: "debito", label: "Débito" },
  { clave: "credito", label: "Crédito" },
  { clave: "mercado_pago", label: "Mercado Pago" },
  { clave: "qr", label: "QR" },
];

export default function CierreTurnoPage() {
  const { user, perfil } = useAuth();
  const [fecha, setFecha] = useState(fechaDeHoyISO());
  const [totales, setTotales] = useState(null);
  const [cierreExistente, setCierreExistente] = useState(null);
  const [observaciones, setObservaciones] = useState("");
  const [cierresDelDia, setCierresDelDia] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [mensaje, setMensaje] = useState(null);

  useEffect(() => {
    if (!user) return;
    setCargando(true);
    setMensaje(null);
    Promise.all([
      calcularTotalesDelTurno(fecha, user.id),
      obtenerCierreTurno(fecha, user.id),
      obtenerCierresTurnoDelDia(fecha),
    ])
      .then(([t, c, delDia]) => {
        setTotales(t);
        setCierreExistente(c);
        setObservaciones(c?.observaciones || "");
        setCierresDelDia(delDia);
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [fecha, user]);

  async function handleGuardar() {
    setGuardando(true);
    setError(null);
    setMensaje(null);
    try {
      await guardarCierreTurno(fecha, user.id, perfil?.nombre || user.email, totales, observaciones);
      const [nuevoCierre, delDia] = await Promise.all([
        obtenerCierreTurno(fecha, user.id),
        obtenerCierresTurnoDelDia(fecha),
      ]);
      setCierreExistente(nuevoCierre);
      setCierresDelDia(delDia);
      setMensaje("Cierre de turno guardado correctamente.");
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">Cierre de Turno</h1>
      <p className="mt-1 text-sm text-gray-500">
        Suma solo los cobros que vos cargaste este día ({perfil?.nombre || user?.email}), separados por medio de
        pago — para que cada secretario/a cierre su propia parte de la caja.
      </p>

      <div className="mt-4 flex items-center gap-2">
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
        <button
          onClick={() => setFecha(fechaDeHoyISO())}
          className="rounded-md border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50"
        >
          Hoy
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}
      {mensaje && (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {mensaje}
        </div>
      )}
      {cierreExistente && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Ya cerraste tu turno este día, a las {new Date(cierreExistente.guardado_en).toLocaleTimeString("es-AR")}.
          Si guardás de nuevo, se va a recalcular con tus cobros actuales.
        </div>
      )}

      {cargando || !totales ? (
        <p className="mt-6 text-sm text-gray-500">Calculando...</p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-3 gap-3">
            {ETIQUETAS.map((e) => (
              <div key={e.clave} className="rounded-md border border-gray-200 px-3 py-2">
                <p className="text-xs text-gray-500">{e.label}</p>
                <p className="text-lg font-semibold text-gray-900">
                  ${Number(totales[e.clave]).toLocaleString("es-AR")}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-md bg-brand-brown px-4 py-3 text-white">
            <span className="text-sm">Tu total ({totales.cantidadCobros} cobros): </span>
            <span className="text-xl font-bold">${totales.totalGeneral.toLocaleString("es-AR")}</span>
          </div>

          <label className="mt-4 flex flex-col gap-1 text-sm text-gray-700">
            Observaciones
            <input
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            />
          </label>

          <button
            onClick={handleGuardar}
            disabled={guardando || totales.cantidadCobros === 0}
            className="mt-4 rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
          >
            {guardando ? "Guardando..." : cierreExistente ? "Actualizar mi cierre" : "Guardar mi Cierre de Turno"}
          </button>
          {totales.cantidadCobros === 0 && (
            <p className="mt-2 text-xs text-gray-500">No cargaste cobros este día, no hay nada para cerrar.</p>
          )}
        </>
      )}

      <hr className="my-8 border-gray-200" />

      <h2 className="mb-3 text-lg font-bold text-gray-900">Cierres de turno de este día (todos)</h2>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-brand-brown text-white">
              <th className="px-3 py-2 text-left font-semibold">Secretario/a</th>
              <th className="px-3 py-2 text-right font-semibold">Total</th>
              <th className="px-3 py-2 text-left font-semibold">Guardado</th>
            </tr>
          </thead>
          <tbody>
            {cierresDelDia.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-center text-gray-500">
                  Todavía no hay cierres de turno guardados este día.
                </td>
              </tr>
            )}
            {cierresDelDia.map((c) => (
              <tr key={c.id} className="border-t border-gray-100">
                <td className="px-3 py-2 text-gray-900">{c.nombre_secretaria || "—"}</td>
                <td className="px-3 py-2 text-right text-gray-600">
                  ${Number(c.total_general).toLocaleString("es-AR")}
                </td>
                <td className="px-3 py-2 text-gray-500">{new Date(c.guardado_en).toLocaleString("es-AR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cierresDelDia.length > 0 && (
        <p className="mt-2 text-xs text-gray-500">
          Suma de todos los turnos cerrados este día: $
          {cierresDelDia.reduce((acc, c) => acc + Number(c.total_general), 0).toLocaleString("es-AR")}
        </p>
      )}
    </main>
  );
}
