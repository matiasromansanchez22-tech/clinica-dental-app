"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PresupuestoFormModal from "@/components/PresupuestoFormModal";
import { obtenerConfiguracionGeneral } from "@/lib/data/configuracionGeneral";
import { obtenerCatalogo } from "@/lib/data/catalogo";
import { obtenerPacientesActivos } from "@/lib/data/pacientes";
import { obtenerProfesionales } from "@/lib/data/profesionales";
import { cambiarEstadoPresupuesto, obtenerPresupuestos } from "@/lib/data/presupuestos";

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
  const [config, setConfig] = useState({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [presupuestoEnEdicion, setPresupuestoEnEdicion] = useState(null);
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [procesando, setProcesando] = useState(null);

  async function recargar() {
    const data = await obtenerPresupuestos();
    setPresupuestos(data);
  }

  useEffect(() => {
    Promise.all([
      obtenerPresupuestos(),
      obtenerPacientesActivos(),
      obtenerProfesionales(),
      obtenerCatalogo(),
      obtenerConfiguracionGeneral(),
    ])
      .then(([p, pac, prof, cat, conf]) => {
        setPresupuestos(p);
        setPacientes(pac);
        setProfesionales(prof);
        setCatalogo(cat.filter((c) => c.estado === "Activo"));
        setConfig(conf);
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

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

      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
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
            {!cargando && presupuestos.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-gray-500">
                  Todavía no hay presupuestos cargados.
                </td>
              </tr>
            )}
            {presupuestos.map((p) => (
              <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
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
                          Aceptar
                        </button>
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
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(mostrarNuevo || presupuestoEnEdicion) && (
        <PresupuestoFormModal
          presupuesto={presupuestoEnEdicion}
          pacientes={pacientes}
          profesionales={profesionales}
          catalogo={catalogo}
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
