"use client";

import { useEffect, useState } from "react";
import CobroOrtodonciaFormModal from "@/components/CobroOrtodonciaFormModal";
import GastoFormModal from "@/components/GastoFormModal";
import { useAuth } from "@/lib/auth/AuthProvider";
import { fechaDeHoyISO, sumarDias } from "@/lib/agenda";
import { eliminarCobroOrtodoncia, obtenerCobrosOrtodonciaPorFecha } from "@/lib/data/cajaOrtodoncia";
import { obtenerPacientesOrtodoncia } from "@/lib/data/pacientesOrtodoncia";
import { obtenerCategoriasGasto } from "@/lib/data/gastos";

export default function CajaOrtodonciaPage() {
  const { perfil } = useAuth();
  const esDuena = perfil?.rol === "Duena";
  const [fecha, setFecha] = useState(fechaDeHoyISO());
  const [cobros, setCobros] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [categoriasGasto, setCategoriasGasto] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [mostrarNuevoPago, setMostrarNuevoPago] = useState(false);

  async function recargar() {
    const data = await obtenerCobrosOrtodonciaPorFecha(fecha);
    setCobros(data);
  }

  useEffect(() => {
    setCargando(true);
    Promise.all([obtenerCobrosOrtodonciaPorFecha(fecha), obtenerPacientesOrtodoncia(), obtenerCategoriasGasto()])
      .then(([c, p, cat]) => {
        setCobros(c);
        setPacientes(p);
        setCategoriasGasto(cat);
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha]);

  const totalesPorMedio = cobros.reduce((acc, c) => {
    acc[c.medioPago] = (acc[c.medioPago] || 0) + Number(c.importe);
    return acc;
  }, {});
  const totalGeneral = Object.values(totalesPorMedio).reduce((a, b) => a + b, 0);

  async function borrarCobro(cobro) {
    if (
      !window.confirm(
        `¿Borrar el cobro de ${cobro.paciente} por $${Number(cobro.importe).toLocaleString("es-AR")}? Esta acción no se puede deshacer.`
      )
    )
      return;
    try {
      await eliminarCobroOrtodoncia(cobro.id);
      await recargar();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Caja — Ortodoncia</h1>
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
              <th className="px-3 py-2 text-left font-semibold">Concepto</th>
              <th className="px-3 py-2 text-left font-semibold">Ortodoncista</th>
              <th className="px-3 py-2 text-right font-semibold">Importe</th>
              <th className="px-3 py-2 text-left font-semibold">Medio</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-gray-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!cargando && cobros.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-gray-500">
                  No hay cobros registrados este día.
                </td>
              </tr>
            )}
            {cobros.map((c) => (
              <tr key={c.id} className="border-t border-gray-100">
                <td className="px-3 py-2 font-medium text-gray-900">{c.paciente}</td>
                <td className="px-3 py-2 text-gray-600">
                  {c.concepto}
                  {c.concepto === "Control" && c.cantidadControlesAbonados > 1 && ` (${c.cantidadControlesAbonados} controles)`}
                  {c.bracketReposicion &&
                    ` (${c.concepto === "Control" ? "+ " : ""}${c.bracketReposicion}${c.cantidadBrackets ? ` x${c.cantidadBrackets}` : ""}${c.concepto === "Control" ? " despegado" : ""})`}
                </td>
                <td className="px-3 py-2 text-gray-600">{c.ortodoncista}</td>
                <td className="px-3 py-2 text-right text-gray-600">${Number(c.importe).toLocaleString("es-AR")}</td>
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
        <CobroOrtodonciaFormModal
          fecha={fecha}
          pacientes={pacientes}
          onClose={() => setMostrarNuevo(false)}
          onCreado={async () => {
            await recargar();
            setMostrarNuevo(false);
          }}
        />
      )}

      {mostrarNuevoPago && (
        <GastoFormModal
          categorias={esDuena ? categoriasGasto : categoriasGasto.filter((c) => c.visible_secretarios)}
          onClose={() => setMostrarNuevoPago(false)}
          onGuardado={() => setMostrarNuevoPago(false)}
        />
      )}
    </main>
  );
}
