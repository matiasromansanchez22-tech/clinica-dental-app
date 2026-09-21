"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PresupuestoFormModal from "@/components/PresupuestoFormModal";
import { obtenerConfiguracionGeneral } from "@/lib/data/configuracionGeneral";
import { obtenerCatalogo } from "@/lib/data/catalogo";
import { obtenerPacientesActivos } from "@/lib/data/pacientes";
import { obtenerProfesionales } from "@/lib/data/profesionales";
import {
  aceptarPresupuestoConPrioridad,
  cambiarEstadoPresupuesto,
  obtenerPresupuestos,
  obtenerPresupuestosPendientesConPagos,
  obtenerPresupuestosSinRespuesta,
} from "@/lib/data/presupuestos";
import { obtenerObrasSociales } from "@/lib/data/nomenclador";
import { linkWhatsApp, mensajeSeguimientoPresupuesto } from "@/lib/whatsapp";

const ESTADO_COLOR = {
  Pendiente: "bg-gray-100 text-gray-600",
  Aceptado: "bg-emerald-100 text-emerald-700",
  Anulado: "bg-red-100 text-red-600",
};

export default function PresupuestosPage() {
  const [presupuestos, setPresupuestos] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [profesionales, setProfesionales] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [obrasSociales, setObrasSociales] = useState([]);
  const [config, setConfig] = useState({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [presupuestoEnEdicion, setPresupuestoEnEdicion] = useState(null);
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [procesando, setProcesando] = useState(null);
  const [pendientesConPagos, setPendientesConPagos] = useState([]);
  const [sinRespuesta, setSinRespuesta] = useState([]);
  const [busqueda, setBusqueda] = useState("");

  async function recargar() {
    const [data, avisos, seguimiento] = await Promise.all([
      obtenerPresupuestos(),
      obtenerPresupuestosPendientesConPagos(),
      obtenerPresupuestosSinRespuesta(),
    ]);
    setPresupuestos(data);
    setPendientesConPagos(avisos);
    setSinRespuesta(seguimiento);
  }

  useEffect(() => {
    Promise.all([
      obtenerPresupuestos(),
      obtenerPacientesActivos(),
      obtenerProfesionales(),
      obtenerCatalogo(),
      obtenerConfiguracionGeneral(),
      obtenerObrasSociales(),
      obtenerPresupuestosPendientesConPagos(),
      obtenerPresupuestosSinRespuesta(),
    ])
      .then(([p, pac, prof, cat, conf, os, avisos, seguimiento]) => {
        setPresupuestos(p);
        setPacientes(pac);
        setProfesionales(prof);
        setCatalogo(cat.filter((c) => c.estado === "Activo"));
        setConfig(conf);
        setObrasSociales(os);
        setPendientesConPagos(avisos);
        setSinRespuesta(seguimiento);
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  const idsConAviso = new Set(pendientesConPagos.map((a) => a.id));

  const presupuestosFiltrados = presupuestos.filter((p) => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return true;
    return p.paciente.toLowerCase().includes(termino) || p.numero.toLowerCase().includes(termino);
  });

  async function handleCambiarEstado(presupuesto, nuevoEstado) {
    if (nuevoEstado === "Anulado" && !window.confirm("¿Anular este presupuesto? El plan de financiación asociado (si existe) se va a cancelar, pero conserva su historial.")) {
      return;
    }
    setProcesando(presupuesto.id);
    setError(null);
    try {
      await cambiarEstadoPresupuesto(presupuesto, nuevoEstado);
      await recargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setProcesando(null);
    }
  }

  async function handleAceptarPrioridad(presupuesto, totalPrioridad) {
    if (
      !window.confirm(
        `¿El paciente aceptó solo lo prioritario (⭐), por $${totalPrioridad.toLocaleString("es-AR")} en vez del presupuesto completo de $${Number(presupuesto.total).toLocaleString("es-AR")}? El plan de financiación se arma con ese monto reducido.`
      )
    ) {
      return;
    }
    setProcesando(presupuesto.id);
    setError(null);
    try {
      await aceptarPresupuestoConPrioridad(presupuesto, config);
      await recargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setProcesando(null);
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Presupuestos</h1>
        <button
          onClick={() => setMostrarNuevo(true)}
          className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark"
        >
          + Nuevo presupuesto
        </button>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Para pacientes particulares usa la lista de precios; para pacientes con obra social usa el copago que le
        corresponde pagar según el Nomenclador.
      </p>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      {sinRespuesta.length > 0 && (
        <div className="mt-4 rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          <p className="font-medium">
            🔔 Seguimiento: {sinRespuesta.length} presupuesto{sinRespuesta.length === 1 ? "" : "s"} sin respuesta hace
            5 días o más — antes de que se pierda la venta, llamalo.
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {sinRespuesta.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-2">
                <span
                  onClick={() => setPresupuestoEnEdicion(p)}
                  className="cursor-pointer font-medium hover:underline"
                >
                  {p.numero} · {p.paciente}
                </span>
                <span>
                  — {p.diasSinRespuesta} días sin respuesta · ${Number(p.total).toLocaleString("es-AR")}
                </span>
                {p.pacienteCelular && (
                  <>
                    <a href={`tel:${p.pacienteCelular}`} className="font-medium text-blue-700 hover:underline">
                      📞 {p.pacienteCelular}
                    </a>
                    {linkWhatsApp(p.pacienteCelular) && (
                      <a
                        href={linkWhatsApp(p.pacienteCelular, mensajeSeguimientoPresupuesto(p.paciente))}
                        className="font-medium text-emerald-700 hover:underline"
                      >
                        💬 Escribir por WhatsApp
                      </a>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {pendientesConPagos.length > 0 && (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <p className="font-medium">
            ⚠️ {pendientesConPagos.length} presupuesto{pendientesConPagos.length === 1 ? "" : "s"} en Pendiente ya
            tiene{pendientesConPagos.length === 1 ? "" : "n"} pagos cargados en Caja — probablemente haya que
            aceptarlos.
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {pendientesConPagos.map((a) => (
              <li key={a.id}>
                {a.numero} · {a.paciente} — {a.cantidadCobros} cobro{a.cantidadCobros === 1 ? "" : "s"} por $
                {a.totalCobrado.toLocaleString("es-AR")} (presupuesto de ${a.total.toLocaleString("es-AR")})
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por paciente o número de presupuesto..."
          className="w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-brand-brown text-white">
              <th className="px-3 py-2 text-left font-semibold">N.º</th>
              <th className="px-3 py-2 text-left font-semibold">Fecha</th>
              <th className="px-3 py-2 text-left font-semibold">Paciente</th>
              <th className="px-3 py-2 text-left font-semibold">Profesional</th>
              <th className="px-3 py-2 text-right font-semibold">Total</th>
              <th className="px-3 py-2 text-left font-semibold">Modalidad</th>
              <th className="px-3 py-2 text-left font-semibold">Estado</th>
              <th className="px-3 py-2 text-left font-semibold">Acciones</th>
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
            {!cargando && presupuestosFiltrados.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-gray-500">
                  {presupuestos.length === 0
                    ? "Todavía no hay presupuestos cargados."
                    : "No se encontró ningún presupuesto con esa búsqueda."}
                </td>
              </tr>
            )}
            {presupuestosFiltrados.map((p) => {
              const prioritarias = p.prestaciones.filter((x) => x.prioridad);
              const totalPrioridad = prioritarias.reduce((acc, x) => acc + (Number(x.importe) || 0), 0);
              // Solo tiene sentido ofrecer "aceptar solo prioridad" si hay
              // alguna marcada Y queda algo afuera (si está todo marcado,
              // es lo mismo que el presupuesto completo).
              const tieneOpcionPrioridad = prioritarias.length > 0 && prioritarias.length < p.prestaciones.length;
              return (
              <tr
                key={p.id}
                className={`border-t border-gray-100 hover:bg-gray-50 ${idsConAviso.has(p.id) ? "bg-amber-50" : ""}`}
              >
                <td onClick={() => setPresupuestoEnEdicion(p)} className="cursor-pointer px-3 py-2 font-medium text-gray-900">
                  {p.numero}
                </td>
                <td onClick={() => setPresupuestoEnEdicion(p)} className="cursor-pointer px-3 py-2 text-gray-600">
                  {p.fecha}
                </td>
                <td onClick={() => setPresupuestoEnEdicion(p)} className="cursor-pointer px-3 py-2 text-gray-600">
                  {p.paciente}
                </td>
                <td onClick={() => setPresupuestoEnEdicion(p)} className="cursor-pointer px-3 py-2 text-gray-600">
                  {p.profesional}
                </td>
                <td onClick={() => setPresupuestoEnEdicion(p)} className="cursor-pointer px-3 py-2 text-right text-gray-600">
                  ${Number(p.total).toLocaleString("es-AR")}
                </td>
                <td onClick={() => setPresupuestoEnEdicion(p)} className="cursor-pointer px-3 py-2 text-gray-600">
                  {p.modalidadPago || "—"}
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ESTADO_COLOR[p.estado]}`}>
                    {p.estado}
                  </span>
                  {idsConAviso.has(p.id) && (
                    <span className="ml-1 text-amber-600" title="Ya tiene pagos cargados en Caja">
                      ⚠️
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/presupuestos/${p.id}/imprimir`}
                      target="_blank"
                      className="text-xs font-medium text-brand-brown hover:underline"
                    >
                      🖨 Imprimir
                    </Link>
                    {p.estado === "Pendiente" && (
                      <>
                        <button
                          onClick={() => setPresupuestoEnEdicion(p)}
                          className="text-xs font-medium text-blue-600 hover:underline"
                        >
                          Modificar
                        </button>
                        <button
                          disabled={procesando === p.id}
                          onClick={() => handleCambiarEstado(p, "Aceptado")}
                          className="text-xs font-medium text-emerald-700 hover:underline disabled:opacity-50"
                        >
                          {tieneOpcionPrioridad ? "Aceptar completo" : "Aceptar"}
                        </button>
                        {tieneOpcionPrioridad && (
                          <button
                            disabled={procesando === p.id}
                            onClick={() => handleAceptarPrioridad(p, totalPrioridad)}
                            title={`Solo las prestaciones marcadas ⭐, por $${totalPrioridad.toLocaleString("es-AR")}`}
                            className="text-xs font-medium text-amber-700 hover:underline disabled:opacity-50"
                          >
                            Aceptar ⭐ (${totalPrioridad.toLocaleString("es-AR")})
                          </button>
                        )}
                      </>
                    )}
                    {p.estado !== "Anulado" && (
                      <button
                        disabled={procesando === p.id}
                        onClick={() => handleCambiarEstado(p, "Anulado")}
                        className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                      >
                        Anular
                      </button>
                    )}
                    {p.estado === "Anulado" && (
                      <button
                        disabled={procesando === p.id}
                        onClick={() => handleCambiarEstado(p, "Pendiente")}
                        className="text-xs font-medium text-amber-700 hover:underline disabled:opacity-50"
                      >
                        Reabrir
                      </button>
                    )}
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {(mostrarNuevo || presupuestoEnEdicion) && (
        <PresupuestoFormModal
          presupuesto={presupuestoEnEdicion}
          pacientes={pacientes}
          profesionales={profesionales}
          catalogo={catalogo}
          obrasSociales={obrasSociales}
          config={config}
          onClose={() => {
            setMostrarNuevo(false);
            setPresupuestoEnEdicion(null);
          }}
          onGuardado={async () => {
            await recargar();
            setMostrarNuevo(false);
            setPresupuestoEnEdicion(null);
          }}
        />
      )}
    </main>
  );
}
