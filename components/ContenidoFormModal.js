"use client";

import { useState } from "react";
import { fechaDeHoyISO } from "@/lib/agenda";
import { ESTADOS_CONTENIDO, REDES_SOCIALES } from "@/lib/data/calendarioContenido";

export default function ContenidoFormModal({ contenido, prefill, pacientesConAutorizacion, onClose, onGuardar }) {
  const [fecha, setFecha] = useState(contenido?.fecha || prefill?.fecha || fechaDeHoyISO());
  const [redSocial, setRedSocial] = useState(contenido?.redSocial || REDES_SOCIALES[0]);
  const [estado, setEstado] = useState(contenido?.estado || "Idea");
  const [texto, setTexto] = useState(contenido?.texto || prefill?.texto || "");
  const [observaciones, setObservaciones] = useState(contenido?.observaciones || "");
  const [pacienteElegido, setPacienteElegido] = useState(
    contenido?.pacienteId ? { id: contenido.pacienteId, tipo: contenido.tipoPaciente, nombre: contenido.pacienteNombre } : null
  );
  const [busquedaPaciente, setBusquedaPaciente] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const coincidencias =
    busquedaPaciente.trim().length >= 2
      ? pacientesConAutorizacion.filter((p) => p.nombre.toLowerCase().includes(busquedaPaciente.trim().toLowerCase())).slice(0, 8)
      : [];

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!fecha) {
      setError("Falta la fecha.");
      return;
    }
    setGuardando(true);
    try {
      await onGuardar({
        fecha,
        redSocial,
        estado,
        texto: texto.trim(),
        observaciones: observaciones.trim(),
        tipoPaciente: pacienteElegido?.tipo || null,
        pacienteId: pacienteElegido?.id || null,
        pacienteNombre: pacienteElegido?.nombre || null,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold text-brand-brown">
            {contenido ? "Editar contenido" : "Nuevo contenido"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-3">
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Fecha
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Red social
              <select
                value={redSocial}
                onChange={(e) => setRedSocial(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              >
                {REDES_SOCIALES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Estado
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              >
                {ESTADOS_CONTENIDO.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Texto / copy del posteo
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={4}
              placeholder="Lo que va a decir el posteo..."
              className="rounded-md border border-gray-300 px-2 py-1.5"
            />
          </label>

          <div className="flex flex-col gap-1 text-sm text-gray-700">
            ¿Usa fotos de algún paciente? (opcional)
            {pacienteElegido ? (
              <div className="flex items-center justify-between rounded-md border border-gray-300 bg-gray-50 px-3 py-2">
                <span>
                  📁 {pacienteElegido.nombre} <span className="text-xs text-gray-400">({pacienteElegido.tipo})</span>
                </span>
                <button type="button" onClick={() => setPacienteElegido(null)} className="text-xs text-red-600 hover:underline">
                  Quitar
                </button>
              </div>
            ) : (
              <>
                <input
                  value={busquedaPaciente}
                  onChange={(e) => setBusquedaPaciente(e.target.value)}
                  placeholder="Buscar paciente que autorizó fotos en redes..."
                  className="rounded-md border border-gray-300 px-2 py-1.5"
                />
                {coincidencias.length > 0 && (
                  <ul className="max-h-40 overflow-y-auto rounded-md border border-gray-200">
                    {coincidencias.map((p) => (
                      <li key={`${p.tipo}:${p.id}`}>
                        <button
                          type="button"
                          onClick={() => {
                            setPacienteElegido(p);
                            setBusquedaPaciente("");
                          }}
                          className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                        >
                          {p.nombre} <span className="text-xs text-gray-400">({p.tipo})</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {busquedaPaciente.trim().length >= 2 && coincidencias.length === 0 && (
                  <p className="text-xs text-gray-400">
                    Sin resultados — solo aparecen pacientes que ya autorizaron el uso de sus fotos en redes.
                  </p>
                )}
              </>
            )}
          </div>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Observaciones internas (opcional)
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={2}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            />
          </label>

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
            >
              {guardando ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
