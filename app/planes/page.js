"use client";

import { Fragment, useEffect, useState } from "react";
import RegistrarPagoHistoricoPlanModal from "@/components/RegistrarPagoHistoricoPlanModal";
import {
  actualizarTotalPlan,
  eliminarPagoHistoricoPlan,
  obtenerHistorialPagosPlan,
  obtenerPlanesFinanciacion,
} from "@/lib/data/presupuestos";

function formatoFecha(fechaISO) {
  if (!fechaISO) return "—";
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}

const ESTADO_COLOR = {
  Activo: "bg-emerald-100 text-emerald-700",
  Finalizado: "bg-blue-100 text-blue-700",
  Cancelado: "bg-gray-100 text-gray-500",
  "En Mora": "bg-red-100 text-red-600",
};

export default function PlanesPage() {
  const [planes, setPlanes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [expandido, setExpandido] = useState(null);
  const [historiales, setHistoriales] = useState({});
  const [mostrarPagoHistorico, setMostrarPagoHistorico] = useState(null);

  async function recargar() {
    const data = await obtenerPlanesFinanciacion();
    setPlanes(data);
  }

  useEffect(() => {
    recargar()
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  async function recargarHistorial(plan) {
    const historial = await obtenerHistorialPagosPlan(plan);
    setHistoriales((h) => ({ ...h, [plan.id]: historial }));
  }

  async function toggleExpandido(plan) {
    if (expandido === plan.id) {
      setExpandido(null);
      return;
    }
    setExpandido(plan.id);
    if (!historiales[plan.id]) {
      try {
        await recargarHistorial(plan);
      } catch (e) {
        setError(e.message);
      }
    }
  }

  async function editarTotalPlan(plan) {
    const actualTexto = String(Math.round(Number(plan.totalTratamiento)));
    const nuevoTexto = window.prompt(
      `Nuevo total del tratamiento para ${plan.paciente} (actual: $${Number(plan.totalTratamiento).toLocaleString("es-AR")}):`,
      actualTexto
    );
    if (nuevoTexto === null) return;
    const nuevoTotal = Number(nuevoTexto.replace(/[^\d.-]/g, ""));
    if (!nuevoTotal || nuevoTotal <= 0) {
      setError("El total tiene que ser un número mayor a 0.");
      return;
    }
    const motivo = window.prompt("¿Por qué se actualiza? (opcional, dejalo vacío si no hace falta)");
    if (motivo === null) return;
    try {
      await actualizarTotalPlan(plan, nuevoTotal, motivo.trim() || null);
      await recargar();
      if (historiales[plan.id]) await recargarHistorial(plan);
    } catch (e) {
      setError(e.message);
    }
  }

  async function borrarPagoHistorico(plan, entrada) {
    if (!window.confirm(`¿Borrar el pago histórico de $${Number(entrada.monto).toLocaleString("es-AR")}?`)) return;
    try {
      await eliminarPagoHistoricoPlan({ id: entrada.idOriginal, plan_id: plan.id });
      await recargar();
      await recargarHistorial(plan);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">Planes de Financiación</h1>
      <p className="mt-1 text-sm text-gray-500">
        Se crean solos al aceptar un presupuesto financiado. Los pagos se registran desde Caja — o, si ya se habían
        cobrado antes de usar la app, como pago histórico acá abajo.
      </p>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-brand-brown text-white">
              <th className="px-3 py-2 text-left font-semibold">N.º Plan</th>
              <th className="px-3 py-2 text-left font-semibold">Paciente</th>
              <th className="px-3 py-2 text-right font-semibold">Total</th>
              <th className="px-3 py-2 text-right font-semibold">Anticipo acordado</th>
              <th className="px-3 py-2 text-right font-semibold">Cuotas</th>
              <th className="px-3 py-2 text-right font-semibold">Valor cuota</th>
              <th className="px-3 py-2 text-right font-semibold">Saldo pendiente</th>
              <th className="px-3 py-2 text-left font-semibold">Estado</th>
              <th className="px-3 py-2 text-left font-semibold">Último pago</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr>
                <td colSpan={10} className="px-3 py-4 text-center text-gray-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!cargando && planes.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-4 text-center text-gray-500">
                  Todavía no hay planes de financiación.
                </td>
              </tr>
            )}
            {planes.map((p) => (
              <Fragment key={p.id}>
                <tr className="border-t border-gray-100">
                  <td onClick={() => toggleExpandido(p)} className="cursor-pointer px-3 py-2 font-medium text-gray-900">
                    {expandido === p.id ? "▾" : "▸"} {p.numeroPlan}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{p.paciente}</td>
                  <td className="px-3 py-2 text-right text-gray-600">
                    ${Number(p.totalTratamiento).toLocaleString("es-AR")}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-600">
                    ${Number(p.anticipoAcordado).toLocaleString("es-AR")}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-600">
                    {p.cuotasPagadas}/{p.cantidadCuotas}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-600">
                    ${Number(p.valorCuota).toLocaleString("es-AR")}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-600">
                    ${Number(p.saldoPendiente).toLocaleString("es-AR")}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_COLOR[p.estadoPlan]}`}>
                      {p.estadoPlan}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {p.fechaUltimoPago ? (
                      <>
                        {formatoFecha(p.fechaUltimoPago)}
                        {p.medioPagoUltimoPago && (
                          <span className="text-gray-400"> ({p.medioPagoUltimoPago})</span>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        onClick={() => editarTotalPlan(p)}
                        className="text-xs font-medium text-blue-600 hover:underline"
                      >
                        ✏️ Editar total
                      </button>
                      <button
                        onClick={() => setMostrarPagoHistorico(p)}
                        className="text-xs font-medium text-brand-brown hover:underline"
                      >
                        + Pago histórico
                      </button>
                    </div>
                  </td>
                </tr>
                {expandido === p.id && (
                  <tr className="bg-gray-50">
                    <td colSpan={10} className="px-3 py-2">
                      {p.observaciones && (
                        <div className="mb-2 whitespace-pre-line rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-500">
                          {p.observaciones}
                        </div>
                      )}
                      <p className="mb-1 text-xs font-semibold uppercase text-gray-400">Historial de pagos</p>
                      {!historiales[p.id] || historiales[p.id].length === 0 ? (
                        <p className="text-xs text-gray-500">Todavía no se registró ningún pago.</p>
                      ) : (
                        <ul className="flex flex-col gap-1 text-xs text-gray-600">
                          {historiales[p.id].map((h) => (
                            <li key={h.id} className="flex items-center justify-between">
                              <span>
                                {formatoFecha(h.fecha)} — ${Number(h.monto).toLocaleString("es-AR")}
                                {h.medioPago ? ` · ${h.medioPago}` : ""}
                                {" · "}
                                <span className={h.origen === "Caja" ? "text-emerald-600" : "text-gray-400"}>
                                  {h.origen === "Caja" ? "Cobrado en Caja" : "Pago histórico"}
                                </span>
                                {h.observaciones ? ` — ${h.observaciones}` : ""}
                              </span>
                              {h.origen === "Histórico" && (
                                <button
                                  onClick={() => borrarPagoHistorico(p, h)}
                                  className="text-red-600 hover:underline"
                                >
                                  Borrar
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {mostrarPagoHistorico && (
        <RegistrarPagoHistoricoPlanModal
          plan={mostrarPagoHistorico}
          onClose={() => setMostrarPagoHistorico(null)}
          onGuardado={async () => {
            await recargar();
            await recargarHistorial(mostrarPagoHistorico);
            setMostrarPagoHistorico(null);
            setExpandido(mostrarPagoHistorico.id);
          }}
        />
      )}
    </main>
  );
}
