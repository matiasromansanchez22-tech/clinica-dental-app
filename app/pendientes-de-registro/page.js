"use client";

import { useEffect, useMemo, useState } from "react";
import TurnoDetalleModal from "@/components/TurnoDetalleModal";
import CompletarVisitaOrtodoncia from "@/components/CompletarVisitaOrtodoncia";
import { avisarVisitasPorCompletarCambiaron } from "@/components/AvisoVisitasPorCompletar";
import { obtenerVisitasPorCompletarOrtodoncia } from "@/lib/data/prestacionesRealizadas";
import { useAuth } from "@/lib/auth/AuthProvider";
import { fechaDeHoyISO, sumarDias } from "@/lib/agenda";
import { obtenerPrestacionesParticular } from "@/lib/data/caja";
import { obtenerPendientesDeRegistro } from "@/lib/data/pendientesRegistro";
import { obtenerProfesionales } from "@/lib/data/profesionales";

const DIAS_SEMANA = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function textoFecha(fechaISO) {
  const [anio, mes, dia] = fechaISO.split("-").map(Number);
  return `${DIAS_SEMANA[new Date(anio, mes - 1, dia).getDay()]} ${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;
}

function PaginaPendientes() {
  const { perfil } = useAuth();
  const hoy = fechaDeHoyISO();
  const [dias, setDias] = useState(14);
  const [pendientes, setPendientes] = useState([]);
  const [profesionales, setProfesionales] = useState([]);
  const [catalogoParticular, setCatalogoParticular] = useState([]);
  const [profesionalElegido, setProfesionalElegido] = useState("todos");
  const [turnoAbierto, setTurnoAbierto] = useState(null);
  // Ortodoncia: visitas que la secretaria ya cobró y falta que el ortodoncista complete.
  const [porCompletar, setPorCompletar] = useState([]);
  const [visitaAbierta, setVisitaAbierta] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const esDuena = perfil?.rol === "Duena";
  // Cada odontólogo ve solo lo suyo; las dueñas ven a todos.
  const propioId = perfil?.rol === "Odontologo" ? perfil.profesional_id : null;

  async function recargarPorCompletar() {
    setPorCompletar(await obtenerVisitasPorCompletarOrtodoncia(propioId));
    avisarVisitasPorCompletarCambiaron();
  }

  useEffect(() => {
    if (perfil) obtenerVisitasPorCompletarOrtodoncia(propioId).then(setPorCompletar);
  }, [perfil, propioId]);

  async function recargar() {
    setPendientes(await obtenerPendientesDeRegistro(sumarDias(hoy, -dias), hoy));
  }

  useEffect(() => {
    setCargando(true);
    setError(null);
    Promise.all([
      obtenerPendientesDeRegistro(sumarDias(hoy, -dias), hoy),
      obtenerProfesionales(),
      obtenerPrestacionesParticular(),
    ])
      .then(([p, prof, cat]) => {
        setPendientes(p);
        setProfesionales(prof);
        setCatalogoParticular(cat);
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dias]);

  const visibles = useMemo(
    () =>
      pendientes
        .filter((t) => (propioId ? t.profesionalDeTurnoId === propioId : true))
        .filter((t) => profesionalElegido === "todos" || t.profesionalDeTurnoId === profesionalElegido)
        .sort((a, b) => (a.fecha === b.fecha ? a.horaInicio.localeCompare(b.horaInicio) : b.fecha.localeCompare(a.fecha))),
    [pendientes, propioId, profesionalElegido]
  );

  const porProfesional = useMemo(() => {
    const mapa = {};
    for (const t of pendientes) mapa[t.profesionalDeTurno] = (mapa[t.profesionalDeTurno] || 0) + 1;
    return Object.entries(mapa).sort((a, b) => b[1] - a[1]);
  }, [pendientes]);

  const profesionalesConPendientes = useMemo(() => {
    const mapa = new Map();
    for (const t of pendientes) mapa.set(t.profesionalDeTurnoId, t.profesionalDeTurno);
    return [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1], "es"));
  }, [pendientes]);

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">📝 Pendientes de registro</h1>
      <p className="mt-0.5 text-sm text-gray-500">
        Pacientes que ya vinieron y todavía no tienen cargado <strong>qué se hizo</strong> y <strong>qué sigue</strong>.
        Tocá <strong>Cargar</strong> para completarlo; al guardar, el paciente sale de esta lista.
      </p>

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded-md border border-gray-300 text-sm">
          {[7, 14, 30].map((d) => (
            <button
              key={d}
              onClick={() => setDias(d)}
              className={`px-3 py-1.5 ${dias === d ? "bg-brand-brown text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
            >
              Últimos {d} días
            </button>
          ))}
        </div>
        {esDuena && (
          <select
            value={profesionalElegido}
            onChange={(e) => setProfesionalElegido(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="todos">Todos los profesionales</option>
            {profesionalesConPendientes.map(([id, nombre]) => (
              <option key={id} value={id}>
                {nombre}
              </option>
            ))}
          </select>
        )}
      </div>

      {esDuena && !cargando && porProfesional.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          {porProfesional.map(([nombre, cantidad]) => (
            <span key={nombre} className="rounded-md bg-amber-50 px-3 py-1.5 font-medium text-amber-800">
              {nombre}: {cantidad}
            </span>
          ))}
        </div>
      )}

      {porCompletar.length > 0 && (
        <div className="mt-4 rounded-lg border-2 border-amber-400 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-900">
            💰 Ortodoncia: ya cobradas por secretaría, falta completar ({porCompletar.length})
          </p>
          <p className="mt-0.5 text-xs text-amber-800">
            Tocá <strong>Completar</strong> para indicar qué se hace la próxima vez (o el alta) y si se despegó algún bracket.
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {porCompletar.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-2 rounded-md bg-white px-3 py-2 text-sm shadow-sm">
                <span className="text-gray-800">
                  <strong>{v.paciente}</strong>
                  <span className="ml-2 text-xs text-gray-500">
                    {textoFecha(v.fecha)} · {v.prestacion}
                    {!propioId && ` · ${v.profesional}`}
                  </span>
                </span>
                <button
                  onClick={() => setVisitaAbierta(v)}
                  className="rounded-md border border-brand-brown/40 px-3 py-1 text-xs font-medium text-brand-brown hover:bg-brand-tan/30"
                >
                  Completar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {cargando ? (
        <p className="mt-6 text-sm text-gray-500">Cargando...</p>
      ) : visibles.length === 0 ? (
        <div className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          ✅ No hay pacientes pendientes en los últimos {dias} días. ¡Todo al día!
        </div>
      ) : (
        <>
          <p className="mt-4 text-sm font-semibold text-gray-700">
            {visibles.length} paciente{visibles.length === 1 ? "" : "s"} sin cargar
          </p>
          <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="bg-brand-brown text-white">
                  <th className="px-3 py-2 text-left font-semibold">Fecha</th>
                  <th className="px-3 py-2 text-left font-semibold">Hora</th>
                  <th className="px-3 py-2 text-left font-semibold">Paciente</th>
                  {!propioId && <th className="px-3 py-2 text-left font-semibold">Profesional</th>}
                  <th className="px-3 py-2 text-left font-semibold">Turno</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((t) => (
                  <tr key={t.id} className="border-t border-gray-100">
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-gray-800">
                      {textoFecha(t.fecha)}
                      {t.fecha === hoy && <span className="ml-1 rounded bg-sky-100 px-1 text-[10px] text-sky-800">hoy</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-gray-600">{t.horaInicio}</td>
                    <td className="px-3 py-2 font-medium text-gray-900">
                      {t.paciente}
                      {t.conNota && (
                        <span
                          className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-800"
                          title="Ese día ya hay una nota en el historial clínico, pero falta marcar qué se hizo"
                        >
                          📝 ya tiene nota
                        </span>
                      )}
                    </td>
                    {!propioId && <td className="px-3 py-2 text-gray-600">{t.profesionalDeTurno}</td>}
                    <td className="px-3 py-2 text-gray-600">{t.motivo || t.tipoAtencion || "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => setTurnoAbierto(t)}
                        className="rounded-md border border-brand-brown/40 px-3 py-1 text-xs font-medium text-brand-brown hover:bg-brand-tan/30"
                      >
                        Cargar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {visitaAbierta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">{visitaAbierta.paciente}</h2>
              <button onClick={() => setVisitaAbierta(null)} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
                ✕
              </button>
            </div>
            <CompletarVisitaOrtodoncia
              visita={visitaAbierta}
              onCompletado={() => {
                setVisitaAbierta(null);
                recargarPorCompletar();
              }}
            />
          </div>
        </div>
      )}

      {turnoAbierto && (
        <TurnoDetalleModal
          turno={turnoAbierto}
          fecha={turnoAbierto.fecha}
          profesionales={profesionales}
          catalogoParticular={catalogoParticular}
          onClose={() => setTurnoAbierto(null)}
          onCambiado={recargar}
        />
      )}
    </main>
  );
}

export default function PendientesDeRegistroPage() {
  const { perfil, cargando } = useAuth();
  if (cargando) return null;
  if (perfil?.rol !== "Duena" && perfil?.rol !== "Odontologo") {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Acceso restringido — esta sección es para las dueñas y los odontólogos.
        </div>
      </main>
    );
  }
  return <PaginaPendientes />;
}
