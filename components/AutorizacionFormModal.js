"use client";

import { useState } from "react";
import { fechaDeHoyISO } from "@/lib/agenda";

export default function AutorizacionFormModal({ autorizacion, pacientes, obrasSociales, onClose, onGuardar }) {
  const [pacienteElegido, setPacienteElegido] = useState(
    autorizacion ? { id: autorizacion.pacienteId, apellido_y_nombre: autorizacion.pacienteNombre } : null
  );
  const [busqueda, setBusqueda] = useState("");
  const [obraSocial, setObraSocial] = useState(autorizacion?.obraSocial || "");
  const [numeroAfiliado, setNumeroAfiliado] = useState(autorizacion?.numeroAfiliado || "");
  const [prestacion, setPrestacion] = useState(autorizacion?.prestacion || "");
  const [estado, setEstado] = useState(autorizacion?.estado || "Para autorizar");
  const [fechaPedido, setFechaPedido] = useState(autorizacion?.fechaPedido || fechaDeHoyISO());
  const [fechaAutorizacion, setFechaAutorizacion] = useState(autorizacion?.fechaAutorizacion || "");
  const [numeroAutorizacion, setNumeroAutorizacion] = useState(autorizacion?.numeroAutorizacion || "");
  const [observaciones, setObservaciones] = useState(autorizacion?.observaciones || "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const coincidencias =
    !pacienteElegido && busqueda.trim().length >= 2
      ? pacientes
          .filter((p) => {
            const q = busqueda.trim().toLowerCase();
            return (p.apellido_y_nombre || "").toLowerCase().includes(q) || (p.dni || "").includes(q);
          })
          .slice(0, 8)
      : [];

  function elegirPaciente(p) {
    setPacienteElegido(p);
    setBusqueda("");
    if (p.obra_social) setObraSocial(p.obra_social);
    if (p.numero_afiliado) setNumeroAfiliado(p.numero_afiliado);
  }

  async function guardar() {
    setError(null);
    if (!pacienteElegido) return setError("Elegí un paciente.");
    if (!obraSocial.trim()) return setError("Completá la obra social.");
    if (!prestacion.trim()) return setError("Completá qué se pide autorizar.");
    setGuardando(true);
    try {
      await onGuardar({
        pacienteId: pacienteElegido.id,
        obraSocial,
        numeroAfiliado,
        prestacion,
        estado,
        fechaPedido,
        fechaAutorizacion: estado === "Autorizada" ? fechaAutorizacion || fechaDeHoyISO() : null,
        numeroAutorizacion,
        observaciones,
      });
    } catch (e) {
      setError(e.message);
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold text-brand-brown">
            {autorizacion ? "Editar autorización" : "Nueva ficha para autorizar"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
        )}

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1 text-xs text-gray-700">
            Paciente
            {pacienteElegido ? (
              <div className="flex items-center justify-between rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm">
                <span className="font-medium text-gray-900">{pacienteElegido.apellido_y_nombre}</span>
                {!autorizacion && (
                  <button
                    type="button"
                    onClick={() => setPacienteElegido(null)}
                    className="text-xs text-brand-brown hover:underline"
                  >
                    Cambiar
                  </button>
                )}
              </div>
            ) : (
              <>
                <input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre o DNI..."
                  className="rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
                {coincidencias.length > 0 && (
                  <ul className="mt-1 max-h-40 overflow-y-auto rounded-md border border-gray-200">
                    {coincidencias.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => elegirPaciente(p)}
                          className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                        >
                          {p.apellido_y_nombre}
                          {p.obra_social && <span className="ml-2 text-xs text-gray-400">{p.obra_social}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-gray-700">
              Obra social
              <input
                value={obraSocial}
                onChange={(e) => setObraSocial(e.target.value)}
                list="autorizaciones-obras-sociales"
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
              <datalist id="autorizaciones-obras-sociales">
                {obrasSociales.map((o) => (
                  <option key={o} value={o} />
                ))}
              </datalist>
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-700">
              N° de afiliado
              <input
                value={numeroAfiliado}
                onChange={(e) => setNumeroAfiliado(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-xs text-gray-700">
            Qué se pide autorizar
            <textarea
              value={prestacion}
              onChange={(e) => setPrestacion(e.target.value)}
              rows={2}
              placeholder="Ej: Endodoncia pieza 36 + corona de porcelana"
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-gray-700">
              Estado
              <select
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="Para autorizar">Para autorizar</option>
                <option value="Autorizada">Autorizada</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-700">
              Fecha del pedido
              <input
                type="date"
                value={fechaPedido}
                onChange={(e) => setFechaPedido(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
          </div>

          {estado === "Autorizada" && (
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs text-gray-700">
                N° de autorización
                <input
                  value={numeroAutorizacion}
                  onChange={(e) => setNumeroAutorizacion(e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-gray-700">
                Fecha de autorización
                <input
                  type="date"
                  value={fechaAutorizacion || fechaDeHoyISO()}
                  onChange={(e) => setFechaAutorizacion(e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
              </label>
            </div>
          )}

          <label className="flex flex-col gap-1 text-xs text-gray-700">
            Observaciones
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={2}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancelar
          </button>
          <button
            type="button"
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
