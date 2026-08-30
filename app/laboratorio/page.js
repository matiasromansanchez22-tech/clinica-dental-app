"use client";

import { useEffect, useMemo, useState } from "react";
import SoloConAccesoLaboratorio from "@/components/SoloConAccesoLaboratorio";
import TrabajoLaboratorioModal from "@/components/TrabajoLaboratorioModal";
import { calcularEstadoDemora, obtenerConfiguracionLaboratorio, obtenerTrabajosLaboratorio } from "@/lib/data/laboratorio";
import { obtenerPacientes } from "@/lib/data/pacientes";
import { obtenerPacientesOrtodoncia } from "@/lib/data/pacientesOrtodoncia";
import { obtenerProfesionales } from "@/lib/data/profesionales";

function PaginaLaboratorio() {
  const [trabajos, setTrabajos] = useState([]);
  const [pacientesGeneral, setPacientesGeneral] = useState([]);
  const [pacientesOrtodoncia, setPacientesOrtodoncia] = useState([]);
  const [profesionales, setProfesionales] = useState([]);
  const [config, setConfig] = useState({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [soloActivos, setSoloActivos] = useState(true);
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [trabajoEnDetalle, setTrabajoEnDetalle] = useState(null);

  async function recargarTrabajos() {
    setTrabajos(await obtenerTrabajosLaboratorio());
  }

  async function recargarSinCerrar() {
    const lista = await obtenerTrabajosLaboratorio();
    setTrabajos(lista);
    setTrabajoEnDetalle((actual) => (actual ? lista.find((t) => t.id === actual.id) || actual : actual));
  }

  useEffect(() => {
    setCargando(true);
    Promise.allSettled([
      obtenerTrabajosLaboratorio(),
      obtenerPacientes(),
      obtenerPacientesOrtodoncia(),
      obtenerProfesionales(),
      obtenerConfiguracionLaboratorio(),
    ]).then(([t, pg, po, prof, conf]) => {
      if (t.status === "fulfilled") setTrabajos(t.value);
      if (pg.status === "fulfilled") setPacientesGeneral(pg.value);
      if (po.status === "fulfilled") setPacientesOrtodoncia(po.value);
      if (prof.status === "fulfilled") setProfesionales(prof.value);
      if (conf.status === "fulfilled") setConfig(conf.value);
      const primerError = [t, pg, po, prof, conf].find((r) => r.status === "rejected");
      if (primerError) setError(primerError.reason.message);
      setCargando(false);
    });
  }, []);

  const trabajosMostrados = soloActivos ? trabajos.filter((t) => t.estado !== "Entregado") : trabajos;

  const resumen = useMemo(() => {
    const conteo = { "🟢": 0, "🟡": 0, "🔴": 0 };
    for (const t of trabajos) {
      if (t.estado === "Entregado") continue;
      const { emoji } = calcularEstadoDemora(t.fechaUltimoEvento, t.estado, config);
      conteo[emoji] = (conteo[emoji] || 0) + 1;
    }
    return conteo;
  }, [trabajos, config]);

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Laboratorio / Prótesis</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {cargando ? "Cargando..." : `${trabajosMostrados.length} trabajo${trabajosMostrados.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <button
          onClick={() => setMostrarNuevo(true)}
          className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark"
        >
          + Nuevo trabajo
        </button>
      </div>

      {!cargando && (
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <span className="rounded-md bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700">🟢 Al día: {resumen["🟢"]}</span>
          <span className="rounded-md bg-amber-50 px-3 py-1.5 font-medium text-amber-700">🟡 Por seguir de cerca: {resumen["🟡"]}</span>
          <span className="rounded-md bg-red-50 px-3 py-1.5 font-medium text-red-700">🔴 Demorados: {resumen["🔴"]}</span>
        </div>
      )}

      <div className="mt-4">
        <label className="flex items-center gap-1.5 text-sm text-gray-700">
          <input type="checkbox" checked={soloActivos} onChange={(e) => setSoloActivos(e.target.checked)} />
          Mostrar solo trabajos activos (ocultar entregados)
        </label>
      </div>

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-brand-brown text-white">
              <th className="px-3 py-2 text-left font-semibold">Paciente</th>
              <th className="px-3 py-2 text-left font-semibold">Trabajo</th>
              <th className="px-3 py-2 text-left font-semibold">Profesional</th>
              <th className="px-3 py-2 text-left font-semibold">Laboratorio</th>
              <th className="px-3 py-2 text-left font-semibold">Estado</th>
              <th className="px-3 py-2 text-left font-semibold">Demora</th>
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
            {!cargando && trabajosMostrados.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-gray-500">
                  No hay trabajos cargados.
                </td>
              </tr>
            )}
            {trabajosMostrados.map((t) => {
              const demora = calcularEstadoDemora(t.fechaUltimoEvento, t.estado, config);
              return (
                <tr
                  key={t.id}
                  onClick={() => setTrabajoEnDetalle(t)}
                  className="cursor-pointer border-t border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-3 py-2 font-medium text-gray-900">{t.pacienteNombre}</td>
                  <td className="px-3 py-2 text-gray-600">
                    {t.tipoTrabajo}
                    {t.pieza ? ` (${t.pieza})` : ""}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{t.profesional}</td>
                  <td className="px-3 py-2 text-gray-600">{t.laboratorio || "—"}</td>
                  <td className="px-3 py-2 text-gray-600">{t.estado}</td>
                  <td className={`px-3 py-2 font-medium ${demora.color}`}>
                    {demora.emoji} {demora.texto}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {(mostrarNuevo || trabajoEnDetalle) && (
        <TrabajoLaboratorioModal
          trabajo={trabajoEnDetalle}
          pacientesGeneral={pacientesGeneral}
          pacientesOrtodoncia={pacientesOrtodoncia}
          profesionales={profesionales}
          config={config}
          onClose={() => {
            setMostrarNuevo(false);
            setTrabajoEnDetalle(null);
          }}
          onGuardado={async () => {
            await recargarTrabajos();
            setMostrarNuevo(false);
            setTrabajoEnDetalle(null);
          }}
          onEventoGuardado={recargarSinCerrar}
        />
      )}
    </main>
  );
}

export default function LaboratorioPage() {
  return (
    <SoloConAccesoLaboratorio>
      <PaginaLaboratorio />
    </SoloConAccesoLaboratorio>
  );
}
