"use client";

import { useEffect, useRef, useState } from "react";
import { fechaDeHoyISO } from "@/lib/agenda";
import { obtenerPacientes } from "@/lib/data/pacientes";
import { obtenerPacientesOrtodoncia } from "@/lib/data/pacientesOrtodoncia";
import {
  eliminarPanoramica,
  obtenerPanoramicasPaciente,
  obtenerUrlPanoramica,
  subirPanoramica,
} from "@/lib/data/panoramicas";

function formatoFecha(fechaISO) {
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}

export default function PanoramicasPage() {
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
  const inputArchivoRef = useRef(null);

  useEffect(() => {
    obtenerPacientes().then(setPacientesGeneral).catch((e) => setError(e.message));
    obtenerPacientesOrtodoncia().then(setPacientesOrtodoncia).catch((e) => setError(e.message));
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
      setCarpeta(await obtenerPanoramicasPaciente(tipo, paciente.id));
    } catch (e) {
      setError(e.message);
    } finally {
      setCargandoCarpeta(false);
    }
  }

  function elegirPaciente(p) {
    setPacienteElegido(p);
    setBusquedaPaciente("");
    recargarCarpeta(tipoPaciente, p);
  }

  async function subir() {
    const archivo = inputArchivoRef.current?.files?.[0];
    if (!archivo) {
      setError("Elegí el archivo de la panorámica.");
      return;
    }
    setSubiendo(true);
    setError(null);
    try {
      await subirPanoramica({
        tipoPaciente,
        pacienteId: pacienteElegido.id,
        pacienteNombre: nombreDe(pacienteElegido),
        archivo,
        fecha,
        observaciones: observaciones.trim(),
      });
      setObservaciones("");
      if (inputArchivoRef.current) inputArchivoRef.current.value = "";
      await recargarCarpeta(tipoPaciente, pacienteElegido);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubiendo(false);
    }
  }

  async function verArchivo(item) {
    try {
      const url = await obtenerUrlPanoramica(item.storagePath);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e.message);
    }
  }

  async function borrar(item) {
    if (!window.confirm(`¿Eliminar "${item.nombreArchivo}"? No se puede deshacer.`)) return;
    try {
      await eliminarPanoramica(item.id, item.storagePath);
      await recargarCarpeta(tipoPaciente, pacienteElegido);
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">🩻 Panorámicas de pacientes</h1>
      <p className="mt-1 text-sm text-gray-500">
        Buscá al paciente y subí la panorámica que te mandaron por mail (bajala primero a tu celu o PC, y después
        subila acá). La carpeta del paciente se arma sola, no hace falta crear nada.
      </p>

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      <div className="mt-4 flex gap-4 text-sm">
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            checked={tipoPaciente === "General"}
            onChange={() => {
              setTipoPaciente("General");
              setPacienteElegido(null);
              setCarpeta([]);
            }}
          />
          Paciente de Odontología General
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            checked={tipoPaciente === "Ortodoncia"}
            onChange={() => {
              setTipoPaciente("Ortodoncia");
              setPacienteElegido(null);
              setCarpeta([]);
            }}
          />
          Paciente de Ortodoncia
        </label>
      </div>

      <div className="mt-3">
        {pacienteElegido ? (
          <div className="flex items-center justify-between rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm">
            <span className="font-medium text-gray-900">📁 {nombreDe(pacienteElegido)}</span>
            <button
              type="button"
              onClick={() => {
                setPacienteElegido(null);
                setCarpeta([]);
              }}
              className="text-xs text-brand-brown hover:underline"
            >
              Cambiar paciente
            </button>
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>

      {pacienteElegido && (
        <>
          <div className="mt-5 rounded-lg border border-gray-200 p-4">
            <p className="mb-3 text-sm font-semibold text-gray-700">Subir nueva panorámica</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex flex-col gap-1 text-xs text-gray-700">
                Archivo
                <input
                  ref={inputArchivoRef}
                  type="file"
                  accept="image/*,.pdf"
                  className="text-sm"
                />
              </label>
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
              Panorámicas de {nombreDe(pacienteElegido)} {carpeta.length > 0 && `(${carpeta.length})`}
            </p>
            {cargandoCarpeta && <p className="text-sm text-gray-500">Cargando...</p>}
            {!cargandoCarpeta && carpeta.length === 0 && (
              <p className="text-sm text-gray-500">Todavía no hay panorámicas cargadas para este paciente.</p>
            )}
            {!cargandoCarpeta && carpeta.length > 0 && (
              <ul className="flex flex-col gap-2">
                {carpeta.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{formatoFecha(item.fecha)} — {item.nombreArchivo}</p>
                      {item.observaciones && <p className="text-xs text-gray-500">{item.observaciones}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      <button type="button" onClick={() => verArchivo(item)} className="text-xs font-medium text-brand-brown hover:underline">
                        Ver / Descargar
                      </button>
                      <button type="button" onClick={() => borrar(item)} className="text-xs text-red-600 hover:underline">
                        Eliminar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </main>
  );
}
