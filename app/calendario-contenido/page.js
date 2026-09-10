"use client";

import { useEffect, useMemo, useState } from "react";
import ContenidoFormModal from "@/components/ContenidoFormModal";
import SoloDuenaYCM from "@/components/SoloDuenaYCM";
import { fechaDeHoyISO } from "@/lib/agenda";
import {
  crearContenido,
  actualizarContenido,
  eliminarContenido,
  obtenerContenidos,
} from "@/lib/data/calendarioContenido";
import { obtenerAutorizacionesFotos, obtenerPacientes } from "@/lib/data/pacientes";
import { obtenerAutorizacionesFotosOrtodoncia, obtenerPacientesOrtodoncia } from "@/lib/data/pacientesOrtodoncia";

const COLOR_ESTADO = {
  Idea: "bg-gray-100 text-gray-600",
  "Diseño": "bg-amber-100 text-amber-700",
  Aprobado: "bg-sky-100 text-sky-700",
  Publicado: "bg-emerald-100 text-emerald-700",
};

function formatoFecha(fechaISO) {
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}

function primerYUltimoDiaDelMes(fechaISO) {
  const [anio, mes] = fechaISO.split("-").map(Number);
  const primero = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const ultimoDia = new Date(anio, mes, 0).getDate();
  const ultimo = `${anio}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
  return { primero, ultimo };
}

function ContenidoContenido() {
  const hoy = fechaDeHoyISO();
  const [fechaInicio, setFechaInicio] = useState(() => primerYUltimoDiaDelMes(hoy).primero);
  const [fechaFin, setFechaFin] = useState(() => primerYUltimoDiaDelMes(hoy).ultimo);
  const [contenidos, setContenidos] = useState([]);
  const [pacientesConAutorizacion, setPacientesConAutorizacion] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [enEdicion, setEnEdicion] = useState(null);

  async function recargar() {
    setCargando(true);
    setError(null);
    try {
      const items = await obtenerContenidos(fechaInicio, fechaFin);
      setContenidos(items);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    Promise.all([
      obtenerPacientes(),
      obtenerAutorizacionesFotos(),
      obtenerPacientesOrtodoncia(),
      obtenerAutorizacionesFotosOrtodoncia(),
    ])
      .then(([general, autGeneral, orto, autOrto]) => {
        const lista = [
          ...general.filter((p) => autGeneral[p.id]).map((p) => ({ id: p.id, tipo: "General", nombre: p.apellidoYNombre })),
          ...orto.filter((p) => autOrto[p.id]).map((p) => ({ id: p.id, tipo: "Ortodoncia", nombre: p.nombre })),
        ];
        setPacientesConAutorizacion(lista);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaInicio, fechaFin]);

  function irAEsteMes() {
    const { primero, ultimo } = primerYUltimoDiaDelMes(hoy);
    setFechaInicio(primero);
    setFechaFin(ultimo);
  }

  const contenidosPorEstado = useMemo(() => {
    const mapa = {};
    for (const c of contenidos) mapa[c.estado] = (mapa[c.estado] || 0) + 1;
    return mapa;
  }, [contenidos]);

  async function guardar(datos) {
    if (enEdicion) {
      await actualizarContenido(enEdicion.id, datos);
    } else {
      await crearContenido(datos);
    }
    await recargar();
    setMostrarNuevo(false);
    setEnEdicion(null);
  }

  async function borrar(item) {
    if (!window.confirm(`¿Borrar este contenido de ${formatoFecha(item.fecha)} (${item.redSocial})?`)) return;
    try {
      await eliminarContenido(item.id);
      await recargar();
    } catch (e) {
      setError(e.message);
    }
  }

  async function cambiarEstadoRapido(item, estado) {
    try {
      await actualizarContenido(item.id, { ...item, estado });
      await recargar();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">📅 Calendario de Contenido</h1>
        <button
          onClick={() => setMostrarNuevo(true)}
          className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark"
        >
          + Nuevo contenido
        </button>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Posteos planificados para redes sociales — de idea a publicado, con las fotos de pacientes que ya autorizaron
        su uso.
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
        <div className="ml-auto flex flex-wrap gap-2">
          {Object.entries(contenidosPorEstado).map(([estado, cant]) => (
            <span key={estado} className={`rounded-full px-2.5 py-1 text-xs font-medium ${COLOR_ESTADO[estado]}`}>
              {estado}: {cant}
            </span>
          ))}
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {cargando && <p className="text-sm text-gray-500">Cargando...</p>}
        {!cargando && contenidos.length === 0 && (
          <p className="text-sm text-gray-500">No hay contenido planificado en este período.</p>
        )}
        {contenidos.map((c) => (
          <div key={c.id} className="rounded-lg border border-gray-200 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-gray-900">
                  {formatoFecha(c.fecha)} · {c.redSocial}
                </p>
                {c.pacienteNombre && (
                  <p className="text-xs text-gray-500">📁 Usa fotos de: {c.pacienteNombre}</p>
                )}
              </div>
              <select
                value={c.estado}
                onChange={(e) => cambiarEstadoRapido(c, e.target.value)}
                className={`rounded-full border-0 px-2.5 py-1 text-xs font-medium ${COLOR_ESTADO[c.estado]}`}
              >
                {["Idea", "Diseño", "Aprobado", "Publicado"].map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>
            {c.texto && <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{c.texto}</p>}
            {c.observaciones && <p className="mt-1 text-xs text-gray-400">Nota: {c.observaciones}</p>}
            <div className="mt-2 flex gap-3">
              <button onClick={() => setEnEdicion(c)} className="text-xs text-blue-600 hover:underline">
                Editar
              </button>
              <button onClick={() => borrar(c)} className="text-xs text-red-600 hover:underline">
                Borrar
              </button>
            </div>
          </div>
        ))}
      </div>

      {(mostrarNuevo || enEdicion) && (
        <ContenidoFormModal
          contenido={enEdicion}
          pacientesConAutorizacion={pacientesConAutorizacion}
          onClose={() => {
            setMostrarNuevo(false);
            setEnEdicion(null);
          }}
          onGuardar={guardar}
        />
      )}
    </main>
  );
}

export default function CalendarioContenidoPage() {
  return (
    <SoloDuenaYCM>
      <ContenidoContenido />
    </SoloDuenaYCM>
  );
}
