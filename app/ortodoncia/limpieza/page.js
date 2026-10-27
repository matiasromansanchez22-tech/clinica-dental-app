"use client";

import { useEffect, useMemo, useState } from "react";
import SoloDuena from "@/components/SoloDuena";
import { ESTADOS_DESTINO, GRUPOS_LIMPIEZA, aplicarEstadoEnLote, deshacerEstadoEnLote, obtenerCandidatosLimpieza } from "@/lib/data/limpiezaOrtodoncia";

const NOMBRES_MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function formatoFecha(fechaISO) {
  if (!fechaISO) return "—";
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}

function formatoMes(claveMes) {
  if (!claveMes) return "—";
  const [anio, mes] = claveMes.split("-");
  return `${NOMBRES_MES[Number(mes) - 1]} ${anio}`;
}

function Tarjeta({ titulo, valor, activa, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border p-3 text-left ${activa ? "border-brand-brown bg-brand-tan/40" : "border-gray-200 bg-white hover:bg-gray-50"}`}
    >
      <p className="text-xs font-medium uppercase text-gray-500">{titulo}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{valor}</p>
    </button>
  );
}

function LimpiezaContenido() {
  const [filas, setFilas] = useState(null);
  const [error, setError] = useState(null);
  const [grupo, setGrupo] = useState("no-siguen");
  const [busqueda, setBusqueda] = useState("");
  const [elegidos, setElegidos] = useState(new Set());
  const [estadoDestino, setEstadoDestino] = useState("Inactivo");
  const [aplicando, setAplicando] = useState(false);
  const [resultado, setResultado] = useState(null); // { estado, cambiados: [...], omitidos: [...] }

  function cargar() {
    setFilas(null);
    obtenerCandidatosLimpieza()
      .then(setFilas)
      .catch((e) => setError(e.message));
  }

  useEffect(() => {
    obtenerCandidatosLimpieza()
      .then(setFilas)
      .catch((e) => setError(e.message));
  }, []);

  const definicion = GRUPOS_LIMPIEZA.find((g) => g.clave === grupo);
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (filas || []).filter((f) => f.grupo === grupo).filter((f) => !q || f.nombre.toLowerCase().includes(q));
  }, [filas, grupo, busqueda]);
  const cantidadPorGrupo = (clave) => (filas || []).filter((f) => f.grupo === clave).length;
  const elegidosVisibles = visibles.filter((f) => elegidos.has(f.id));

  function elegirGrupo(clave) {
    setGrupo(clave);
    setElegidos(new Set());
    setEstadoDestino(GRUPOS_LIMPIEZA.find((g) => g.clave === clave).estadoSugerido);
    setResultado(null);
  }

  function alternar(id) {
    setElegidos((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function alternarTodos() {
    const todosElegidos = visibles.length > 0 && visibles.every((f) => elegidos.has(f.id));
    setElegidos(todosElegidos ? new Set() : new Set(visibles.map((f) => f.id)));
  }

  async function aplicar() {
    const ids = elegidosVisibles.map((f) => f.id);
    if (ids.length === 0) return;
    const ejemplo = elegidosVisibles.slice(0, 3).map((f) => f.nombre).join(", ");
    const ok = window.confirm(
      `Vas a pasar a ${ids.length} paciente${ids.length > 1 ? "s" : ""} a «${estadoDestino}» (${ejemplo}${ids.length > 3 ? "..." : ""}).\n\nDejan de aparecer en el seguimiento de Ortodoncia. Se puede deshacer ahora mismo o reactivar después desde la ficha.\n\n¿Confirmás?`
    );
    if (!ok) return;
    setAplicando(true);
    setError(null);
    try {
      const r = await aplicarEstadoEnLote(ids, estadoDestino);
      setResultado({ estado: estadoDestino, nombres: Object.fromEntries(elegidosVisibles.map((f) => [f.id, f.nombre])), ...r });
      setElegidos(new Set());
      cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setAplicando(false);
    }
  }

  async function deshacer() {
    if (!resultado) return;
    setAplicando(true);
    try {
      await deshacerEstadoEnLote(resultado.cambiados, resultado.estado);
      setResultado(null);
      cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setAplicando(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">🧹 Limpieza de pacientes — Ortodoncia</h1>
      <p className="mt-1 text-sm text-gray-500">
        Pacientes que figuran como «Activo» pero parecen haber dejado de venir (no tienen turno por venir). Marcá los que sepas seguro y pasalos a Inactivo,
        Abandonó, Finalizado o Consulta: dejan de aparecer en el seguimiento. Nada se borra y se puede reactivar desde la ficha del paciente.
      </p>
      <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        La app registra visitas recién desde el 26/08/2026: «sin visita» quiere decir que no vino desde esa fecha. Antes de dar de baja a alguien, confirmá con
        la ortodoncista o escribile desde Retomar.
      </div>

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
      {!filas && !error && <p className="mt-6 text-sm text-gray-500">Calculando...</p>}

      {resultado && (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <p className="font-medium">
            ✅ {resultado.cambiados.length} paciente{resultado.cambiados.length === 1 ? "" : "s"} pasado{resultado.cambiados.length === 1 ? "" : "s"} a «{resultado.estado}».
            {resultado.cambiados.length > 0 && (
              <button onClick={deshacer} disabled={aplicando} className="ml-3 rounded border border-emerald-400 bg-white px-2 py-0.5 text-xs font-medium hover:bg-emerald-100">
                Deshacer
              </button>
            )}
          </p>
          {resultado.omitidos.length > 0 && (
            <p className="mt-1 text-xs">
              No se cambiaron {resultado.omitidos.length}: {resultado.omitidos.map((o) => `${resultado.nombres[o.id] || "paciente"} (${o.motivo})`).join("; ")}.
            </p>
          )}
        </div>
      )}

      {filas && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
            {GRUPOS_LIMPIEZA.map((g) => (
              <Tarjeta key={g.clave} titulo={g.titulo} valor={cantidadPorGrupo(g.clave)} activa={grupo === g.clave} onClick={() => elegirGrupo(g.clave)} />
            ))}
          </div>
          <p className="mt-3 text-sm text-gray-600">{definicion.detalle}</p>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar paciente..."
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
            <p className="text-sm font-semibold text-gray-700">
              {visibles.length} paciente{visibles.length === 1 ? "" : "s"} · {elegidosVisibles.length} marcado{elegidosVisibles.length === 1 ? "" : "s"}
            </p>
            <div className="ml-auto flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-sm text-gray-700">
                Pasar a
                <select value={estadoDestino} onChange={(e) => setEstadoDestino(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
                  {ESTADOS_DESTINO.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
              </label>
              <button
                onClick={aplicar}
                disabled={aplicando || elegidosVisibles.length === 0}
                className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:cursor-not-allowed disabled:opacity-40"
              >
                {aplicando ? "Aplicando..." : `Pasar ${elegidosVisibles.length || ""} a ${estadoDestino}`}
              </button>
            </div>
          </div>
          {estadoDestino === "Consulta" && (
            <p className="mt-1 text-xs text-gray-500">«Consulta» es para quienes nunca arrancaron el tratamiento: pasan a la lista de Consultas, y si empiezan la instalación vuelven a Activo solos.</p>
          )}

          <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead>
                <tr className="bg-brand-brown text-white">
                  <th className="w-10 px-3 py-2 text-left">
                    <input type="checkbox" checked={visibles.length > 0 && visibles.every((f) => elegidos.has(f.id))} onChange={alternarTodos} aria-label="Marcar todos" />
                  </th>
                  <th className="px-3 py-2 text-left font-semibold">Paciente</th>
                  <th className="px-3 py-2 text-left font-semibold">Ortodoncista</th>
                  <th className="px-3 py-2 text-left font-semibold">Última visita en la app</th>
                  <th className="px-3 py-2 text-left font-semibold">Último pago (cuaderno)</th>
                  <th className="px-3 py-2 text-left font-semibold">Instalación</th>
                  <th className="px-3 py-2 text-left font-semibold">Retomar</th>
                </tr>
              </thead>
              <tbody>
                {visibles.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-4 text-center text-gray-500">
                      No hay pacientes en este grupo.
                    </td>
                  </tr>
                )}
                {visibles.map((f) => (
                  <tr key={f.id} className={`border-t border-gray-100 align-top ${elegidos.has(f.id) ? "bg-brand-tan/30" : ""}`}>
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={elegidos.has(f.id)} onChange={() => alternar(f.id)} aria-label={`Marcar a ${f.nombre}`} />
                    </td>
                    <td className="px-3 py-2 font-medium text-gray-900">{f.nombre}</td>
                    <td className="px-3 py-2 text-gray-700">{f.ortodoncista}</td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-gray-600">{formatoFecha(f.ultimaVisita)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">{formatoMes(f.ultimoMesPago)}</td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-gray-600">{formatoFecha(f.fechaInstalacion)}</td>
                    <td className="px-3 py-2 text-xs text-gray-700">
                      {f.retomarEstado || "—"}
                      {f.retomarNota && <p className="text-gray-500">{f.retomarNota}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}

export default function LimpiezaPage() {
  return (
    <SoloDuena>
      <LimpiezaContenido />
    </SoloDuena>
  );
}
