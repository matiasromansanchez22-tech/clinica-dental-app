"use client";

import { useEffect, useState } from "react";
import CobroFormModal from "@/components/CobroFormModal";
import GastoFormModal from "@/components/GastoFormModal";
import { useAuth } from "@/lib/auth/AuthProvider";
import { fechaDeHoyISO, sumarDias } from "@/lib/agenda";
import { eliminarCobro, obtenerCobrosPorFecha } from "@/lib/data/caja";
import { obtenerPacientesActivos } from "@/lib/data/pacientes";
import { obtenerProfesionales } from "@/lib/data/profesionales";
import { obtenerCategoriasGasto } from "@/lib/data/gastos";

export default function CajaPage() {
  const { perfil } = useAuth();
  const esDuena = perfil?.rol === "Duena";
  const [fecha, setFecha] = useState(fechaDeHoyISO());
  const [cobros, setCobros] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [profesionales, setProfesionales] = useState([]);
  const [categoriasGasto, setCategoriasGasto] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [mostrarNuevoPago, setMostrarNuevoPago] = useState(false);

  async function recargar() {
    const data = await obtenerCobrosPorFecha(fecha);
    setCobros(data);
  }

  useEffect(() => {
    setCargando(true);
    Promise.all([obtenerCobrosPorFecha(fecha), obtenerPacientesActivos(), obtenerProfesionales(), obtenerCategoriasGasto()])
      .then(([c, p, prof, cat]) => {
        setCobros(c);
        setPacientes(p);
        setProfesionales(prof);
        setCategoriasGasto(cat);
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha]);

  const totalesPorMedio = cobros.reduce((acc, c) => {
    acc[c.medioPago] = (acc[c.medioPago] || 0) + Number(c.pago);
    return acc;
  }, {});
  const totalGeneral = Object.values(totalesPorMedio).reduce((a, b) => a + b, 0);

  async function borrarCobro(cobro) {
    if (
      !window.confirm(
        `¿Borrar el cobro de ${cobro.paciente} por $${Number(cobro.pago).toLocaleString("es-AR")}? Esta acción no se puede deshacer.`
      )
    )
      return;
    try {
      await eliminarCobro(cobro);
      await recargar();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Caja General</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setMostrarNuevoPago(true)}
            className="rounded-md border border-brand-brown/40 px-4 py-2 text-sm font-medium text-brand-brown hover:bg-brand-tan/30"
          >
            💸 Registrar pago
          </button>
          <button
            onClick={() => setMostrarNuevo(true)}
            className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark"
          >
            + Nuevo cobro
          </button>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
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

      <div className="mt-4 flex flex-wrap gap-3">
        {Object.entries(totalesPorMedio).map(([medio, total]) => (
          <div key={medio} className="rounded-md border border-gray-200 px-3 py-2 text-sm">
            <span className="text-gray-500">{medio}: </span>
            <span className="font-semibold text-gray-900">${total.toLocaleString("es-AR")}</span>
          </div>
        ))}
        <div className="rounded-md bg-brand-brown px-3 py-2 text-sm text-white">
          Total del día: <span className="font-semibold">${totalGeneral.toLocaleString("es-AR")}</span>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-brand-brown text-white">
              <th className="px-3 py-2 text-left font-semibold">Paciente</th>
              <th className="px-3 py-2 text-left font-semibold">Cobertura</th>
              <th className="px-3 py-2 text-left font-semibold">Concepto</th>
              <th className="px-3 py-2 text-left font-semibold">Profesional</th>
              <th className="px-3 py-2 text-right font-semibold">Pago</th>
              <th className="px-3 py-2 text-left font-semibold">Medio</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-gray-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!cargando && cobros.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-gray-500">
                  No hay cobros registrados este día.
                </td>
              </tr>
            )}
            {cobros.map((c) => (
              <tr key={c.id} className="border-t border-gray-100">
                <td className="px-3 py-2 font-medium text-gray-900">{c.paciente}</td>
                <td className="px-3 py-2 text-gray-600">{c.cobertura}</td>
                <td className="px-3 py-2 text-gray-600">
                  {c.modalidad === "Plan de financiación"
                    ? `Plan ${c.idDocumento} · ${c.numeroCuota === "Anticipo" ? "Anticipo" : `Cuota ${c.numeroCuota}`}`
                    : c.prestaciones.map((p) => p.prestacion).join(", ")}
                </td>
                <td className="px-3 py-2 text-gray-600">{c.profesionalAtencion}</td>
                <td className="px-3 py-2 text-right text-gray-600">${Number(c.pago).toLocaleString("es-AR")}</td>
                <td className="px-3 py-2 text-gray-600">{c.medioPago}</td>
                <td className="px-3 py-2 text-right">
                  {c.cerrado && !esDuena ? (
                    <span className="text-xs text-gray-400" title="El turno ya se cerró. Solo la Dueña puede reabrirlo.">
                      🔒 Cerrado
                    </span>
                  ) : (
                    <button onClick={() => borrarCobro(c)} className="text-xs text-red-600 hover:underline">
                      {c.cerrado ? "🔒 Borrar" : "Borrar"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {mostrarNuevo && (
        <CobroFormModal
          fecha={fecha}
          pacientes={pacientes}
          profesionales={profesionales}
          onClose={() => setMostrarNuevo(false)}
          onCreado={async () => {
            await recargar();
            setMostrarNuevo(false);
          }}
        />
      )}

      {mostrarNuevoPago && (
        <GastoFormModal
          categorias={categoriasGasto}
          onClose={() => setMostrarNuevoPago(false)}
          onGuardado={() => setMostrarNuevoPago(false)}
        />
      )}
    </main>
  );
}
