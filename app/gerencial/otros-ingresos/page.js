"use client";

import { useEffect, useState } from "react";
import SoloDuenaYContador from "@/components/SoloDuenaYContador";
import { fechaDeHoyISO } from "@/lib/agenda";
import { fechaHoraArgentina } from "@/lib/data/historialPagos";
import {
  MEDIOS_OTROS_INGRESOS,
  crearOtroIngreso,
  eliminarOtroIngreso,
  obtenerOtrosIngresos,
} from "@/lib/data/otrosIngresos";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function rangoDelMes(anio, mes) {
  const ultimo = new Date(anio, mes, 0).getDate();
  const mm = String(mes).padStart(2, "0");
  return { desde: `${anio}-${mm}-01`, hasta: `${anio}-${mm}-${String(ultimo).padStart(2, "0")}` };
}

function formatoFecha(fechaISO) {
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}

function formatoPesos(n) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

function NuevoIngresoModal({ fechaInicial, onClose, onGuardado }) {
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(fechaInicial);
  const [medioPago, setMedioPago] = useState("Transferencia");
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  async function guardar() {
    if (!concepto.trim()) return setError("Escribí de quién o por qué es el ingreso.");
    if (!monto || Number(monto) <= 0) return setError("Ingresá un monto válido.");
    if (!fecha) return setError("Elegí la fecha.");
    setGuardando(true);
    setError(null);
    try {
      await crearOtroIngreso({ fecha, concepto, monto, medioPago, observaciones });
      onGuardado();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">Nuevo ingreso</h2>
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

        <label className="mt-3 flex flex-col gap-1 text-xs text-gray-700">
          ¿De quién o por qué?
          <input
            autoFocus
            value={concepto}
            onChange={(e) => setConcepto(e.target.value)}
            placeholder="Ej. Scanner – panorámicas"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs text-gray-700">
            Monto
            <input type="number" min={0} value={monto} onChange={(e) => setMonto(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-700">
            Fecha
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
          </label>
        </div>

        <label className="mt-3 flex flex-col gap-1 text-xs text-gray-700">
          ¿Cómo lo pagaron?
          <select value={medioPago} onChange={(e) => setMedioPago(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm">
            {MEDIOS_OTROS_INGRESOS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-3 flex flex-col gap-1 text-xs text-gray-700">
          Observaciones (opcional)
          <input value={observaciones} onChange={(e) => setObservaciones(e.target.value)} className="rounded-md border border-gray-300 px-3 py-2 text-sm" />
        </label>

        <p className="mt-3 text-[11px] text-gray-500">
          Suma al ingreso de ese mes en Balance Mensual, Balance Anual, Tablero y Cierre de Mes. No toca la reserva ni la caja del día.
        </p>

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={guardar} disabled={guardando} className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50">
            {guardando ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function OtrosIngresosContenido() {
  const hoy = fechaDeHoyISO();
  const [anio, setAnio] = useState(Number(hoy.slice(0, 4)));
  const [mes, setMes] = useState(Number(hoy.slice(5, 7)));
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(false);

  const { desde, hasta } = rangoDelMes(anio, mes);

  useEffect(() => {
    let activo = true;
    obtenerOtrosIngresos(desde, hasta)
      .then((f) => {
        if (!activo) return;
        setFilas(f);
        setError(null);
      })
      .catch((e) => activo && setError(e.message))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, [desde, hasta]);

  function cambiarMes(delta) {
    setCargando(true);
    const nuevo = new Date(anio, mes - 1 + delta, 1);
    setAnio(nuevo.getFullYear());
    setMes(nuevo.getMonth() + 1);
  }

  async function recargar() {
    try {
      setFilas(await obtenerOtrosIngresos(desde, hasta));
    } catch (e) {
      setError(e.message);
    }
  }

  async function borrar(f) {
    if (!window.confirm(`¿Borrar el ingreso "${f.concepto}" de ${formatoPesos(f.monto)}? Va a la Papelera.`)) return;
    try {
      await eliminarOtroIngreso(f.id);
      await recargar();
    } catch (e) {
      setError(e.message);
    }
  }

  const total = filas.reduce((a, f) => a + f.monto, 0);

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-900">➕ Otros ingresos</h1>
        <button onClick={() => setModal(true)} className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark">
          + Nuevo ingreso
        </button>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Plata que entra a la clínica y no es de un paciente ni de ASOR (por ejemplo, lo que paga Scanner). Suma al ingreso del mes en
        Balance Mensual, Balance Anual, Tablero y Cierre de Mes.
      </p>

      <div className="mt-4 flex items-center gap-2">
        <button onClick={() => cambiarMes(-1)} className="rounded-md border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50">
          ← Mes anterior
        </button>
        <span className="min-w-36 text-center text-sm font-semibold text-gray-800">
          {MESES[mes - 1]} {anio}
        </span>
        <button onClick={() => cambiarMes(1)} className="rounded-md border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50">
          Mes siguiente →
        </button>
        <span className="ml-auto rounded-md bg-brand-tan/30 px-3 py-1 text-sm font-semibold text-brand-brown">Total del mes: {formatoPesos(total)}</span>
      </div>

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="bg-brand-brown text-white">
              <th className="px-3 py-2 text-left font-semibold">Fecha</th>
              <th className="px-3 py-2 text-left font-semibold">Concepto</th>
              <th className="px-3 py-2 text-left font-semibold">Medio</th>
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
            {!cargando && filas.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-4 text-center text-gray-500">
                  No hay otros ingresos cargados este mes.
                </td>
              </tr>
            )}
            {filas.map((f) => (
              <tr key={f.id} className="border-t border-gray-100 align-top">
                <td className="whitespace-nowrap px-3 py-2 tabular-nums text-gray-800">{formatoFecha(f.fecha)}</td>
                <td className="px-3 py-2 font-medium text-gray-900">
                  {f.concepto}
                  {f.observaciones && <span className="block text-[11px] font-normal text-gray-500">{f.observaciones}</span>}
                  <span className="block text-[11px] font-normal text-gray-400">
                    Cargado {fechaHoraArgentina(f.registradoEn)}
                    {f.registradoPor ? ` por ${f.registradoPor}` : ""}
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-600">{f.medioPago}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-emerald-700">+{formatoPesos(f.monto)}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => borrar(f)} className="text-xs text-red-600 hover:underline">
                    Borrar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <NuevoIngresoModal
          fechaInicial={hoy >= desde && hoy <= hasta ? hoy : desde}
          onClose={() => setModal(false)}
          onGuardado={() => {
            setModal(false);
            recargar();
          }}
        />
      )}
    </main>
  );
}

export default function OtrosIngresosPage() {
  return (
    <SoloDuenaYContador>
      <OtrosIngresosContenido />
    </SoloDuenaYContador>
  );
}
