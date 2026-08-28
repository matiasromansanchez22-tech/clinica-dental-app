"use client";

import { useEffect, useState } from "react";
import ConciliarPagoAsorModal from "@/components/ConciliarPagoAsorModal";
import NuevoPagoAsorModal from "@/components/NuevoPagoAsorModal";
import SoloDuena from "@/components/SoloDuena";
import { fechaDeHoyISO } from "@/lib/agenda";
import {
  eliminarPagoAsor,
  obtenerFichasVinculadasAPago,
  obtenerPagosAsor,
} from "@/lib/data/facturacionObrasSociales";

function primerYUltimoDiaDelMes(fechaISO) {
  const [anio, mes] = fechaISO.split("-").map(Number);
  const primero = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const ultimoDia = new Date(anio, mes, 0).getDate();
  const ultimo = `${anio}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
  return { primero, ultimo };
}

function PagosAsorContenido() {
  const hoy = fechaDeHoyISO();
  const [fechaInicio, setFechaInicio] = useState(() => primerYUltimoDiaDelMes(hoy).primero);
  const [fechaFin, setFechaFin] = useState(() => primerYUltimoDiaDelMes(hoy).ultimo);
  const [pagos, setPagos] = useState([]);
  const [vinculadosPorPago, setVinculadosPorPago] = useState({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [conciliando, setConciliando] = useState(null);

  async function recargar() {
    setCargando(true);
    try {
      const data = await obtenerPagosAsor(fechaInicio, fechaFin);
      setPagos(data);
      const detalle = {};
      await Promise.all(
        data.map(async (p) => {
          const fichas = await obtenerFichasVinculadasAPago(p.id);
          detalle[p.id] = fichas;
        })
      );
      setVinculadosPorPago(detalle);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaInicio, fechaFin]);

  function irAEsteMes() {
    const { primero, ultimo } = primerYUltimoDiaDelMes(hoy);
    setFechaInicio(primero);
    setFechaFin(ultimo);
  }

  async function borrarPago(pago) {
    if (
      !window.confirm(
        `¿Borrar el pago de $${Number(pago.monto).toLocaleString("es-AR")} del ${pago.fecha}? Las fichas vinculadas vuelven a quedar "Entregada", pendientes de conciliar.`
      )
    )
      return;
    try {
      await eliminarPagoAsor(pago.id);
      await recargar();
    } catch (e) {
      setError(e.message);
    }
  }

  const totalTransferido = pagos.reduce((acc, p) => acc + p.monto, 0);

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Pagos ASOR</h1>
        <button
          onClick={() => setMostrarNuevo(true)}
          className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark"
        >
          + Nuevo pago ASOR
        </button>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Cada transferencia que te avisa ASOR, conciliada contra las fichas de facturación que cubre — para saber si
        coincide lo que te pagaron con lo que corresponde.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
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
        <div className="ml-auto rounded-md bg-brand-brown px-3 py-2 text-sm text-white">
          Total transferido: <span className="font-semibold">${totalTransferido.toLocaleString("es-AR")}</span>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-brand-brown text-white">
              <th className="px-3 py-2 text-left font-semibold">Fecha</th>
              <th className="px-3 py-2 text-right font-semibold">Monto transferido</th>
              <th className="px-3 py-2 text-right font-semibold">Fichas vinculadas</th>
              <th className="px-3 py-2 text-right font-semibold">Total vinculado</th>
              <th className="px-3 py-2 text-left font-semibold">Estado</th>
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
            {!cargando && pagos.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-gray-500">
                  No hay pagos de ASOR registrados en este período.
                </td>
              </tr>
            )}
            {pagos.map((p) => {
              const fichas = vinculadosPorPago[p.id] || [];
              const totalVinculado = fichas.reduce((acc, f) => acc + f.valorOS, 0);
              const coincide = Math.abs(p.monto - totalVinculado) < 1;
              return (
                <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-600">{p.fecha}</td>
                  <td className="px-3 py-2 text-right font-medium text-gray-900">
                    ${p.monto.toLocaleString("es-AR")}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-600">{fichas.length}</td>
                  <td className="px-3 py-2 text-right text-gray-600">${totalVinculado.toLocaleString("es-AR")}</td>
                  <td className="px-3 py-2">
                    {fichas.length === 0 ? (
                      <span className="text-amber-600">Sin conciliar</span>
                    ) : coincide ? (
                      <span className="text-brand-green">✅ Coincide</span>
                    ) : (
                      <span className="text-red-600">
                        Diferencia ${(p.monto - totalVinculado).toLocaleString("es-AR")}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setConciliando(p)} className="text-xs font-medium text-brand-brown hover:underline">
                        Conciliar
                      </button>
                      <button onClick={() => borrarPago(p)} className="text-xs text-red-600 hover:underline">
                        Borrar
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {mostrarNuevo && (
        <NuevoPagoAsorModal
          onClose={() => setMostrarNuevo(false)}
          onGuardado={(pago) => {
            setMostrarNuevo(false);
            recargar();
            setConciliando(pago);
          }}
        />
      )}

      {conciliando && (
        <ConciliarPagoAsorModal
          pago={conciliando}
          onClose={() => setConciliando(null)}
          onGuardado={async () => {
            await recargar();
            setConciliando(null);
          }}
        />
      )}
    </main>
  );
}

export default function PagosAsorPage() {
  return (
    <SoloDuena>
      <PagosAsorContenido />
    </SoloDuena>
  );
}
