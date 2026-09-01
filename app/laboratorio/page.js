"use client";

import { useEffect, useMemo, useState } from "react";
import SoloConAccesoLaboratorio from "@/components/SoloConAccesoLaboratorio";
import TrabajoLaboratorioModal from "@/components/TrabajoLaboratorioModal";
import {
  calcularEstadoDemora,
  eliminarTrabajoLaboratorio,
  obtenerConfiguracionLaboratorio,
  obtenerTrabajosLaboratorio,
} from "@/lib/data/laboratorio";
import { obtenerCatalogo } from "@/lib/data/catalogo";
import { obtenerPacientes } from "@/lib/data/pacientes";
import { obtenerPacientesOrtodoncia } from "@/lib/data/pacientesOrtodoncia";
import { obtenerProfesionales } from "@/lib/data/profesionales";

function PaginaLaboratorio() {
  const [trabajos, setTrabajos] = useState([]);
  const [pacientesGeneral, setPacientesGeneral] = useState([]);
  const [pacientesOrtodoncia, setPacientesOrtodoncia] = useState([]);
  const [profesionales, setProfesionales] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [config, setConfig] = useState({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [soloActivos, setSoloActivos] = useState(true);
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [trabajoEnDetalle, setTrabajoEnDetalle] = useState(null);

  async function recargarTrabajos() {
    setTrabajos(await obtenerTrabajosLaboratorio());
  }

  async function borrarTrabajo(id, e) {
    e.stopPropagation();
    if (!window.confirm("¿Enviar este trabajo a la papelera de reciclaje?")) return;
    await eliminarTrabajoLaboratorio(id);
    await recargarTrabajos();
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
      obtenerCatalogo(),
    ]).then(([t, pg, po, prof, conf, cat]) => {
      if (t.status === "fulfilled") setTrabajos(t.value);
      if (pg.status === "fulfilled") setPacientesGeneral(pg.value);
      if (po.status === "fulfilled") setPacientesOrtodoncia(po.value);
      if (prof.status === "fulfilled") setProfesionales(prof.value);
      if (conf.status === "fulfilled") setConfig(conf.value);
      if (cat.status === "fulfilled") setCatalogo(cat.value);
      const primerError = [t, pg, po, prof, conf, cat].find((r) => r.status === "rejected");
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

  // Ficha de carga por laboratorio: cuántos trabajos activos tiene cada
  // mecánico ahora mismo, y si alguno está demorado (para ver de un
  // vistazo a qué laboratorio conviene dejar de mandarle trabajo).
  const cargaPorLaboratorio = useMemo(() => {
    const mapa = {};
    for (const t of trabajos) {
      if (t.estado === "Entregado") continue;
      const nombre = t.laboratorio || "Sin asignar";
      if (!mapa[nombre]) mapa[nombre] = { nombre, cantidad: 0, peorEmoji: "🟢" };
      mapa[nombre].cantidad += 1;
      const { emoji } = calcularEstadoDemora(t.fechaUltimoEvento, t.estado, config);
      if (emoji === "🔴") mapa[nombre].peorEmoji = "🔴";
      else if (emoji === "🟡" && mapa[nombre].peorEmoji !== "🔴") mapa[nombre].peorEmoji = "🟡";
    }
    return Object.values(mapa).sort((a, b) => b.cantidad - a.cantidad);
  }, [trabajos, config]);

  const BORDE_POR_EMOJI = {
    "🔴": "border-red-300 bg-red-50",
    "🟡": "border-amber-300 bg-amber-50",
    "🟢": "border-emerald-200 bg-emerald-50",
  };

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

      {!cargando && cargaPorLaboratorio.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase text-gray-400">Carga por laboratorio (trabajos activos)</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {cargaPorLaboratorio.map((l) => (
              <div
                key={l.nombre}
                className={`rounded-md border px-3 py-1.5 text-sm ${BORDE_POR_EMOJI[l.peorEmoji]}`}
              >
                <span className="font-medium text-gray-900">{l.nombre}</span>
                <span className="ml-1.5 text-gray-600">
                  {l.peorEmoji} {l.cantidad} trabajo{l.cantidad === 1 ? "" : "s"}
                </span>
              </div>
            ))}
          </div>
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
              <th className="px-3 py-2"></th>
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
            {!cargando && trabajosMostrados.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-gray-500">
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
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={(e) => borrarTrabajo(t.id, e)}
                      className="text-xs text-red-600 hover:underline"
                      title="Enviar a la papelera"
                    >
                      🗑️
                    </button>
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
          catalogo={catalogo}
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
