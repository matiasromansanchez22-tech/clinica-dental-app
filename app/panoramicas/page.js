"use client";

import { useEffect, useRef, useState } from "react";
import { fechaDeHoyISO } from "@/lib/agenda";
import { obtenerPacientes } from "@/lib/data/pacientes";
import { obtenerPacientesOrtodoncia } from "@/lib/data/pacientesOrtodoncia";
import {
  eliminarPanoramica,
  obtenerCarpetasPanoramicas,
  obtenerPanoramicasPaciente,
  obtenerUrlPanoramica,
  subirPanoramica,
} from "@/lib/data/panoramicas";

function formatoFecha(fechaISO) {
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}

export default function PanoramicasPage() {
  const [carpetas, setCarpetas] = useState([]);
  const [cargandoCarpetas, setCargandoCarpetas] = useState(true);

  const [tipoPaciente, setTipoPaciente] = useState("General");
  const [pacientesGeneral, setPacientesGeneral] = useState([]);
  const [pacientesOrtodoncia, setPacientesOrtodoncia] = useState([]);
  const [busquedaPaciente, setBusquedaPaciente] = useState("");
  const [pacienteElegido, setPacienteElegido] = useState(null);
  const [carpeta, setCarpeta] = useState([]);
  const [cargandoCarpeta, setCargandoCarpeta] = useState(false);
  const [error, setError] = useState(null);
  const [subiendo, setSubiendo] = useState(false);
  const [fecha, setFecha] = useState(fechaDeHoyISO());
  const [observaciones, setObservaciones] = useState("");
  const [archivoSeleccionado, setArchivoSeleccionado] = useState(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [urls, setUrls] = useState({});
  const [imagenAmpliada, setImagenAmpliada] = useState(null);
  const inputArchivoRef = useRef(null);

  function recargarCarpetas() {
    setCargandoCarpetas(true);
    obtenerCarpetasPanoramicas()
      .then(setCarpetas)
      .catch((e) => setError(e.message))
      .finally(() => setCargandoCarpetas(false));
  }

  useEffect(() => {
    obtenerPacientes().then(setPacientesGeneral).catch((e) => setError(e.message));
    obtenerPacientesOrtodoncia().then(setPacientesOrtodoncia).catch((e) => setError(e.message));
    recargarCarpetas();
  }, []);

  const listaPacientes = tipoPaciente === "General" ? pacientesGeneral : pacientesOrtodoncia;
  const nombreDe = (p) => (tipoPaciente === "General" ? p.apellidoYNombre : p.nombre);
  const coincidencias =
    busquedaPaciente.trim().length >= 2
      ? listaPacientes.filter((p) => nombreDe(p).toLowerCase().includes(busquedaPaciente.trim().toLowerCase())).slice(0, 8)
      : [];

  async function recargarCarpeta(tipo, paciente) {
    setCargandoCarpeta(true);
    setError(null);
    try {
      const items = await obtenerPanoramicasPaciente(tipo, paciente.id);
      setCarpeta(items);
      // Pide de una todas las URLs para mostrar las miniaturas — son pocas
      // fotos por paciente, no hace falta pedirlas de a una al hacer clic.
      const entradas = await Promise.all(
        items.map(async (item) => {
          try {
            return [item.id, await obtenerUrlPanoramica(item.storagePath)];
          } catch {
            return [item.id, null];
          }
        })
      );
      setUrls(Object.fromEntries(entradas));
    } catch (e) {
      setError(e.message);
    } finally {
      setCargandoCarpeta(false);
    }
  }

  function abrirCarpeta(tipo, paciente) {
    setTipoPaciente(tipo);
    setPacienteElegido(paciente);
    setBusquedaPaciente("");
    recargarCarpeta(tipo, paciente);
  }

  function elegirPaciente(p) {
    abrirCarpeta(tipoPaciente, { id: p.id });
    setPacienteElegido(p);
  }

  function volverACarpetas() {
    setPacienteElegido(null);
    setCarpeta([]);
    recargarCarpetas();
  }

  function elegirArchivo(archivo) {
    if (!archivo) return;
    setArchivoSeleccionado(archivo);
    setError(null);
  }

  function alSoltar(e) {
    e.preventDefault();
    setArrastrando(false);
    elegirArchivo(e.dataTransfer.files?.[0]);
  }

  async function subir() {
    if (!archivoSeleccionado) {
      setError("Elegí o arrastrá el archivo de la panorámica.");
      return;
    }
    setSubiendo(true);
    setError(null);
    try {
      await subirPanoramica({
        tipoPaciente,
        pacienteId: pacienteElegido.id,
        pacienteNombre: nombreDe(pacienteElegido),
        archivo: archivoSeleccionado,
        fecha,
        observaciones: observaciones.trim(),
      });
      setObservaciones("");
      setArchivoSeleccionado(null);
      if (inputArchivoRef.current) inputArchivoRef.current.value = "";
      await recargarCarpeta(tipoPaciente, pacienteElegido);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubiendo(false);
    }
  }

  async function borrar(item) {
    if (!window.confirm(`¿Eliminar "${item.nombreArchivo}"? No se puede deshacer.`)) return;
    try {
      await eliminarPanoramica(item.id, item.storagePath);
      if (imagenAmpliada?.id === item.id) setImagenAmpliada(null);
      await recargarCarpeta(tipoPaciente, pacienteElegido);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">🩻 Panorámicas de pacientes</h1>
      <p className="mt-1 text-sm text-gray-500">
        Cada paciente tiene su propia carpeta, armada sola apenas se sube la primera foto. Bajá el adjunto del mail
        (o arrastralo directo) y subilo acá.
      </p>

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      {!pacienteElegido && (
        <>
          <div className="mt-5">
            <p className="mb-2 text-sm font-semibold text-gray-700">Carpetas de pacientes</p>
            {cargandoCarpetas && <p className="text-sm text-gray-500">Cargando...</p>}
            {!cargandoCarpetas && carpetas.length === 0 && (
              <p className="text-sm text-gray-500">Todavía no hay ninguna carpeta. Buscá un paciente más abajo para crear la primera.</p>
            )}
            {!cargandoCarpetas && carpetas.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {carpetas.map((c) => (
                  <button
                    key={`${c.tipoPaciente}:${c.pacienteId}`}
                    type="button"
                    onClick={() => abrirCarpeta(c.tipoPaciente, { id: c.pacienteId, apellidoYNombre: c.pacienteNombre, nombre: c.pacienteNombre })}
                    className="flex flex-col items-center gap-1 rounded-lg border border-gray-200 bg-white p-4 text-center hover:border-brand-brown hover:bg-brand-tan/20"
                  >
                    <span className="text-3xl">📁</span>
                    <span className="text-sm font-medium text-gray-900">{c.pacienteNombre}</span>
                    <span className="text-xs text-gray-500">
                      {c.cantidad} foto{c.cantidad === 1 ? "" : "s"} · {formatoFecha(c.ultimaFecha)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 border-t border-gray-200 pt-5">
            <p className="mb-2 text-sm font-semibold text-gray-700">Buscar paciente (para abrir o crear su carpeta)</p>
            <div className="mb-3 flex gap-4 text-sm">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={tipoPaciente === "General"}
                  onChange={() => setTipoPaciente("General")}
                />
                Paciente de Odontología General
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  checked={tipoPaciente === "Ortodoncia"}
                  onChange={() => setTipoPaciente("Ortodoncia")}
                />
                Paciente de Ortodoncia
              </label>
            </div>
            <input
              value={busquedaPaciente}
              onChange={(e) => setBusquedaPaciente(e.target.value)}
              placeholder="Buscar paciente por nombre..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            {coincidencias.length > 0 && (
              <ul className="mt-1 max-h-48 overflow-y-auto rounded-md border border-gray-200">
                {coincidencias.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => elegirPaciente(p)}
                      className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                    >
                      {nombreDe(p)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {pacienteElegido && (
        <>
          <div className="flex items-center justify-between rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm">
            <span className="font-medium text-gray-900">📁 {nombreDe(pacienteElegido)}</span>
            <button type="button" onClick={volverACarpetas} className="text-xs text-brand-brown hover:underline">
              ← Volver a las carpetas
            </button>
          </div>

          <div className="mt-5 rounded-lg border border-gray-200 p-4">
            <p className="mb-3 text-sm font-semibold text-gray-700">Subir nueva panorámica</p>

            <label
              onDragOver={(e) => {
                e.preventDefault();
                setArrastrando(true);
              }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={alSoltar}
              className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed px-4 py-6 text-center text-sm transition-colors ${
                arrastrando ? "border-brand-brown bg-brand-tan/30" : "border-gray-300 bg-gray-50 hover:bg-gray-100"
              }`}
            >
              <input
                ref={inputArchivoRef}
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => elegirArchivo(e.target.files?.[0])}
                className="hidden"
              />
              {archivoSeleccionado ? (
                <span className="font-medium text-gray-900">📎 {archivoSeleccionado.name}</span>
              ) : (
                <>
                  <span className="text-gray-600">
                    Arrastrá acá el adjunto directo desde el mail (o hacé clic para elegirlo)
                  </span>
                  <span className="text-xs text-gray-400">Tip: abrí el mail en otra pestaña y arrastrá el archivo hasta acá</span>
                </>
              )}
            </label>

            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex flex-col gap-1 text-xs text-gray-700">
                Fecha
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="flex flex-1 flex-col gap-1 text-xs text-gray-700">
                Observaciones (opcional)
                <input
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
              </label>
              <button
                type="button"
                onClick={subir}
                disabled={subiendo}
                className="h-fit rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
              >
                {subiendo ? "Subiendo..." : "Subir"}
              </button>
            </div>
          </div>

          <div className="mt-5">
            <p className="mb-2 text-sm font-semibold text-gray-700">
              Fotos de {nombreDe(pacienteElegido)} {carpeta.length > 0 && `(${carpeta.length})`}
            </p>
            {cargandoCarpeta && <p className="text-sm text-gray-500">Cargando...</p>}
            {!cargandoCarpeta && carpeta.length === 0 && (
              <p className="text-sm text-gray-500">Todavía no hay panorámicas cargadas para este paciente.</p>
            )}
            {!cargandoCarpeta && carpeta.length > 0 && (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {carpeta.map((item) => {
                  const esPdf = item.nombreArchivo.toLowerCase().endsWith(".pdf");
                  return (
                    <div key={item.id} className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => setImagenAmpliada(item)}
                        title={item.nombreArchivo}
                        className="flex aspect-square items-center justify-center overflow-hidden rounded-md border border-gray-200 bg-gray-100 hover:opacity-90"
                      >
                        {esPdf ? (
                          <span className="text-3xl">📄</span>
                        ) : urls[item.id] ? (
                          <img src={urls[item.id]} alt={item.nombreArchivo} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-xs text-gray-400">Cargando...</span>
                        )}
                      </button>
                      <p className="truncate text-center text-xs text-gray-500">{formatoFecha(item.fecha)}</p>
                      <button
                        type="button"
                        onClick={() => borrar(item)}
                        className="text-center text-xs text-red-600 hover:underline"
                      >
                        Eliminar
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {imagenAmpliada && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setImagenAmpliada(null)}
        >
          <div className="flex max-h-full max-w-4xl flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex w-full items-center justify-between text-sm text-white">
              <span>
                {formatoFecha(imagenAmpliada.fecha)} — {imagenAmpliada.nombreArchivo}
              </span>
              <button type="button" onClick={() => setImagenAmpliada(null)} className="text-xl hover:text-gray-300">
                ✕
              </button>
            </div>
            {!urls[imagenAmpliada.id] ? (
              <p className="text-white">Cargando...</p>
            ) : imagenAmpliada.nombreArchivo.toLowerCase().endsWith(".pdf") ? (
              <iframe src={urls[imagenAmpliada.id]} className="h-[80vh] w-[85vw] rounded-md bg-white" />
            ) : (
              <img
                src={urls[imagenAmpliada.id]}
                alt={imagenAmpliada.nombreArchivo}
                className="max-h-[80vh] max-w-full rounded-md"
              />
            )}
          </div>
        </div>
      )}
    </main>
  );
}
