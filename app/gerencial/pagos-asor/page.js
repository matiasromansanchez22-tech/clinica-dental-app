"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import ConciliarPagoAsorModal from "@/components/ConciliarPagoAsorModal";
import ImportarPdfAsorModal from "@/components/ImportarPdfAsorModal";
import NuevoPagoAsorModal from "@/components/NuevoPagoAsorModal";
import SoloDuenaYContador from "@/components/SoloDuenaYContador";
import { fechaDeHoyISO } from "@/lib/agenda";
import {
  eliminarFacturacionAsorPaciente,
  eliminarPagoAsor,
  eliminarRemitoAsor,
  obtenerFacturacionAsorPacientes,
  obtenerFichasVinculadasAPago,
  obtenerPagosAsor,
  obtenerRemitosAsor,
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
  const [remitos, setRemitos] = useState([]);
  const [obrasSocialesAbiertas, setObrasSocialesAbiertas] = useState(() => new Set());
  const [facturacionPacientes, setFacturacionPacientes] = useState([]);
  const [obrasSocialesPacAbiertas, setObrasSocialesPacAbiertas] = useState(() => new Set());
  const [pacientesAbiertos, setPacientesAbiertos] = useState(() => new Set());
  const [mostrarImportar, setMostrarImportar] = useState(false);

  const obrasSocialesExistentes = useMemo(
    () => [...new Set(facturacionPacientes.map((f) => f.obraSocial))].sort(),
    [facturacionPacientes]
  );

  async function recargar() {
    setCargando(true);
    try {
      const [data, remitosData, facturacionPacientesData] = await Promise.all([
        obtenerPagosAsor(fechaInicio, fechaFin),
        obtenerRemitosAsor(),
        obtenerFacturacionAsorPacientes(),
      ]);
      setPagos(data);
      setRemitos(remitosData);
      setFacturacionPacientes(facturacionPacientesData);
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

  function toggleObraSocial(obraSocial) {
    setObrasSocialesAbiertas((set) => {
      const nuevo = new Set(set);
      if (nuevo.has(obraSocial)) nuevo.delete(obraSocial);
      else nuevo.add(obraSocial);
      return nuevo;
    });
  }

  async function borrarRemito(remito) {
    if (!window.confirm(`¿Borrar el remito ${remito.numeroRemito} de "${remito.obraSocial}" ($${remito.pendienteLiquidar.toLocaleString("es-AR")})?`))
      return;
    try {
      await eliminarRemitoAsor(remito.id);
      setRemitos((r) => r.filter((x) => x.id !== remito.id));
    } catch (e) {
      setError(e.message);
    }
  }

  function toggleObraSocialPac(obraSocial) {
    setObrasSocialesPacAbiertas((set) => {
      const nuevo = new Set(set);
      if (nuevo.has(obraSocial)) nuevo.delete(obraSocial);
      else nuevo.add(obraSocial);
      return nuevo;
    });
  }

  function togglePaciente(clave) {
    setPacientesAbiertos((set) => {
      const nuevo = new Set(set);
      if (nuevo.has(clave)) nuevo.delete(clave);
      else nuevo.add(clave);
      return nuevo;
    });
  }

  async function borrarLineaFacturacion(linea) {
    if (!window.confirm(`¿Borrar esta línea de "${linea.paciente}" ($${linea.pendienteLiquidar.toLocaleString("es-AR")})?`)) return;
    try {
      await eliminarFacturacionAsorPaciente(linea.id);
      setFacturacionPacientes((f) => f.filter((x) => x.id !== linea.id));
    } catch (e) {
      setError(e.message);
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

      <h2 className="mt-8 mb-1 font-heading text-lg font-semibold text-brand-brown">Remitos pendientes de ASOR</h2>
      <p className="mb-3 text-sm text-gray-500">
        Lo que reporta ASOR por remito (no por paciente) — cuánto queda pendiente de liquidar, agrupado por obra
        social.
      </p>

      {(() => {
        const grupos = Object.values(
          remitos.reduce((acc, r) => {
            if (!acc[r.obraSocial]) acc[r.obraSocial] = { obraSocial: r.obraSocial, items: [] };
            acc[r.obraSocial].items.push(r);
            return acc;
          }, {})
        ).sort((a, b) => a.obraSocial.localeCompare(b.obraSocial));

        if (remitos.length === 0) {
          return <p className="text-sm text-gray-500">Todavía no cargaste ningún remito de ASOR.</p>;
        }

        return grupos.map((g) => {
          const abierto = obrasSocialesAbiertas.has(g.obraSocial);
          const totalPendiente = g.items.reduce((acc, r) => acc + r.pendienteLiquidar, 0);
          return (
            <div key={g.obraSocial} className="mt-3 overflow-hidden rounded-lg border border-gray-200">
              <button
                type="button"
                onClick={() => toggleObraSocial(g.obraSocial)}
                className="flex w-full items-center justify-between bg-brand-tan/20 px-4 py-3 text-left hover:bg-brand-tan/30"
              >
                <span className="font-heading text-sm font-semibold text-brand-brown">
                  {abierto ? "▾" : "▸"} {g.obraSocial}
                </span>
                <span className="text-xs text-gray-500">
                  {g.items.length} remito{g.items.length === 1 ? "" : "s"} — pendiente: $
                  {totalPendiente.toLocaleString("es-AR")}
                </span>
              </button>
              {abierto && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-brand-brown text-white">
                        <th className="px-3 py-2 text-left font-semibold">Plan</th>
                        <th className="px-3 py-2 text-left font-semibold">Período</th>
                        <th className="px-3 py-2 text-left font-semibold">Remito</th>
                        <th className="px-3 py-2 text-right font-semibold">Presupuestado</th>
                        <th className="px-3 py-2 text-right font-semibold">Descuentos</th>
                        <th className="px-3 py-2 text-right font-semibold">Pendiente</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.items.map((r) => (
                        <tr key={r.id} className="border-t border-gray-100">
                          <td className="px-3 py-2 text-gray-600">{r.plan || "—"}</td>
                          <td className="px-3 py-2 text-gray-600">{r.periodo}</td>
                          <td className="px-3 py-2 text-gray-600">{r.numeroRemito}</td>
                          <td className="px-3 py-2 text-right text-gray-600">
                            ${r.totalPresupuestado.toLocaleString("es-AR")}
                          </td>
                          <td className="px-3 py-2 text-right text-red-600">
                            ${r.descuentos.toLocaleString("es-AR")}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-gray-900">
                            ${r.pendienteLiquidar.toLocaleString("es-AR")}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button onClick={() => borrarRemito(r)} className="text-xs text-red-600 hover:underline">
                              Borrar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        });
      })()}

      <div className="mt-8 flex items-center justify-between">
        <h2 className="font-heading text-lg font-semibold text-brand-brown">
          Facturación detallada por paciente (ASOR)
        </h2>
        <button
          onClick={() => setMostrarImportar(true)}
          className="rounded-md border border-brand-brown/40 px-4 py-2 text-sm font-medium text-brand-brown hover:bg-brand-tan/30"
        >
          📄 Importar PDF (beta)
        </button>
      </div>
      <p className="mb-3 text-sm text-gray-500">
        El detalle línea por línea que manda ASOR, por paciente y prestación — separado de lo que se va facturando
        solo día a día en el consultorio, para cruzarlo más adelante.
      </p>

      {(() => {
        const grupos = Object.values(
          facturacionPacientes.reduce((acc, f) => {
            if (!acc[f.obraSocial]) acc[f.obraSocial] = { obraSocial: f.obraSocial, items: [] };
            acc[f.obraSocial].items.push(f);
            return acc;
          }, {})
        ).sort((a, b) => a.obraSocial.localeCompare(b.obraSocial));

        if (facturacionPacientes.length === 0) {
          return <p className="text-sm text-gray-500">Todavía no cargaste facturación detallada de ASOR.</p>;
        }

        return grupos.map((g) => {
          const abierto = obrasSocialesPacAbiertas.has(g.obraSocial);
          const totalPendiente = g.items.reduce((acc, f) => acc + f.pendienteLiquidar, 0);

          const pacientes = Object.values(
            g.items.reduce((acc, f) => {
              const clave = `${g.obraSocial}-${f.nroPresupuesto}`;
              if (!acc[clave]) acc[clave] = { clave, nroPresupuesto: f.nroPresupuesto, paciente: f.paciente, nroDoc: f.nroDoc, items: [] };
              acc[clave].items.push(f);
              return acc;
            }, {})
          ).sort((a, b) => a.paciente.localeCompare(b.paciente));

          return (
            <div key={g.obraSocial} className="mt-3 overflow-hidden rounded-lg border border-gray-200">
              <button
                type="button"
                onClick={() => toggleObraSocialPac(g.obraSocial)}
                className="flex w-full items-center justify-between bg-brand-tan/20 px-4 py-3 text-left hover:bg-brand-tan/30"
              >
                <span className="font-heading text-sm font-semibold text-brand-brown">
                  {abierto ? "▾" : "▸"} {g.obraSocial}
                </span>
                <span className="text-xs text-gray-500">
                  {pacientes.length} paciente{pacientes.length === 1 ? "" : "s"} — pendiente: $
                  {totalPendiente.toLocaleString("es-AR")}
                </span>
              </button>
              {abierto && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-brand-brown text-white">
                        <th className="px-2 py-2"></th>
                        <th className="px-3 py-2 text-left font-semibold">Paciente</th>
                        <th className="px-3 py-2 text-left font-semibold">DNI</th>
                        <th className="px-3 py-2 text-left font-semibold">N° Presup. ASOR</th>
                        <th className="px-3 py-2 text-right font-semibold">Pendiente</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pacientes.map((p) => {
                        const abiertoPaciente = pacientesAbiertos.has(p.clave);
                        const subtotal = p.items.reduce((acc, f) => acc + f.pendienteLiquidar, 0);
                        return (
                          <Fragment key={p.clave}>
                            <tr
                              onClick={() => togglePaciente(p.clave)}
                              className="cursor-pointer border-t border-gray-100 hover:bg-gray-50"
                            >
                              <td className="px-2 py-2 text-gray-400">{abiertoPaciente ? "▾" : "▸"}</td>
                              <td className="px-3 py-2 font-medium text-gray-900">{p.paciente}</td>
                              <td className="px-3 py-2 text-gray-600">{p.nroDoc || "—"}</td>
                              <td className="px-3 py-2 text-gray-600">{p.nroPresupuesto}</td>
                              <td className="px-3 py-2 text-right font-semibold text-gray-900">
                                ${subtotal.toLocaleString("es-AR")}
                              </td>
                            </tr>
                            {abiertoPaciente && (
                              <tr className="bg-gray-50">
                                <td></td>
                                <td colSpan={4} className="px-3 py-2">
                                  <ul className="flex flex-col gap-1 text-xs text-gray-600">
                                    {p.items.map((f) => (
                                      <li key={f.id} className="flex items-center justify-between">
                                        <span>
                                          {f.codigoPrestacion ? `[${f.codigoPrestacion}] ` : ""}
                                          {f.concepto} — ${f.totalPrestacion.toLocaleString("es-AR")}
                                        </span>
                                        <span className="flex items-center gap-2">
                                          <span
                                            className={f.pendienteLiquidar < 0 ? "text-red-600" : "text-gray-700"}
                                          >
                                            ${f.pendienteLiquidar.toLocaleString("es-AR")}
                                          </span>
                                          <button
                                            onClick={() => borrarLineaFacturacion(f)}
                                            className="text-red-600 hover:underline"
                                          >
                                            Borrar
                                          </button>
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        });
      })()}

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

      {mostrarImportar && (
        <ImportarPdfAsorModal
          obrasSocialesExistentes={obrasSocialesExistentes}
          facturacionExistente={facturacionPacientes}
          onClose={() => setMostrarImportar(false)}
          onGuardado={async () => {
            await recargar();
            setMostrarImportar(false);
          }}
        />
      )}
    </main>
  );
}

export default function PagosAsorPage() {
  return (
    <SoloDuenaYContador>
      <PagosAsorContenido />
    </SoloDuenaYContador>
  );
}
