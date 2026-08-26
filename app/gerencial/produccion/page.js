"use client";

import { Fragment, useEffect, useState } from "react";
import SoloDuena from "@/components/SoloDuena";
import { fechaDeHoyISO, sumarDias } from "@/lib/agenda";
import { obtenerProduccionPorProfesional } from "@/lib/data/produccionProfesionales";
import { actualizarPorcentajeHonorariosCopago, actualizarPorcentajeHonorariosOS } from "@/lib/data/profesionales";

function primerYUltimoDiaDelMes(fechaISO) {
  const [anio, mes] = fechaISO.split("-").map(Number);
  const primero = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const ultimoDia = new Date(anio, mes, 0).getDate();
  const ultimo = `${anio}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
  return { primero, ultimo };
}

function ProduccionPorProfesionalContenido() {
  const hoy = fechaDeHoyISO();
  const [fechaInicio, setFechaInicio] = useState(hoy);
  const [fechaFin, setFechaFin] = useState(hoy);
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [expandido, setExpandido] = useState(null);

  async function recargar() {
    setCargando(true);
    try {
      const data = await obtenerProduccionPorProfesional(fechaInicio, fechaFin);
      setFilas(data);
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

  function irAHoy() {
    setFechaInicio(hoy);
    setFechaFin(hoy);
  }

  function irAEsteMes() {
    const { primero, ultimo } = primerYUltimoDiaDelMes(hoy);
    setFechaInicio(primero);
    setFechaFin(ultimo);
  }

  async function guardarPorcentajeCopago(fila, valor) {
    if (fila.profesionalId === "sin-asignar") return;
    try {
      await actualizarPorcentajeHonorariosCopago(fila.profesionalId, valor);
      setFilas((fs) =>
        fs.map((f) =>
          f.profesionalId === fila.profesionalId
            ? { ...f, porcentajeCopago: valor, honorariosCopago: f.totalCopago * (valor / 100), aLiquidar: f.totalCopago * (valor / 100) + f.honorariosOS }
            : f
        )
      );
    } catch (e) {
      setError(e.message);
    }
  }

  async function guardarPorcentajeOS(fila, valor) {
    if (fila.profesionalId === "sin-asignar") return;
    try {
      await actualizarPorcentajeHonorariosOS(fila.profesionalId, valor);
      setFilas((fs) =>
        fs.map((f) =>
          f.profesionalId === fila.profesionalId
            ? { ...f, porcentajeOS: valor, honorariosOS: f.totalValorOS * (valor / 100), aLiquidar: f.honorariosCopago + f.totalValorOS * (valor / 100) }
            : f
        )
      );
    } catch (e) {
      setError(e.message);
    }
  }

  const totalCopago = filas.reduce((acc, f) => acc + f.totalCopago, 0);
  const totalValorOS = filas.reduce((acc, f) => acc + f.totalValorOS, 0);
  const totalALiquidar = filas.reduce((acc, f) => acc + f.aLiquidar, 0);
  const totalAtenciones = filas.reduce((acc, f) => acc + f.cantidadAtenciones, 0);

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">Producción y liquidación por profesional</h1>
      <p className="mt-1 text-sm text-gray-500">
        Cuánto atendió cada profesional este período (Odontología General + Ortodoncia). Se liquida un % sobre lo
        cobrado en el día (copago/particular) y otro % sobre lo facturado a obras sociales.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button onClick={irAHoy} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
          Hoy
        </button>
        <button
          onClick={irAEsteMes}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          Este mes
        </button>
        <button
          onClick={() => {
            setFechaInicio((f) => sumarDias(f, -1));
            setFechaFin((f) => sumarDias(f, -1));
          }}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm hover:bg-gray-50"
          title="Solo si el rango es de un solo día"
        >
          ←
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
        <button
          onClick={() => {
            setFechaInicio((f) => sumarDias(f, 1));
            setFechaFin((f) => sumarDias(f, 1));
          }}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm hover:bg-gray-50"
          title="Solo si el rango es de un solo día"
        >
          →
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        <div className="rounded-md border border-gray-200 px-3 py-2 text-sm">
          <span className="text-gray-500">Atenciones: </span>
          <span className="font-semibold text-gray-900">{totalAtenciones}</span>
        </div>
        <div className="rounded-md border border-gray-200 px-3 py-2 text-sm">
          <span className="text-gray-500">Copago/particular: </span>
          <span className="font-semibold text-gray-900">${totalCopago.toLocaleString("es-AR")}</span>
        </div>
        <div className="rounded-md border border-gray-200 px-3 py-2 text-sm">
          <span className="text-gray-500">Facturado a O.Social: </span>
          <span className="font-semibold text-gray-900">${totalValorOS.toLocaleString("es-AR")}</span>
        </div>
        <div className="ml-auto rounded-md bg-brand-brown px-3 py-2 text-sm text-white">
          A liquidar: <span className="font-semibold">${totalALiquidar.toLocaleString("es-AR")}</span>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-brand-brown text-white">
              <th className="px-3 py-2 text-left font-semibold">Profesional</th>
              <th className="px-2 py-2 text-center font-semibold">Atenciones</th>
              <th className="px-3 py-2 text-right font-semibold">Copago</th>
              <th className="px-2 py-2 text-center font-semibold">% Copago</th>
              <th className="px-3 py-2 text-right font-semibold">Valor O.Social</th>
              <th className="px-2 py-2 text-center font-semibold">% O.Social</th>
              <th className="px-3 py-2 text-right font-semibold">A liquidar</th>
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
            {!cargando && filas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-gray-500">
                  No hay cobros registrados en este período.
                </td>
              </tr>
            )}
            {filas.map((f) => (
              <Fragment key={f.profesionalId}>
                <tr
                  onClick={() => setExpandido((e) => (e === f.profesionalId ? null : f.profesionalId))}
                  className="cursor-pointer border-t border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-3 py-2 font-medium text-gray-900">
                    {expandido === f.profesionalId ? "▾" : "▸"} {f.nombre}
                    <div className="text-xs font-normal text-gray-400">{f.especialidad}</div>
                  </td>
                  <td className="px-2 py-2 text-center text-gray-600">{f.cantidadAtenciones}</td>
                  <td className="px-3 py-2 text-right text-gray-600">${f.totalCopago.toLocaleString("es-AR")}</td>
                  <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                    {f.profesionalId === "sin-asignar" ? (
                      "—"
                    ) : (
                      <input
                        type="number"
                        defaultValue={f.porcentajeCopago}
                        onBlur={(e) => guardarPorcentajeCopago(f, Number(e.target.value))}
                        className="w-16 rounded-md border border-gray-300 px-1 py-0.5 text-center"
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-600">
                    {f.totalValorOS > 0 ? `$${f.totalValorOS.toLocaleString("es-AR")}` : "—"}
                  </td>
                  <td className="px-2 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                    {f.profesionalId === "sin-asignar" || f.especialidad === "Ortodoncia" ? (
                      "—"
                    ) : (
                      <input
                        type="number"
                        defaultValue={f.porcentajeOS}
                        onBlur={(e) => guardarPorcentajeOS(f, Number(e.target.value))}
                        className="w-16 rounded-md border border-gray-300 px-1 py-0.5 text-center"
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-emerald-700">
                    ${f.aLiquidar.toLocaleString("es-AR")}
                  </td>
                </tr>
                {expandido === f.profesionalId && (
                  <tr className="bg-gray-50">
                    <td colSpan={7} className="px-3 py-2">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-500">
                            <th className="px-2 py-1 text-left font-medium">Fecha</th>
                            <th className="px-2 py-1 text-left font-medium">Paciente</th>
                            <th className="px-2 py-1 text-left font-medium">Prestación / concepto</th>
                            <th className="px-2 py-1 text-left font-medium">Tipo</th>
                            <th className="px-2 py-1 text-right font-medium">Monto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {f.detalle.map((d, i) => (
                            <tr key={i} className="border-t border-gray-200">
                              <td className="px-2 py-1">{d.fecha}</td>
                              <td className="px-2 py-1">{d.paciente}</td>
                              <td className="px-2 py-1">{d.concepto}</td>
                              <td className="px-2 py-1 text-gray-500">{d.tipo}</td>
                              <td className="px-2 py-1 text-right">${d.monto.toLocaleString("es-AR")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-gray-500">
        El monto de obra social se calcula sobre lo facturado al intermediario, no sobre lo efectivamente cobrado —
        tenelo en cuenta si liquidás esa parte recién cuando la clínica cobra.
      </p>
    </main>
  );
}

export default function ProduccionPorProfesionalPage() {
  return (
    <SoloDuena>
      <ProduccionPorProfesionalContenido />
    </SoloDuena>
  );
}
