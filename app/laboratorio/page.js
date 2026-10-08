"use client";

import { useEffect, useMemo, useState } from "react";
import SoloConAccesoLaboratorio from "@/components/SoloConAccesoLaboratorio";
import TrabajoLaboratorioModal from "@/components/TrabajoLaboratorioModal";
import MarcarEnviadoModal from "@/components/MarcarEnviadoModal";
import TableroLaboratorio from "@/components/TableroLaboratorio";
import { calcularCircuito } from "@/lib/circuitoLaboratorio";
import {
  calcularEstadoDemora,
  eliminarTrabajoLaboratorio,
  obtenerConfiguracionLaboratorio,
  claveTurnoTrabajo,
  obtenerEventosPorTrabajo,
  obtenerProximosTurnosDeTrabajos,
  obtenerTrabajosLaboratorio,
} from "@/lib/data/laboratorio";
import { obtenerCatalogo } from "@/lib/data/catalogo";
import { obtenerPacientes } from "@/lib/data/pacientes";
import { obtenerPacientesOrtodoncia } from "@/lib/data/pacientesOrtodoncia";
import { obtenerProfesionales } from "@/lib/data/profesionales";
import { obtenerNombresLaboratoriosMecanicos } from "@/lib/data/mecanicosPrecios";

function PaginaLaboratorio() {
  const [trabajos, setTrabajos] = useState([]);
  const [eventosPorTrabajo, setEventosPorTrabajo] = useState({});
  const [turnosPorPaciente, setTurnosPorPaciente] = useState({});
  const [vista, setVista] = useState("tablero"); // "tablero" | "lista"
  const [pacientesGeneral, setPacientesGeneral] = useState([]);
  const [pacientesOrtodoncia, setPacientesOrtodoncia] = useState([]);
  const [profesionales, setProfesionales] = useState([]);
  const [catalogo, setCatalogo] = useState([]);
  const [laboratoriosSugeridos, setLaboratoriosSugeridos] = useState([]);
  const [config, setConfig] = useState({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [soloActivos, setSoloActivos] = useState(true);
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [trabajoEnDetalle, setTrabajoEnDetalle] = useState(null);
  const [trabajoAMarcarEnviado, setTrabajoAMarcarEnviado] = useState(null);

  async function recargarTrabajos() {
    const [lista, eventos] = await Promise.all([obtenerTrabajosLaboratorio(), obtenerEventosPorTrabajo()]);
    setTrabajos(lista);
    setEventosPorTrabajo(eventos);
  }

  async function borrarTrabajo(id, e) {
    e.stopPropagation();
    if (!window.confirm("¿Enviar este trabajo a la papelera de reciclaje?")) return;
    await eliminarTrabajoLaboratorio(id);
    await recargarTrabajos();
  }

  function abrirMarcarEnviado(t, e) {
    e.stopPropagation();
    setTrabajoAMarcarEnviado(t);
  }

  async function recargarSinCerrar() {
    const [lista, eventos] = await Promise.all([obtenerTrabajosLaboratorio(), obtenerEventosPorTrabajo()]);
    setTrabajos(lista);
    setEventosPorTrabajo(eventos);
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
      obtenerNombresLaboratoriosMecanicos(),
      obtenerEventosPorTrabajo(),
    ]).then(([t, pg, po, prof, conf, cat, labs, ev]) => {
      if (t.status === "fulfilled") setTrabajos(t.value);
      if (ev.status === "fulfilled") setEventosPorTrabajo(ev.value);
      if (pg.status === "fulfilled") setPacientesGeneral(pg.value);
      if (po.status === "fulfilled") setPacientesOrtodoncia(po.value);
      if (prof.status === "fulfilled") setProfesionales(prof.value);
      if (conf.status === "fulfilled") setConfig(conf.value);
      if (cat.status === "fulfilled") setCatalogo(cat.value);
      if (labs.status === "fulfilled") setLaboratoriosSugeridos(labs.value);
      const primerError = [t, pg, po, prof, conf, cat, labs, ev].find((r) => r.status === "rejected");
      if (primerError) setError(primerError.reason.message);
      setCargando(false);
    });
  }, []);

  // Próximo turno de cada paciente con trabajo en curso: se vuelve a buscar cada vez
  // que cambian los trabajos (por ejemplo, después de marcar que llegó uno).
  useEffect(() => {
    const activos = trabajos.filter((t) => t.estado !== "Entregado");
    if (activos.length === 0) return;
    obtenerProximosTurnosDeTrabajos(activos)
      .then(setTurnosPorPaciente)
      .catch(() => {});
  }, [trabajos]);

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

  // Trabajos que ya llegaron de vuelta del mecánico y esperan que el paciente venga
  // a probarlos: es la lista de "falta dar turno de prueba" para la secretaria.
  const paraDarTurnoDePrueba = useMemo(
    () =>
      trabajos.filter(
        (t) =>
          calcularCircuito(t, eventosPorTrabajo[t.id] || []).etapa === "en_clinica" &&
          !turnosPorPaciente[claveTurnoTrabajo(t)]
      ).length,
    [trabajos, eventosPorTrabajo, turnosPorPaciente]
  );

  const pendientesDeEnvio = useMemo(
    () => trabajos.filter((t) => t.estado === "Pendiente de envío").length,
    [trabajos]
  );

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
    <main className={`mx-auto p-6 ${vista === "tablero" ? "max-w-[96rem]" : "max-w-6xl"}`}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Laboratorio / Prótesis</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {cargando ? "Cargando..." : `${trabajosMostrados.length} trabajo${trabajosMostrados.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex overflow-hidden rounded-md border border-gray-300 text-sm">
            {[
              ["tablero", "Tablero"],
              ["lista", "Lista"],
            ].map(([clave, texto]) => (
              <button
                key={clave}
                onClick={() => setVista(clave)}
                className={`px-3 py-1.5 ${
                  vista === clave ? "bg-brand-brown text-white" : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {texto}
              </button>
            ))}
          </div>
          <button
            onClick={() => setMostrarNuevo(true)}
            className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark"
          >
            + Nuevo trabajo
          </button>
        </div>
      </div>

      {!cargando && (
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          {paraDarTurnoDePrueba > 0 && (
            <span className="rounded-md bg-amber-100 px-3 py-1.5 font-medium text-amber-800">
              📅 Para dar turno de prueba: {paraDarTurnoDePrueba}
            </span>
          )}
          {pendientesDeEnvio > 0 && (
            <span className="rounded-md bg-sky-50 px-3 py-1.5 font-medium text-sky-700">
              📤 Pendientes de envío: {pendientesDeEnvio}
            </span>
          )}
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

      {vista === "tablero" && !cargando && (
        <TableroLaboratorio
          trabajos={trabajos}
          eventosPorTrabajo={eventosPorTrabajo}
          turnosPorPaciente={turnosPorPaciente}
          onAbrirTrabajo={setTrabajoEnDetalle}
          onMarcarEnviado={setTrabajoAMarcarEnviado}
          onCambio={recargarTrabajos}
        />
      )}

      <div className={`mt-4 ${vista === "tablero" ? "hidden" : ""}`}>
        <label className="flex items-center gap-1.5 text-sm text-gray-700">
          <input type="checkbox" checked={soloActivos} onChange={(e) => setSoloActivos(e.target.checked)} />
          Mostrar solo trabajos activos (ocultar entregados)
        </label>
      </div>

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      <div className={`mt-4 overflow-x-auto rounded-lg border border-gray-200 ${vista === "tablero" ? "hidden" : ""}`}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-brand-brown text-white">
              <th className="px-3 py-2 text-left font-semibold">Paciente</th>
              <th className="px-3 py-2 text-left font-semibold">Trabajo</th>
              <th className="px-3 py-2 text-left font-semibold">Profesional</th>
              <th className="px-3 py-2 text-left font-semibold">Laboratorio</th>
              <th className="px-3 py-2 text-right font-semibold">Valor</th>
              <th className="px-3 py-2 text-left font-semibold">Estado</th>
              <th className="px-3 py-2 text-left font-semibold">Demora</th>
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
            {!cargando && trabajosMostrados.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-gray-500">
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
                  <td className="px-3 py-2 text-right text-gray-600">
                    {t.valor ? `$${Number(t.valor).toLocaleString("es-AR")}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{t.estado}</td>
                  <td className={`px-3 py-2 font-medium ${demora.color}`}>
                    {demora.emoji} {demora.texto}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {t.estado === "Pendiente de envío" && (
                        <button
                          onClick={(e) => abrirMarcarEnviado(t, e)}
                          className="rounded-md border border-sky-300 px-2 py-1 text-xs font-medium text-sky-700 hover:bg-sky-50"
                        >
                          📤 Marcar enviado
                        </button>
                      )}
                      <button
                        onClick={(e) => borrarTrabajo(t.id, e)}
                        className="text-xs text-red-600 hover:underline"
                        title="Enviar a la papelera"
                      >
                        🗑️
                      </button>
                    </div>
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
          laboratoriosSugeridos={laboratoriosSugeridos}
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

      {trabajoAMarcarEnviado && (
        <MarcarEnviadoModal
          trabajo={trabajoAMarcarEnviado}
          laboratoriosSugeridos={laboratoriosSugeridos}
          onClose={() => setTrabajoAMarcarEnviado(null)}
          onGuardado={async () => {
            await recargarTrabajos();
            setTrabajoAMarcarEnviado(null);
          }}
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
