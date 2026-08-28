"use client";

import { useRef, useState } from "react";
import {
  actualizarConfiguracionCopagoParticular,
  actualizarExcepcionCopago,
  aplicarPorcentajeExcepcion,
  crearExcepcionCopago,
  eliminarExcepcionCopago,
  recalcularCopagosSobreParticular,
} from "@/lib/data/nomenclador";

export default function ConfiguracionCopagoModal({ porcentajeParticular, excepciones, onClose, onCambiado }) {
  const [porcentaje, setPorcentaje] = useState(porcentajeParticular);
  const [filasExcepcion, setFilasExcepcion] = useState(excepciones);
  const [nuevaObraSocial, setNuevaObraSocial] = useState("");
  const [nuevoPorcentaje, setNuevoPorcentaje] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [recalculando, setRecalculando] = useState(false);
  const [aplicandoId, setAplicandoId] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);
  const inputsPorcentaje = useRef({});

  async function guardarPorcentaje() {
    setError(null);
    try {
      await actualizarConfiguracionCopagoParticular(Number(porcentaje));
      onCambiado();
    } catch (e) {
      setError(e.message);
    }
  }

  async function recalcularTodo() {
    if (
      !window.confirm(
        `¿Recalcular el copago de TODAS las prestaciones (menos las obras sociales con excepción) a ${porcentaje}% del valor particular? Esto va a actualizar miles de filas del nomenclador.`
      )
    )
      return;
    setRecalculando(true);
    setError(null);
    setResultado(null);
    try {
      await actualizarConfiguracionCopagoParticular(Number(porcentaje));
      const r = await recalcularCopagosSobreParticular();
      setResultado(r);
      onCambiado();
    } catch (e) {
      setError(e.message);
    } finally {
      setRecalculando(false);
    }
  }

  async function guardarExcepcion(id, porcentaje) {
    setError(null);
    try {
      await actualizarExcepcionCopago(id, { porcentaje: Number(porcentaje) });
      onCambiado();
    } catch (e) {
      setError(e.message);
    }
  }

  async function borrarExcepcion(id) {
    if (!window.confirm("¿Quitar esta excepción? Esa obra social va a volver a usar el % general.")) return;
    setError(null);
    try {
      await eliminarExcepcionCopago(id);
      setFilasExcepcion((f) => f.filter((x) => x.id !== id));
      onCambiado();
    } catch (e) {
      setError(e.message);
    }
  }

  async function aplicarPorcentaje(fila) {
    const porcentajeActual = Number(inputsPorcentaje.current[fila.id]?.value ?? fila.porcentaje);
    if (
      !window.confirm(
        `¿Aplicar ${porcentajeActual}% sobre el valor de "${fila.obra_social}" a TODAS sus prestaciones del Nomenclador? Esto pisa el copago que tengan cargado ahora.`
      )
    )
      return;
    setAplicandoId(fila.id);
    setError(null);
    setResultado(null);
    try {
      await guardarExcepcion(fila.id, porcentajeActual);
      const r = await aplicarPorcentajeExcepcion(fila.obra_social, porcentajeActual);
      setResultado({ actualizadas: r.actualizadas, omitidas: 0 });
      onCambiado();
    } catch (e) {
      setError(e.message);
    } finally {
      setAplicandoId(null);
    }
  }

  async function agregarExcepcion(e) {
    e.preventDefault();
    if (!nuevaObraSocial.trim() || !nuevoPorcentaje) return;
    setGuardando(true);
    setError(null);
    try {
      await crearExcepcionCopago({ obraSocial: nuevaObraSocial.trim(), porcentaje: Number(nuevoPorcentaje) });
      setNuevaObraSocial("");
      setNuevoPorcentaje("");
      onCambiado();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Configuración del copago</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
        )}
        {resultado && (
          <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            Listo: {resultado.actualizadas} filas recalculadas, {resultado.omitidas} omitidas (excepciones o sin
            precio particular).
          </div>
        )}

        <h3 className="mb-2 text-sm font-semibold text-gray-900">Copago general (% del valor particular)</h3>
        <p className="mb-2 text-xs text-gray-500">
          El copago de cada prestación se fija como este % de lo que cobrás particular por esa misma prestación,
          para todas las obras sociales sin excepción propia.
        </p>
        <div className="mb-3 flex items-center gap-2 text-sm">
          <input
            type="number"
            value={porcentaje}
            onChange={(e) => setPorcentaje(e.target.value)}
            onBlur={guardarPorcentaje}
            className="w-20 rounded-md border border-gray-300 px-2 py-1"
          />
          <span className="text-gray-500">% del valor particular</span>
        </div>
        <button
          type="button"
          onClick={recalcularTodo}
          disabled={recalculando}
          className="mb-6 rounded-md bg-brand-brown px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
        >
          {recalculando ? "Recalculando..." : "Recalcular todos los copagos ahora"}
        </button>

        <h3 className="mb-2 text-sm font-semibold text-gray-900">Excepciones por obra social</h3>
        <p className="mb-2 text-xs text-gray-500">
          Una obra social con excepción usa este porcentaje fijo sobre su Valor OS en vez del % general (ej. IAPOS =
          200%).
        </p>
        <div className="mb-3 flex flex-col gap-2">
          {filasExcepcion.map((fila) => (
            <div key={fila.id} className="flex items-center gap-2 text-sm">
              <span className="w-32 truncate text-gray-800">{fila.obra_social}</span>
              <input
                ref={(el) => (inputsPorcentaje.current[fila.id] = el)}
                type="number"
                defaultValue={fila.porcentaje}
                onBlur={(e) => guardarExcepcion(fila.id, e.target.value)}
                className="w-20 rounded-md border border-gray-300 px-2 py-1"
              />
              <button
                onClick={() => aplicarPorcentaje(fila)}
                disabled={aplicandoId === fila.id}
                className="text-xs text-brand-brown hover:underline disabled:opacity-50"
              >
                {aplicandoId === fila.id ? "Aplicando..." : "Aplicar %"}
              </button>
              <span className="text-gray-500">%</span>
              <button onClick={() => borrarExcepcion(fila.id)} className="ml-auto text-xs text-red-600 hover:underline">
                Quitar
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={agregarExcepcion} className="flex items-center gap-2">
          <input
            value={nuevaObraSocial}
            onChange={(e) => setNuevaObraSocial(e.target.value)}
            placeholder="Nombre de la obra social"
            className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
          <input
            type="number"
            value={nuevoPorcentaje}
            onChange={(e) => setNuevoPorcentaje(e.target.value)}
            placeholder="%"
            className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={guardando}
            className="rounded-md bg-brand-brown px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
          >
            Agregar
          </button>
        </form>
      </div>
    </div>
  );
}
