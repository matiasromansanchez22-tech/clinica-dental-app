"use client";

import { useEffect, useState } from "react";
import { fechaDeHoyISO } from "@/lib/agenda";
import {
  TIPOS_EVENTO,
  agregarEventoTrabajo,
  calcularEstadoDemora,
  crearTrabajoLaboratorio,
  eliminarTrabajoLaboratorio,
  obtenerEventosTrabajo,
} from "@/lib/data/laboratorio";

function NuevoTrabajoFormulario({ pacientesGeneral, pacientesOrtodoncia, profesionales, catalogo, onClose, onGuardado }) {
  const [tipoPaciente, setTipoPaciente] = useState("General");
  const [busquedaPaciente, setBusquedaPaciente] = useState("");
  const [pacienteElegido, setPacienteElegido] = useState(null);
  const [tipoTrabajo, setTipoTrabajo] = useState("");
  const [pieza, setPieza] = useState("");
  const [laboratorio, setLaboratorio] = useState("");
  const [profesionalId, setProfesionalId] = useState("");
  const [fechaInicio, setFechaInicio] = useState(fechaDeHoyISO());
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const listaPacientes = tipoPaciente === "General" ? pacientesGeneral : pacientesOrtodoncia;
  const nombreDe = (p) => (tipoPaciente === "General" ? p.apellidoYNombre : p.nombre);
  const coincidencias =
    busquedaPaciente.trim().length >= 2
      ? listaPacientes.filter((p) => nombreDe(p).toLowerCase().includes(busquedaPaciente.trim().toLowerCase())).slice(0, 8)
      : [];

  async function guardar() {
    if (!pacienteElegido || !tipoTrabajo.trim()) {
      setError("Elegí un paciente y completá el tipo de trabajo.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await crearTrabajoLaboratorio({
        tipoPaciente,
        pacienteId: pacienteElegido.id,
        pacienteNombre: nombreDe(pacienteElegido),
        tipoTrabajo: tipoTrabajo.trim(),
        pieza: pieza.trim(),
        laboratorio: laboratorio.trim(),
        profesionalId: profesionalId || null,
        fechaInicio,
        observaciones: observaciones.trim(),
      });
      onGuardado();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Nuevo trabajo de laboratorio</h2>

        {error && <p className="mb-3 text-sm text-red-700">{error}</p>}

        <div className="flex flex-col gap-3">
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                checked={tipoPaciente === "General"}
                onChange={() => {
                  setTipoPaciente("General");
                  setPacienteElegido(null);
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
                }}
              />
              Paciente de Ortodoncia
            </label>
          </div>

          <label className="flex flex-col gap-1 text-xs text-gray-700">
            Paciente
            {pacienteElegido ? (
              <div className="flex items-center justify-between rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm">
                <span className="font-medium text-gray-900">{nombreDe(pacienteElegido)}</span>
                <button type="button" onClick={() => setPacienteElegido(null)} className="text-xs text-brand-brown hover:underline">
                  Cambiar
                </button>
              </div>
            ) : (
              <>
                <input
                  value={busquedaPaciente}
                  onChange={(e) => setBusquedaPaciente(e.target.value)}
                  placeholder="Buscar por nombre..."
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                {coincidencias.length > 0 && (
                  <ul className="mt-1 max-h-40 overflow-y-auto rounded-md border border-gray-200">
                    {coincidencias.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setPacienteElegido(p);
                            setBusquedaPaciente("");
                          }}
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
          </label>

          <label className="flex flex-col gap-1 text-xs text-gray-700">
            Tipo de trabajo
            <input
              list="tipos-trabajo-sugeridos"
              value={tipoTrabajo}
              onChange={(e) => setTipoTrabajo(e.target.value)}
              placeholder="Ej. Prótesis, Corona..."
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
            <datalist id="tipos-trabajo-sugeridos">
              {catalogo.map((c) => (
                <option key={c.id} value={c.prestacion} />
              ))}
            </datalist>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-gray-700">
              Pieza (opcional)
              <input
                value={pieza}
                onChange={(e) => setPieza(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-700">
              Laboratorio / Mecánico (opcional)
              <input
                value={laboratorio}
                onChange={(e) => setLaboratorio(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-gray-700">
              Profesional
              <select
                value={profesionalId}
                onChange={(e) => setProfesionalId(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">(sin especificar)</option>
                {profesionales.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-700">
              Fecha de envío al mecánico
              <input
                type="date"
                value={fechaInicio}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-xs text-gray-700">
            Observaciones
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={2}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            onClick={guardar}
            disabled={guardando}
            className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
          >
            {guardando ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DetalleTrabajo({ trabajo, config, onClose, onGuardado, onEventoGuardado }) {
  const [eventos, setEventos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [nuevo, setNuevo] = useState({ fecha: fechaDeHoyISO(), tipoEvento: "Recibido del mecánico", observaciones: "" });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  async function cargar() {
    setCargando(true);
    try {
      setEventos(await obtenerEventosTrabajo(trabajo.id));
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trabajo.id]);

  async function guardarEvento() {
    if (!nuevo.fecha || !nuevo.tipoEvento) {
      setError("Completá la fecha y el tipo de evento.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await agregarEventoTrabajo(trabajo.id, nuevo);
      setNuevo({ fecha: fechaDeHoyISO(), tipoEvento: "Recibido del mecánico", observaciones: "" });
      setMostrarNuevo(false);
      await cargar();
      await onEventoGuardado();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  async function borrarTrabajo() {
    if (!window.confirm("¿Enviar este trabajo a la papelera de reciclaje?")) return;
    try {
      await eliminarTrabajoLaboratorio(trabajo.id);
      onGuardado();
      onClose();
    } catch (e) {
      setError(e.message);
    }
  }

  const demora = calcularEstadoDemora(trabajo.fechaUltimoEvento, trabajo.estado, config);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
        <div className="mb-1 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{trabajo.pacienteNombre}</h2>
            <p className="text-sm text-gray-500">
              {trabajo.tipoTrabajo}
              {trabajo.pieza ? ` — pieza ${trabajo.pieza}` : ""}
              {trabajo.laboratorio ? ` — ${trabajo.laboratorio}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="text-sm text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        <p className={`mb-4 text-sm font-medium ${demora.color}`}>
          {demora.emoji} {trabajo.estado} — {demora.texto}
        </p>

        {error && <p className="mb-2 text-sm text-red-700">{error}</p>}

        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase text-gray-400">Historial de idas y vueltas</p>
          <button
            type="button"
            onClick={() => setMostrarNuevo((v) => !v)}
            className="rounded-md border border-brand-brown/40 px-3 py-1 text-xs font-medium text-brand-brown hover:bg-brand-tan/30"
          >
            + Nuevo evento
          </button>
        </div>

        {mostrarNuevo && (
          <div className="mb-3 flex flex-col gap-2 rounded-md border border-gray-200 bg-gray-50 p-3">
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-xs text-gray-700">
                Fecha
                <input
                  type="date"
                  value={nuevo.fecha}
                  onChange={(e) => setNuevo((n) => ({ ...n, fecha: e.target.value }))}
                  className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-gray-700">
                Evento
                <select
                  value={nuevo.tipoEvento}
                  onChange={(e) => setNuevo((n) => ({ ...n, tipoEvento: e.target.value }))}
                  className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                >
                  {TIPOS_EVENTO.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="flex flex-col gap-1 text-xs text-gray-700">
              Observaciones
              <textarea
                value={nuevo.observaciones}
                onChange={(e) => setNuevo((n) => ({ ...n, observaciones: e.target.value }))}
                rows={2}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMostrarNuevo(false)}
                className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardarEvento}
                disabled={guardando}
                className="rounded-md bg-brand-brown px-3 py-1 text-xs font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
              >
                {guardando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        )}

        {cargando ? (
          <p className="text-xs text-gray-500">Cargando...</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {eventos.map((e) => (
              <li key={e.id} className="rounded-md border border-gray-200 px-3 py-2 text-sm">
                <div className="font-medium text-gray-700">
                  {e.fecha} — {e.tipoEvento}
                </div>
                {e.observaciones && <p className="mt-0.5 text-gray-600">{e.observaciones}</p>}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 flex justify-between">
          <button onClick={borrarTrabajo} className="text-xs text-red-600 hover:underline">
            Enviar a la papelera
          </button>
          <button onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TrabajoLaboratorioModal({
  trabajo,
  pacientesGeneral,
  pacientesOrtodoncia,
  profesionales,
  catalogo,
  config,
  onClose,
  onGuardado,
  onEventoGuardado,
}) {
  if (trabajo) {
    return (
      <DetalleTrabajo trabajo={trabajo} config={config} onClose={onClose} onGuardado={onGuardado} onEventoGuardado={onEventoGuardado} />
    );
  }
  return (
    <NuevoTrabajoFormulario
      pacientesGeneral={pacientesGeneral}
      pacientesOrtodoncia={pacientesOrtodoncia}
      profesionales={profesionales}
      catalogo={catalogo}
      onClose={onClose}
      onGuardado={onGuardado}
    />
  );
}
