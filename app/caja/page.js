"use client";

import { useEffect, useState } from "react";
import CobroFormModal from "@/components/CobroFormModal";
import GastoFormModal from "@/components/GastoFormModal";
import PagoProfesionalCajaModal from "@/components/PagoProfesionalCajaModal";
import { useAuth } from "@/lib/auth/AuthProvider";
import { fechaDeHoyISO, sumarDias } from "@/lib/agenda";
import { eliminarCobro, obtenerCobrosPorFecha } from "@/lib/data/caja";
import { obtenerPacientesActivos } from "@/lib/data/pacientes";
import { obtenerProfesionales } from "@/lib/data/profesionales";
import { eliminarGasto, obtenerCategoriasGasto, obtenerGastos } from "@/lib/data/gastos";
import { eliminarPagoProfesional, obtenerPagosProfesionales } from "@/lib/data/pagosProfesionales";

export default function CajaPage() {
  const { perfil } = useAuth();
  const esDuena = perfil?.rol === "Duena";
  const [fecha, setFecha] = useState(fechaDeHoyISO());
  const [cobros, setCobros] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [pagosProfesionales, setPagosProfesionales] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [profesionales, setProfesionales] = useState([]);
  const [categoriasGasto, setCategoriasGasto] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [mostrarNuevoPago, setMostrarNuevoPago] = useState(false);
  const [mostrarNuevoPagoProfesional, setMostrarNuevoPagoProfesional] = useState(false);

  async function recargar() {
    const [c, g, pp] = await Promise.all([
      obtenerCobrosPorFecha(fecha),
      obtenerGastos(fecha, fecha),
      obtenerPagosProfesionales(fecha, fecha),
    ]);
    setCobros(c);
    setGastos(g);
    setPagosProfesionales(pp);
  }

  useEffect(() => {
    setCargando(true);
    Promise.all([
      obtenerCobrosPorFecha(fecha),
      obtenerGastos(fecha, fecha),
      obtenerPagosProfesionales(fecha, fecha),
      obtenerPacientesActivos(),
      obtenerProfesionales(),
      obtenerCategoriasGasto(),
    ])
      .then(([c, g, pp, p, prof, cat]) => {
        setCobros(c);
        setGastos(g);
        setPagosProfesionales(pp);
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

  const egresosDelDia = [
    ...gastos.map((g) => ({ id: g.id, tipo: "gasto", etiqueta: g.categoria, monto: g.monto, medioPago: g.medioPago })),
    ...pagosProfesionales.map((p) => ({
      id: p.id,
      tipo: "pagoProfesional",
      etiqueta: `Pago a ${p.profesional} (${p.tipo})`,
      monto: p.monto,
      medioPago: p.medioPago,
    })),
  ];
  const totalesEgresosPorMedio = egresosDelDia.reduce((acc, e) => {
    acc[e.medioPago] = (acc[e.medioPago] || 0) + Number(e.monto);
    return acc;
  }, {});
  const mediosUnicos = Array.from(new Set([...Object.keys(totalesPorMedio), ...Object.keys(totalesEgresosPorMedio)]));
  const totalesDisponible = Object.fromEntries(
    mediosUnicos.map((medio) => [medio, (totalesPorMedio[medio] || 0) - (totalesEgresosPorMedio[medio] || 0)])
  );
  const totalEgresos = egresosDelDia.reduce((a, e) => a + Number(e.monto), 0);
  const totalDisponible = totalGeneral - totalEgresos;

  async function borrarGasto(gasto) {
    if (!window.confirm(`¿Borrar el pago de ${gasto.categoria} por $${Number(gasto.monto).toLocaleString("es-AR")}?`)) return;
    try {
      await eliminarGasto(gasto.id);
      await recargar();
    } catch (e) {
      setError(e.message);
    }
  }

  async function borrarPagoProfesional(pago) {
    if (!window.confirm(`¿Borrar el pago a ${pago.profesional} por $${Number(pago.monto).toLocaleString("es-AR")}?`)) return;
    try {
      await eliminarPagoProfesional(pago.id);
      await recargar();
    } catch (e) {
      setError(e.message);
    }
  }

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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-900">Caja General</h1>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setMostrarNuevoPagoProfesional(true)}
            className="rounded-md border border-brand-brown/40 px-2.5 py-1.5 text-xs font-medium text-brand-brown hover:bg-brand-tan/30"
          >
            💰 Pago a profesional
          </button>
          <button
            onClick={() => setMostrarNuevoPago(true)}
            className="rounded-md border border-brand-brown/40 px-4 py-2 text-sm font-medium text-brand-brown hover:bg-brand-tan/30"
          >
            💸 Registrar gasto
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

      <p className="mt-4 text-xs font-semibold uppercase text-gray-400">Cobrado (bruto)</p>
      <div className="mt-1 flex flex-wrap gap-3">
        {Object.entries(totalesPorMedio).map(([medio, total]) => (
          <div key={medio} className="rounded-md border border-gray-200 px-3 py-2 text-sm">
            <span className="text-gray-500">{medio}: </span>
            <span className="font-semibold text-gray-900">${total.toLocaleString("es-AR")}</span>
          </div>
        ))}
        <div className="rounded-md bg-gray-700 px-3 py-2 text-sm text-white">
          Total cobrado: <span className="font-semibold">${totalGeneral.toLocaleString("es-AR")}</span>
        </div>
      </div>

      <p className="mt-3 text-xs font-semibold uppercase text-gray-400">Disponible (después de pagos)</p>
      <div className="mt-1 flex flex-wrap gap-3">
        {mediosUnicos.map((medio) => (
          <div key={medio} className="rounded-md border border-gray-200 px-3 py-2 text-sm">
            <span className="text-gray-500">{medio}: </span>
            <span className={`font-semibold ${totalesDisponible[medio] < 0 ? "text-red-600" : "text-gray-900"}`}>
              ${totalesDisponible[medio].toLocaleString("es-AR")}
            </span>
          </div>
        ))}
        <div className="rounded-md bg-brand-brown px-3 py-2 text-sm text-white">
          Total disponible: <span className="font-semibold">${totalDisponible.toLocaleString("es-AR")}</span>
        </div>
      </div>

      {egresosDelDia.length > 0 && (
        <div className="mt-4 rounded-lg border border-gray-200">
          <p className="border-b border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold uppercase text-gray-500">
            Pagos y gastos del día (se descuentan del disponible)
          </p>
          <ul>
            {gastos.map((g) => (
              <li key={`gasto-${g.id}`} className="flex items-center justify-between border-t border-gray-100 px-3 py-2 text-sm">
                <span className="text-gray-700">
                  💸 {g.categoria} <span className="text-xs text-gray-400">({g.medioPago})</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-medium text-gray-900">${Number(g.monto).toLocaleString("es-AR")}</span>
                  <button onClick={() => borrarGasto(g)} className="text-xs text-red-600 hover:underline">
                    Borrar
                  </button>
                </span>
              </li>
            ))}
            {pagosProfesionales.map((p) => (
              <li key={`pago-${p.id}`} className="flex items-center justify-between border-t border-gray-100 px-3 py-2 text-sm">
                <span className="text-gray-700">
                  💰 Pago a {p.profesional} <span className="text-xs text-gray-400">({p.tipo} · {p.medioPago})</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-medium text-gray-900">${Number(p.monto).toLocaleString("es-AR")}</span>
                  <button onClick={() => borrarPagoProfesional(p)} className="text-xs text-red-600 hover:underline">
                    Borrar
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

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
          categorias={esDuena ? categoriasGasto : categoriasGasto.filter((c) => c.visible_secretarios)}
          onClose={() => setMostrarNuevoPago(false)}
          onGuardado={async () => {
            await recargar();
            setMostrarNuevoPago(false);
          }}
        />
      )}

      {mostrarNuevoPagoProfesional && (
        <PagoProfesionalCajaModal
          fecha={fecha}
          profesionales={profesionales}
          onClose={() => setMostrarNuevoPagoProfesional(false)}
          onGuardado={async () => {
            await recargar();
            setMostrarNuevoPagoProfesional(false);
          }}
        />
      )}
    </main>
  );
}
