"use client";

import { Fragment, useEffect, useState } from "react";
import RegistrarPagoProfesionalModal from "@/components/RegistrarPagoProfesionalModal";
import SoloDuena from "@/components/SoloDuena";
import { fechaDeHoyISO, sumarDias } from "@/lib/agenda";
import {
  eliminarPagoProfesional,
  obtenerPagosProfesionales,
  obtenerTotalPagadoPorProfesional,
} from "@/lib/data/pagosProfesionales";
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
  const [pagadoPorProfesional, setPagadoPorProfesional] = useState({});
  const [pagosDelPeriodo, setPagosDelPeriodo] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [expandido, setExpandido] = useState(null);
  const [modalPago, setModalPago] = useState(null); // { fila, tipo, montoSugerido }

  async function recargar() {
    setCargando(true);
    try {
      const [data, pagado, pagos] = await Promise.all([
        obtenerProduccionPorProfesional(fechaInicio, fechaFin),
        obtenerTotalPagadoPorProfesional(fechaInicio, fechaFin),
        obtenerPagosProfesionales(fechaInicio, fechaFin),
      ]);
      setFilas(data);
      setPagadoPorProfesional(pagado);
      setPagosDelPeriodo(pagos);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  async function borrarPago(pago) {
    if (!window.confirm(`¿Borrar el pago de $${pago.monto.toLocaleString("es-AR")} a ${pago.profesional}?`)) return;
    try {
      await eliminarPagoProfesional(pago.id);
      await recargar();
    } catch (e) {
      setError(e.message);
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
            ? { ...f, porcentajeCopago: valor, honorariosCopago: f.totalCopago * (valor / 100), aLiquidar: f.totalCopago * (valor / 100) }
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
            ? { ...f, porcentajeOS: valor, honorariosOS: f.totalValorOS * (valor / 100) }
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
  const totalHonorariosOS = filas.reduce((acc, f) => acc + f.honorariosOS, 0);
  const totalAtenciones = filas.reduce((acc, f) => acc + f.cantidadAtenciones, 0);
  const totalPagado = pagosDelPeriodo.reduce((acc, p) => acc + p.monto, 0);

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">Producción y liquidación por profesional</h1>
      <p className="mt-1 text-sm text-gray-500">
        Cuánto atendió cada profesional este período (Odontología General + Ortodoncia). Lo que se liquida en el día
        es el % sobre el valor de catálogo de las prestaciones que cada uno cargó (no sobre lo que terminó pagando el
        paciente) — las cuotas de plan de financiación se liquidan por lo cobrado en esa cuota. La parte de obra
        social se liquida a mes vencido, recién cuando la clínica cobra del intermediario, y se muestra aparte como
        pendiente.
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
        <div className="rounded-md border border-brand-tan bg-brand-tan/20 px-3 py-2 text-sm text-brand-brown">
          Pendiente O.Social (mes vencido): <span className="font-semibold">${totalHonorariosOS.toLocaleString("es-AR")}</span>
        </div>
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Ya pagado este período: <span className="font-semibold">${totalPagado.toLocaleString("es-AR")}</span>
        </div>
        <div className="ml-auto rounded-md bg-brand-brown px-3 py-2 text-sm text-white">
          A liquidar hoy: <span className="font-semibold">${totalALiquidar.toLocaleString("es-AR")}</span>
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
              <th className="px-3 py-2 text-right font-semibold">A liquidar hoy</th>
              <th className="px-3 py-2 text-right font-semibold">Valor O.Social</th>
              <th className="px-2 py-2 text-center font-semibold">% O.Social</th>
              <th className="px-3 py-2 text-right font-semibold">Pendiente O.Social (mes vencido)</th>
              <th className="px-3 py-2 text-left font-semibold">Pagos</th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr>
                <td colSpan={9} className="px-3 py-4 text-center text-gray-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!cargando && filas.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-4 text-center text-gray-500">
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
                  <td className="px-3 py-2 text-right font-semibold text-emerald-700">
                    ${f.aLiquidar.toLocaleString("es-AR")}
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
                  <td className="px-3 py-2 text-right font-semibold text-brand-brown">
                    {f.honorariosOS > 0 ? `$${f.honorariosOS.toLocaleString("es-AR")}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs" onClick={(e) => e.stopPropagation()}>
                    {f.profesionalId === "sin-asignar" ? (
                      "—"
                    ) : (
                      (() => {
                        const pagado = pagadoPorProfesional[f.profesionalId] || { copago: 0, obraSocial: 0 };
                        const pendienteCopago = Math.max(f.aLiquidar - pagado.copago, 0);
                        const pendienteOS = Math.max(f.honorariosOS - pagado.obraSocial, 0);
                        return (
                          <div className="flex flex-col gap-1">
                            {pagado.copago > 0 && (
                              <span className="text-gray-500">Pagado copago: ${Math.round(pagado.copago).toLocaleString("es-AR")}</span>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setModalPago({ fila: f, tipo: "Copago", montoSugerido: pendienteCopago })
                              }
                              className="w-fit text-brand-brown hover:underline"
                            >
                              💵 Pagar copago{pendienteCopago > 0 ? ` ($${Math.round(pendienteCopago).toLocaleString("es-AR")})` : ""}
                            </button>
                            {pagado.obraSocial > 0 && (
                              <span className="text-gray-500">Pagado O.Social: ${Math.round(pagado.obraSocial).toLocaleString("es-AR")}</span>
                            )}
                            {f.honorariosOS > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setModalPago({ fila: f, tipo: "Obra Social", montoSugerido: pendienteOS })
                                }
                                className="w-fit text-brand-brown hover:underline"
                              >
                                💵 Pagar O.Social{pendienteOS > 0 ? ` ($${Math.round(pendienteOS).toLocaleString("es-AR")})` : ""}
                              </button>
                            )}
                          </div>
                        );
                      })()
                    )}
                  </td>
                </tr>
                {expandido === f.profesionalId && (
                  <tr className="bg-gray-50">
                    <td colSpan={9} className="px-3 py-2">
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
        "A liquidar hoy" es solo el % sobre el valor de catálogo de lo cargado como copago/particular en el período.
        La columna "Pendiente O.Social
        (mes vencido)" se calcula sobre lo facturado al intermediario y se liquida recién a mes vencido, cuando la
        clínica cobra esa parte — no está incluida en el total de hoy.
      </p>

      <h2 className="mt-8 mb-2 font-heading text-sm font-semibold text-brand-brown">
        Pagos registrados este período ({pagosDelPeriodo.length})
      </h2>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-brand-brown text-white">
              <th className="px-3 py-2 text-left font-semibold">Fecha</th>
              <th className="px-3 py-2 text-left font-semibold">Profesional</th>
              <th className="px-3 py-2 text-left font-semibold">Tipo</th>
              <th className="px-3 py-2 text-right font-semibold">Monto</th>
              <th className="px-3 py-2 text-left font-semibold">Medio</th>
              <th className="px-3 py-2 text-left font-semibold">Observaciones</th>
              <th className="px-3 py-2"></th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {pagosDelPeriodo.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-gray-500">
                  Todavía no se registró ningún pago a profesionales en este período.
                </td>
              </tr>
            )}
            {pagosDelPeriodo.map((p) => (
              <tr key={p.id} className="border-t border-gray-100">
                <td className="px-3 py-2 text-gray-600">{p.fecha}</td>
                <td className="px-3 py-2 font-medium text-gray-900">{p.profesional}</td>
                <td className="px-3 py-2 text-gray-600">{p.tipo}</td>
                <td className="px-3 py-2 text-right text-gray-600">${p.monto.toLocaleString("es-AR")}</td>
                <td className="px-3 py-2 text-gray-600">{p.medioPago}</td>
                <td className="px-3 py-2 text-gray-500">{p.observaciones || "—"}</td>
                <td className="px-3 py-2 text-xs">
                  {p.cerrado ? <span className="text-gray-400">🔒</span> : null}
                </td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => borrarPago(p)} className="text-xs text-red-600 hover:underline">
                    {p.cerrado ? "🔒 Borrar" : "Borrar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modalPago && (
        <RegistrarPagoProfesionalModal
          profesional={modalPago.fila}
          tipo={modalPago.tipo}
          montoSugerido={modalPago.montoSugerido}
          onClose={() => setModalPago(null)}
          onGuardado={async () => {
            await recargar();
            setModalPago(null);
          }}
        />
      )}
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
