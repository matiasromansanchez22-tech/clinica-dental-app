"use client";

import { useEffect, useState } from "react";
import CobroFormModal from "@/components/CobroFormModal";
import EditarCobroModal from "@/components/EditarCobroModal";
import GastoFormModal from "@/components/GastoFormModal";
import PagoProfesionalCajaModal from "@/components/PagoProfesionalCajaModal";
import TransferenciaCajaModal from "@/components/TransferenciaCajaModal";
import { useAuth } from "@/lib/auth/AuthProvider";
import { fechaDeHoyISO, sumarDias } from "@/lib/agenda";
import { desglosarPago, eliminarCobro, obtenerCobrosPorFecha } from "@/lib/data/caja";
import { obtenerPacientesActivos } from "@/lib/data/pacientes";
import { obtenerProfesionales } from "@/lib/data/profesionales";
import { eliminarGasto, obtenerCategoriasGasto, obtenerGastos } from "@/lib/data/gastos";
import { obtenerNombresLaboratoriosMecanicos } from "@/lib/data/mecanicosPrecios";
import { eliminarPagoProfesional, obtenerPagosProfesionales } from "@/lib/data/pagosProfesionales";
import { eliminarTransferenciaCaja, obtenerTransferenciasCajaPorFecha } from "@/lib/data/transferenciasCaja";
import { useRouter, useSearchParams } from "next/navigation";

export default function CajaPage() {
  const { perfil } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const esDuena = perfil?.rol === "Duena";
  const esContador = perfil?.rol === "Contador";
  const [fecha, setFecha] = useState(fechaDeHoyISO());
  const [pacienteParaCobrar, setPacienteParaCobrar] = useState(null);
  const [cobros, setCobros] = useState([]);
  const [gastos, setGastos] = useState([]);
  const [pagosProfesionales, setPagosProfesionales] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [profesionales, setProfesionales] = useState([]);
  const [categoriasGasto, setCategoriasGasto] = useState([]);
  const [laboratoriosSugeridos, setLaboratoriosSugeridos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [mostrarNuevoPago, setMostrarNuevoPago] = useState(false);
  const [mostrarNuevoPagoProfesional, setMostrarNuevoPagoProfesional] = useState(false);
  const [mostrarNuevaTransferencia, setMostrarNuevaTransferencia] = useState(false);
  const [transferencias, setTransferencias] = useState([]);
  const [cobroEnEdicion, setCobroEnEdicion] = useState(null);

  // Los sueldos (Registrar sueldo, en Consultorio) y las categorías
  // marcadas "sale de la reserva" (alquiler, impuestos, proveedores) no
  // salen de la plata que entró hoy: salen de la reserva acumulada en
  // Consultorio. Por eso no cuentan acá — la Caja del día es solo la
  // plata de hoy. Los gastos marcados "Ortodoncia" son de esa caja, no
  // de esta.
  function gastosDeEstaCaja(gastos, categoriasGastoLista) {
    const categoriasReserva = new Set(categoriasGastoLista.filter((c) => c.sale_de_reserva).map((c) => c.nombre));
    return gastos.filter(
      (g) => g.categoria !== "Sueldos" && !categoriasReserva.has(g.categoria) && g.especialidad !== "Ortodoncia"
    );
  }

  // Un pago a un profesional cuya especialidad es Ortodoncia pertenece a
  // esa caja, no a esta.
  function pagosDeEstaCaja(pagos) {
    return pagos.filter((p) => p.profesionalEspecialidad !== "Ortodoncia");
  }

  async function recargar() {
    const [c, g, pp, t] = await Promise.all([
      obtenerCobrosPorFecha(fecha),
      obtenerGastos(fecha, fecha),
      obtenerPagosProfesionales(fecha, fecha, { origen: "Caja" }),
      obtenerTransferenciasCajaPorFecha(fecha),
    ]);
    setCobros(c);
    setGastos(gastosDeEstaCaja(g, categoriasGasto));
    setPagosProfesionales(pagosDeEstaCaja(pp));
    setTransferencias(t);
  }

  useEffect(() => {
    setCargando(true);
    Promise.all([
      obtenerCobrosPorFecha(fecha),
      obtenerGastos(fecha, fecha),
      obtenerPagosProfesionales(fecha, fecha, { origen: "Caja" }),
      obtenerTransferenciasCajaPorFecha(fecha),
      obtenerPacientesActivos(),
      obtenerProfesionales(),
      obtenerCategoriasGasto(),
    ])
      .then(([c, g, pp, t, p, prof, cat]) => {
        setCobros(c);
        setGastos(gastosDeEstaCaja(g, cat));
        setPagosProfesionales(pagosDeEstaCaja(pp));
        setTransferencias(t);
        setPacientes(p);
        setProfesionales(prof);
        setCategoriasGasto(cat);
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fecha]);

  useEffect(() => {
    obtenerNombresLaboratoriosMecanicos()
      .then(setLaboratoriosSugeridos)
      .catch(() => {});
  }, []);

  // Entrada directa desde el aviso de "algo marcado en Agenda" — abre el
  // cobro con ese paciente ya elegido, sin que el secretario tenga que
  // buscarlo. Espera a que termine de cargar la lista de pacientes (si no,
  // el modal se abre antes de tiempo y no llega a pre-completarse solo).
  // Se limpia la URL después para que un F5 no lo vuelva a abrir.
  useEffect(() => {
    if (cargando) return;
    const pacienteId = searchParams.get("pacienteId");
    const abrir = searchParams.get("abrir");
    if (pacienteId && abrir) {
      setPacienteParaCobrar(pacienteId);
      setMostrarNuevo(true);
      router.replace("/caja");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargando]);

  // Una transferencia que ENTRA a esta caja suma como si fuera un cobro
  // más (es plata real que está disponible hoy); una que SALE resta como
  // un egreso más — así ninguna de las dos cajas queda con un número que
  // no se explica solo cuando una le presta plata a la otra.
  const transferenciasEntrantes = transferencias.filter((t) => t.destino === "General");
  const transferenciasSalientes = transferencias.filter((t) => t.origen === "General");

  const totalesPorMedio = cobros.reduce((acc, c) => {
    for (const parte of desglosarPago(c)) {
      acc[parte.medio] = (acc[parte.medio] || 0) + Number(parte.monto);
    }
    return acc;
  }, {});
  for (const t of transferenciasEntrantes) totalesPorMedio[t.medioPago] = (totalesPorMedio[t.medioPago] || 0) + t.monto;
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
    ...transferenciasSalientes.map((t) => ({
      id: t.id,
      tipo: "transferencia",
      etiqueta: `🔄 Transferencia a Caja Ortodoncia`,
      monto: t.monto,
      medioPago: t.medioPago,
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

  async function borrarTransferencia(t) {
    if (!window.confirm(`¿Borrar esta transferencia de $${Number(t.monto).toLocaleString("es-AR")}?`)) return;
    try {
      await eliminarTransferenciaCaja(t.id);
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
        <h1 className="text-2xl font-bold text-gray-900">Caja General{esContador && " (solo lectura)"}</h1>
        {!esContador && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setMostrarNuevoPagoProfesional(true)}
              className="rounded-md border border-brand-brown/40 px-2.5 py-1.5 text-xs font-medium text-brand-brown hover:bg-brand-tan/30"
            >
              💰 Pago a profesional
            </button>
            <button
              onClick={() => setMostrarNuevaTransferencia(true)}
              className="rounded-md border border-brand-brown/40 px-2.5 py-1.5 text-xs font-medium text-brand-brown hover:bg-brand-tan/30"
            >
              🔄 Transferencia entre cajas
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
        )}
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

      {transferenciasEntrantes.length > 0 && (
        <div className="mt-2 flex flex-col gap-1">
          {transferenciasEntrantes.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800"
            >
              <span>
                🔄 Transferencia recibida de Caja Ortodoncia ({t.medioPago}){t.observaciones ? ` — ${t.observaciones}` : ""}
              </span>
              <span className="flex items-center gap-3">
                <span className="font-medium">${t.monto.toLocaleString("es-AR")}</span>
                {!esContador && (
                  <button onClick={() => borrarTransferencia(t)} className="text-red-600 hover:underline">
                    Borrar
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

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
                  {!esContador && (
                    <button onClick={() => borrarGasto(g)} className="text-xs text-red-600 hover:underline">
                      Borrar
                    </button>
                  )}
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
                  {!esContador && (
                    <button onClick={() => borrarPagoProfesional(p)} className="text-xs text-red-600 hover:underline">
                      Borrar
                    </button>
                  )}
                </span>
              </li>
            ))}
            {transferenciasSalientes.map((t) => (
              <li key={`transferencia-${t.id}`} className="flex items-center justify-between border-t border-gray-100 px-3 py-2 text-sm">
                <span className="text-gray-700">
                  🔄 Transferencia a Caja Ortodoncia <span className="text-xs text-gray-400">({t.medioPago})</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-medium text-gray-900">${Number(t.monto).toLocaleString("es-AR")}</span>
                  {!esContador && (
                    <button onClick={() => borrarTransferencia(t)} className="text-xs text-red-600 hover:underline">
                      Borrar
                    </button>
                  )}
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
              <th className="px-3 py-2 text-left font-semibold">Profesional responsable</th>
              <th className="px-3 py-2 text-left font-semibold">Atendió</th>
              <th className="px-3 py-2 text-right font-semibold">Pago</th>
              <th className="px-3 py-2 text-left font-semibold">Medio</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-gray-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!cargando && cobros.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-gray-500">
                  No hay cobros registrados este día.
                </td>
              </tr>
            )}
            {cobros.map((c) => (
              <tr key={c.id} className="border-t border-gray-100">
                <td className="px-3 py-2 font-medium text-gray-900">
                  {c.paciente}
                  {c.precioAnterior && (
                    <span className="ml-1.5 text-xs font-normal text-amber-600" title="Cobrado con precio anterior: se liquida por lo cobrado, no por catálogo">
                      🕰️ precio anterior
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-gray-600">{c.cobertura}</td>
                <td className="px-3 py-2 text-gray-600">
                  {c.modalidad === "Plan de financiación"
                    ? `Plan ${c.idDocumento} · ${c.numeroCuota === "Anticipo" ? "Anticipo" : `Cuota ${c.numeroCuota}`}`
                    : c.prestaciones.map((p) => p.prestacion).join(", ")}
                </td>
                <td className="px-3 py-2 text-gray-500">{c.profesionalResponsable || "—"}</td>
                <td className="px-3 py-2 text-gray-600">{c.profesionalAtencion}</td>
                <td className="px-3 py-2 text-right text-gray-600">${Number(c.pago).toLocaleString("es-AR")}</td>
                <td className="px-3 py-2 text-gray-600">
                  {c.desglosePago?.length ? (
                    <span title={c.desglosePago.map((p) => `${p.medio}: $${Number(p.monto).toLocaleString("es-AR")}`).join(" + ")}>
                      Mixto ({c.desglosePago.map((p) => p.medio).join(" + ")})
                    </span>
                  ) : (
                    c.medioPago
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {esContador ? null : c.cerrado && !esDuena ? (
                    <span className="text-xs text-gray-400" title="El turno ya se cerró. Solo la Dueña puede reabrirlo.">
                      🔒 Cerrado
                    </span>
                  ) : (
                    <>
                      <button onClick={() => setCobroEnEdicion(c)} className="text-xs text-blue-600 hover:underline">
                        {c.cerrado ? "🔒 Editar" : "Editar"}
                      </button>
                      <button onClick={() => borrarCobro(c)} className="ml-3 text-xs text-red-600 hover:underline">
                        {c.cerrado ? "🔒 Borrar" : "Borrar"}
                      </button>
                    </>
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
          pacienteIdInicial={pacienteParaCobrar}
          onClose={() => {
            setMostrarNuevo(false);
            setPacienteParaCobrar(null);
          }}
          onCreado={async () => {
            await recargar();
            setMostrarNuevo(false);
            setPacienteParaCobrar(null);
          }}
        />
      )}

      {cobroEnEdicion && (
        <EditarCobroModal
          cobro={cobroEnEdicion}
          onClose={() => setCobroEnEdicion(null)}
          onGuardado={async () => {
            await recargar();
            setCobroEnEdicion(null);
          }}
        />
      )}

      {mostrarNuevoPago && (
        <GastoFormModal
          categorias={esDuena ? categoriasGasto : categoriasGasto.filter((c) => c.visible_secretarios)}
          especialidadInicial="General"
          laboratoriosSugeridos={laboratoriosSugeridos}
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
          profesionales={profesionales.filter((p) => p.especialidad !== "Ortodoncia")}
          onClose={() => setMostrarNuevoPagoProfesional(false)}
          onGuardado={async () => {
            await recargar();
            setMostrarNuevoPagoProfesional(false);
          }}
        />
      )}

      {mostrarNuevaTransferencia && (
        <TransferenciaCajaModal
          fecha={fecha}
          cajaActual="General"
          onClose={() => setMostrarNuevaTransferencia(false)}
          onGuardado={async () => {
            await recargar();
            setMostrarNuevaTransferencia(false);
          }}
        />
      )}
    </main>
  );
}
