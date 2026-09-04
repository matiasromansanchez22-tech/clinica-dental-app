"use client";

import { useEffect, useState } from "react";
import MovimientoPersonalFormModal from "@/components/MovimientoPersonalFormModal";
import RegistrarSueldoModal from "@/components/RegistrarSueldoModal";
import SoloDuena from "@/components/SoloDuena";
import { fechaDeHoyISO } from "@/lib/agenda";
import {
  eliminarMovimientoPersonal,
  obtenerMovimientosPersonales,
  obtenerSaldosPersonales,
} from "@/lib/data/finanzasPersonales";

const PANELES = [
  { id: "Consultorio", label: "🏥 Consultorio" },
  { id: "Personal", label: "🏠 Personal" },
];

function primerYUltimoDiaDelMes(fechaISO) {
  const [anio, mes] = fechaISO.split("-").map(Number);
  const primero = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const ultimoDia = new Date(anio, mes, 0).getDate();
  const ultimo = `${anio}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
  return { primero, ultimo };
}

function formatoPesos(n) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

function formatoFecha(fechaISO) {
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}

function FinanzasPersonalesContenido() {
  const hoy = fechaDeHoyISO();
  const { primero, ultimo } = primerYUltimoDiaDelMes(hoy);
  const [panel, setPanel] = useState("Consultorio");
  const [fechaInicio, setFechaInicio] = useState(primero);
  const [fechaFin, setFechaFin] = useState(ultimo);
  const [saldos, setSaldos] = useState({ Efectivo: 0, Banco: 0 });
  const [movimientos, setMovimientos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [mostrarSueldo, setMostrarSueldo] = useState(false);
  const [mostrarMovimiento, setMostrarMovimiento] = useState(false);

  async function recargar() {
    setCargando(true);
    setError(null);
    try {
      const [s, m] = await Promise.all([
        obtenerSaldosPersonales(panel),
        obtenerMovimientosPersonales({ fechaInicio, fechaFin, panel }),
      ]);
      setSaldos(s);
      setMovimientos(m);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel, fechaInicio, fechaFin]);

  function irAEsteMes() {
    setFechaInicio(primero);
    setFechaFin(ultimo);
  }

  async function borrar(mov) {
    const vinculado = mov.gastoId || mov.movimientoVinculadoId;
    const detalle = vinculado
      ? " (también se borran el sueldo y el gasto del consultorio vinculados a este movimiento)"
      : "";
    if (!window.confirm(`¿Borrar "${mov.categoria}" de $${mov.monto.toLocaleString("es-AR")}?${detalle}`)) return;
    try {
      await eliminarMovimientoPersonal(mov);
      await recargar();
    } catch (e) {
      setError(e.message);
    }
  }

  const totalIngresos = movimientos.filter((m) => m.tipo === "Ingreso").reduce((a, m) => a + m.monto, 0);
  const totalEgresos = movimientos.filter((m) => m.tipo === "Egreso").reduce((a, m) => a + m.monto, 0);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-900">💰 Consultorio y Personal</h1>
        <div className="flex flex-wrap gap-2">
          {panel === "Consultorio" && (
            <button
              onClick={() => setMostrarSueldo(true)}
              className="rounded-md border border-brand-brown/40 px-4 py-2 text-sm font-medium text-brand-brown hover:bg-brand-tan/30"
            >
              💰 Registrar sueldo
            </button>
          )}
          <button
            onClick={() => setMostrarMovimiento(true)}
            className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark"
          >
            + Nuevo movimiento
          </button>
        </div>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Dos cuentas separadas: la plata del consultorio, y la de Matías y Marianela una vez cobrado el sueldo.
      </p>

      <div className="mt-4 flex gap-2 border-b border-gray-200">
        {PANELES.map((p) => (
          <button
            key={p.id}
            onClick={() => setPanel(p.id)}
            className={`-mb-px rounded-t-md border-b-2 px-4 py-2 text-sm font-medium ${
              panel === p.id ? "border-brand-brown text-brand-brown" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs uppercase text-gray-400">💵 Efectivo</p>
          <p className="text-xl font-bold text-gray-900">{formatoPesos(saldos.Efectivo)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <p className="text-xs uppercase text-gray-400">🏦 Banco</p>
          <p className="text-xl font-bold text-gray-900">{formatoPesos(saldos.Banco)}</p>
        </div>
        <div className="rounded-lg bg-brand-brown px-4 py-3 text-white">
          <p className="text-xs uppercase text-white/70">Total disponible</p>
          <p className="text-xl font-bold">{formatoPesos(saldos.Efectivo + saldos.Banco)}</p>
        </div>
      </div>

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <button onClick={irAEsteMes} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
          Este mes
        </button>
        <input
          type="date"
          value={fechaInicio}
          onChange={(e) => setFechaInicio(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
        <span className="text-sm text-gray-500">a</span>
        <input
          type="date"
          value={fechaFin}
          onChange={(e) => setFechaFin(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-sm">
        <span className="rounded-md bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700">
          Ingresos del período: {formatoPesos(totalIngresos)}
        </span>
        <span className="rounded-md bg-red-50 px-3 py-1.5 font-medium text-red-700">
          Egresos del período: {formatoPesos(totalEgresos)}
        </span>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-brand-brown text-white">
              <th className="px-3 py-2 text-left font-semibold">Fecha</th>
              <th className="px-3 py-2 text-left font-semibold">Cuenta</th>
              <th className="px-3 py-2 text-left font-semibold">Categoría</th>
              <th className="px-3 py-2 text-right font-semibold">Monto</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-gray-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!cargando && movimientos.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-gray-500">
                  No hay movimientos en este período.
                </td>
              </tr>
            )}
            {movimientos.map((m) => (
              <tr key={m.id} className="border-t border-gray-100">
                <td className="px-3 py-2 text-gray-600">{formatoFecha(m.fecha)}</td>
                <td className="px-3 py-2 text-gray-600">{m.cuenta === "Efectivo" ? "💵" : "🏦"} {m.cuenta}</td>
                <td className="px-3 py-2 text-gray-900">
                  {m.categoria}
                  {m.descripcion && <p className="text-xs font-normal text-gray-500">{m.descripcion}</p>}
                </td>
                <td className={`px-3 py-2 text-right font-semibold ${m.tipo === "Ingreso" ? "text-emerald-600" : "text-red-600"}`}>
                  {m.tipo === "Ingreso" ? "+" : "-"}
                  {formatoPesos(m.monto)}
                </td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => borrar(m)} className="text-xs text-red-600 hover:underline">
                    Borrar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {mostrarSueldo && (
        <RegistrarSueldoModal
          onClose={() => setMostrarSueldo(false)}
          onGuardado={async () => {
            setMostrarSueldo(false);
            await recargar();
          }}
        />
      )}

      {mostrarMovimiento && (
        <MovimientoPersonalFormModal
          panel={panel}
          onClose={() => setMostrarMovimiento(false)}
          onGuardado={async () => {
            setMostrarMovimiento(false);
            await recargar();
          }}
        />
      )}
    </main>
  );
}

export default function FinanzasPersonalesPage() {
  return (
    <SoloDuena>
      <FinanzasPersonalesContenido />
    </SoloDuena>
  );
}
