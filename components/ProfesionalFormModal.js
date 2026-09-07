"use client";

import { useState } from "react";
import { NOMBRES_DIA_SEMANA } from "@/lib/agenda";
import {
  actualizarBloqueDisponibilidad,
  actualizarProfesional,
  agregarBloqueDisponibilidad,
  crearProfesional,
  eliminarBloqueDisponibilidad,
  eliminarProfesional,
} from "@/lib/data/profesionales";

const CONSULTORIOS_DISPONIBLES = [1, 2, 3];

function bloqueVacio() {
  return { diaSemana: 1, horaInicio: "08:00", horaFin: "14:00", consultorio: 1 };
}

function bloquesDesdeProfesional(profesional) {
  return (profesional?.disponibilidad_profesional || [])
    .filter((b) => b.activo)
    .map((b) => ({
      id: b.id,
      diaSemana: b.dia_semana,
      horaInicio: b.hora_inicio.slice(0, 5),
      horaFin: b.hora_fin.slice(0, 5),
      consultorio: b.consultorio || 1,
    }));
}

export default function ProfesionalFormModal({ profesional, onClose, onGuardado }) {
  const esEdicion = !!profesional;
  const [nombre, setNombre] = useState(profesional?.nombre || "");
  const [especialidad, setEspecialidad] = useState(profesional?.especialidad || "");
  const [porcentajeCopago, setPorcentajeCopago] = useState(profesional?.porcentaje_honorarios_copago ?? 30);
  const [porcentajeOS, setPorcentajeOS] = useState(profesional?.porcentaje_honorarios_os ?? 20);
  const [observaciones, setObservaciones] = useState(profesional?.observaciones || "");
  const [activo, setActivo] = useState(profesional?.activo ?? true);
  const [bloques, setBloques] = useState(esEdicion ? bloquesDesdeProfesional(profesional) : [bloqueVacio()]);
  const [guardando, setGuardando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [error, setError] = useState(null);

  function actualizarBloqueLocal(i, cambios) {
    setBloques((bs) => bs.map((b, idx) => (idx === i ? { ...b, ...cambios } : b)));
  }

  function agregarBloque() {
    setBloques((bs) => [...bs, bloqueVacio()]);
  }

  function quitarBloque(i) {
    setBloques((bs) => bs.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!nombre.trim()) {
      setError("Falta el nombre del profesional.");
      return;
    }
    setGuardando(true);
    try {
      const datos = {
        nombre: nombre.trim(),
        especialidad: especialidad.trim(),
        observaciones: observaciones.trim(),
        porcentajeHonorariosCopago: Number(porcentajeCopago),
        porcentajeHonorariosOS: Number(porcentajeOS),
        activo,
      };

      let profesionalId = profesional?.id;
      if (esEdicion) {
        await actualizarProfesional(profesional.id, datos);
      } else {
        const creado = await crearProfesional(datos);
        profesionalId = creado.id;
      }

      const idsOriginales = esEdicion ? bloquesDesdeProfesional(profesional).map((b) => b.id) : [];
      const idsActuales = bloques.filter((b) => b.id).map((b) => b.id);
      for (const id of idsOriginales) {
        if (!idsActuales.includes(id)) await eliminarBloqueDisponibilidad(id);
      }
      for (const b of bloques) {
        if (!b.horaInicio || !b.horaFin) continue;
        if (b.id) {
          await actualizarBloqueDisponibilidad(b.id, b);
        } else {
          await agregarBloqueDisponibilidad(profesionalId, b);
        }
      }

      onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function handleBorrar() {
    if (!window.confirm(`¿Enviar a la papelera de reciclaje a "${profesional.nombre}"? Se puede restaurar después.`)) return;
    setBorrando(true);
    setError(null);
    try {
      await eliminarProfesional(profesional.id);
      onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setBorrando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold text-brand-brown">
            {esEdicion ? "Editar profesional" : "Nuevo profesional"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Nombre
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Juan Pérez"
              className="rounded-md border border-gray-300 px-2 py-1.5"
              autoFocus
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Especialidad
              <input
                value={especialidad}
                onChange={(e) => setEspecialidad(e.target.value)}
                placeholder="Ej. Endodoncia"
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Estado
              <select
                value={activo ? "Activo" : "Inactivo"}
                onChange={(e) => setActivo(e.target.value === "Activo")}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              >
                <option value="Activo">Activo</option>
                <option value="Inactivo">Inactivo</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              % Honorarios (Copago/Particular)
              <input
                type="number"
                value={porcentajeCopago}
                onChange={(e) => setPorcentajeCopago(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              % Honorarios (Obra Social)
              <input
                type="number"
                value={porcentajeOS}
                onChange={(e) => setPorcentajeOS(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Observaciones
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={2}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            />
          </label>

          <div className="mt-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-700">Disponibilidad semanal</p>
              <button
                type="button"
                onClick={agregarBloque}
                className="text-xs font-medium text-brand-brown hover:underline"
              >
                + Agregar bloque
              </button>
            </div>
            <div className="mt-2 flex flex-col gap-2">
              {bloques.map((b, i) => (
                <div key={b.id || `nuevo-${i}`} className="flex flex-wrap items-center gap-2 rounded-md border border-gray-200 p-2">
                  <select
                    value={b.diaSemana}
                    onChange={(e) => actualizarBloqueLocal(i, { diaSemana: Number(e.target.value) })}
                    className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                  >
                    {NOMBRES_DIA_SEMANA.map((nombreDia, dia) => (
                      <option key={dia} value={dia}>
                        {nombreDia}
                      </option>
                    ))}
                  </select>
                  <input
                    type="time"
                    value={b.horaInicio}
                    onChange={(e) => actualizarBloqueLocal(i, { horaInicio: e.target.value })}
                    className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                  />
                  <span className="text-xs text-gray-400">a</span>
                  <input
                    type="time"
                    value={b.horaFin}
                    onChange={(e) => actualizarBloqueLocal(i, { horaFin: e.target.value })}
                    className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                  />
                  <select
                    value={b.consultorio}
                    onChange={(e) => actualizarBloqueLocal(i, { consultorio: Number(e.target.value) })}
                    className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                  >
                    {CONSULTORIOS_DISPONIBLES.map((c) => (
                      <option key={c} value={c}>
                        Consultorio {c}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => quitarBloque(i)}
                    className="ml-auto text-xs text-red-600 hover:underline"
                  >
                    Quitar
                  </button>
                </div>
              ))}
              {bloques.length === 0 && (
                <p className="text-xs text-gray-400">
                  Sin bloques cargados — se puede completar más adelante desde acá mismo.
                </p>
              )}
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            {esEdicion ? (
              <button
                type="button"
                onClick={handleBorrar}
                disabled={borrando}
                className="text-sm font-medium text-red-600 hover:underline disabled:opacity-50"
              >
                {borrando ? "Borrando..." : "🗑️ Borrar"}
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
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
                {guardando ? "Guardando..." : esEdicion ? "Guardar cambios" : "Crear profesional"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
