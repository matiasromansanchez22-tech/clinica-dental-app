"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ContenidoFormModal from "@/components/ContenidoFormModal";
import SoloDuenaYCM from "@/components/SoloDuenaYCM";
import { useAuth } from "@/lib/auth/AuthProvider";
import { fechaDeHoyISO } from "@/lib/agenda";
import {
  crearContenido,
  actualizarContenido,
  eliminarContenido,
  notificarAprobado,
  obtenerContenidos,
} from "@/lib/data/calendarioContenido";
import { obtenerAutorizacionesFotos, obtenerPacientes } from "@/lib/data/pacientes";
import { obtenerAutorizacionesFotosOrtodoncia, obtenerPacientesOrtodoncia } from "@/lib/data/pacientesOrtodoncia";
import { crearFechaEspecial, eliminarFechaEspecial, obtenerFechasEspeciales, proximasOcurrencias } from "@/lib/data/fechasEspeciales";

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

function ProximasFechasEspeciales({ fechas, esDuena, onCrearContenido, onAgregar, onBorrar }) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [nombre, setNombre] = useState("");
  const [mes, setMes] = useState("1");
  const [dia, setDia] = useState("1");

  async function agregar() {
    if (!nombre.trim()) return;
    await onAgregar({ nombre: nombre.trim(), mes, dia });
    setNombre("");
    setMostrarForm(false);
  }

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase text-gray-500">📌 Próximas fechas especiales</h2>
        {esDuena && (
          <button onClick={() => setMostrarForm((m) => !m)} className="text-xs text-brand-brown hover:underline">
            {mostrarForm ? "Cancelar" : "+ Agregar fecha"}
          </button>
        )}
      </div>

      {mostrarForm && (
        <div className="mb-3 flex flex-wrap items-end gap-2 rounded-md border border-gray-200 p-3">
          <label className="flex flex-col gap-1 text-xs text-gray-700">
            Nombre
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Día del Odontólogo"
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-700">
            Mes
            <select value={mes} onChange={(e) => setMes(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-700">
            Día
            <select value={dia} onChange={(e) => setDia(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={agregar}
            className="rounded-md bg-brand-brown px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-brown-dark"
          >
            Guardar
          </button>
        </div>
      )}

      {fechas.length === 0 ? (
        <p className="text-xs text-gray-400">Todavía no hay fechas cargadas.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {fechas.slice(0, 6).map((f) => (
            <div key={f.id} className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs">
              <div>
                <p className="font-medium text-gray-900">{f.nombre}</p>
                <p className="text-gray-400">
                  {formatoFecha(f.fechaISO)} · {f.diasFaltan === 0 ? "hoy" : `en ${f.diasFaltan} días`}
                </p>
              </div>
              <button
                onClick={() => onCrearContenido(f)}
                className="whitespace-nowrap rounded-md bg-brand-tan/30 px-2 py-1 text-brand-brown hover:bg-brand-tan/50"
              >
                + Crear
              </button>
              {esDuena && (
                <button onClick={() => onBorrar(f.id)} className="text-red-500 hover:underline">
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ContenidoContenido() {
  const { perfil } = useAuth();
  const esDuena = perfil?.rol === "Duena";
  const hoy = fechaDeHoyISO();
  const [fechaInicio, setFechaInicio] = useState(() => primerYUltimoDiaDelMes(hoy).primero);
  const [fechaFin, setFechaFin] = useState(() => primerYUltimoDiaDelMes(hoy).ultimo);
  const [contenidos, setContenidos] = useState([]);
  const [pacientesConAutorizacion, setPacientesConAutorizacion] = useState([]);
  const [fechasEspeciales, setFechasEspeciales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [enEdicion, setEnEdicion] = useState(null);
  const [borrador, setBorrador] = useState(null);

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
    obtenerFechasEspeciales().then(setFechasEspeciales).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaInicio, fechaFin]);

  const proximasFechas = useMemo(() => proximasOcurrencias(fechasEspeciales), [fechasEspeciales]);

  function crearContenidoDesdeFecha(fechaEspecial) {
    setBorrador({ fecha: fechaEspecial.fechaISO, texto: `${fechaEspecial.nombre} 🦷` });
    setMostrarNuevo(true);
  }

  async function agregarFechaEspecial(datos) {
    const nueva = await crearFechaEspecial(datos);
    setFechasEspeciales((fs) => [...fs, nueva]);
  }

  async function borrarFechaEspecial(id) {
    await eliminarFechaEspecial(id);
    setFechasEspeciales((fs) => fs.filter((f) => f.id !== id));
  }

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

  const contenidosPorRed = useMemo(() => {
    const mapa = {};
    for (const c of contenidos) mapa[c.redSocial] = (mapa[c.redSocial] || 0) + 1;
    return Object.entries(mapa).sort((a, b) => b[1] - a[1]);
  }, [contenidos]);

  async function guardar(datos) {
    const pasaAAprobado = datos.estado === "Aprobado" && enEdicion?.estado !== "Aprobado";
    if (enEdicion) {
      await actualizarContenido(enEdicion.id, datos);
    } else {
      await crearContenido(datos);
    }
    if (pasaAAprobado) notificarAprobado(datos);
    await recargar();
    setMostrarNuevo(false);
    setEnEdicion(null);
    setBorrador(null);
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
      if (estado === "Aprobado" && item.estado !== "Aprobado") notificarAprobado({ ...item, estado });
      await recargar();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">📅 Calendario de Contenido</h1>
        <div className="flex gap-2">
          <Link
            href="/biblioteca-marca"
            className="rounded-md border border-brand-brown/40 px-4 py-2 text-sm font-medium text-brand-brown hover:bg-brand-tan/30"
          >
            🎨 Biblioteca de marca
          </Link>
          <button
            onClick={() => setMostrarNuevo(true)}
            className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark"
          >
            + Nuevo contenido
          </button>
        </div>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Posteos planificados para redes sociales — de idea a publicado, con las fotos de pacientes que ya autorizaron
        su uso.
      </p>

      <ProximasFechasEspeciales
        fechas={proximasFechas}
        esDuena={esDuena}
        onCrearContenido={crearContenidoDesdeFecha}
        onAgregar={agregarFechaEspecial}
        onBorrar={borrarFechaEspecial}
      />

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

      {contenidosPorRed.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {contenidosPorRed.map(([red, cant]) => (
            <span key={red} className="rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-600">
              {red}: {cant}
            </span>
          ))}
        </div>
      )}

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
          prefill={borrador}
          pacientesConAutorizacion={pacientesConAutorizacion}
          onClose={() => {
            setMostrarNuevo(false);
            setEnEdicion(null);
            setBorrador(null);
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
