"use client";

import { useState } from "react";
import { actualizarGasto, crearGastoConReserva, MEDIOS_PAGO_GASTO } from "@/lib/data/gastos";
import { fechaDeHoyISO } from "@/lib/agenda";

const ESPECIALIDADES = ["", "General", "Ortodoncia"];

const CATEGORIA_PAGO_LABORATORIO = "Pagos a Laboratorio";

function formatoPesos(n) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

export default function GastoFormModal({
  gasto,
  categorias,
  especialidadInicial,
  categoriaInicial,
  mecanicoInicial,
  laboratoriosSugeridos = [],
  trabajosMecanico = [],
  onClose,
  onGuardado,
}) {
  const [fecha, setFecha] = useState(gasto?.fecha || fechaDeHoyISO());
  const [categoria, setCategoria] = useState(gasto?.categoria || categoriaInicial || categorias[0]?.nombre || "");
  const [especialidad, setEspecialidad] = useState(gasto?.especialidad || especialidadInicial || "");
  const [descripcion, setDescripcion] = useState(gasto?.descripcion || "");
  const [monto, setMonto] = useState(gasto?.monto || "");
  const [medioPago, setMedioPago] = useState(gasto?.medioPago || "Efectivo");
  const [observaciones, setObservaciones] = useState(gasto?.observaciones || "");
  const [mecanico, setMecanico] = useState(gasto?.mecanico || mecanicoInicial || "");
  const [trabajosSeleccionados, setTrabajosSeleccionados] = useState(new Set());
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const sumaSeleccionada = trabajosMecanico
    .filter((t) => trabajosSeleccionados.has(t.id))
    .reduce((a, t) => a + (Number(t.valor) || 0), 0);

  function alternarTrabajo(id) {
    setTrabajosSeleccionados((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!categoria) {
      setError("Elegí una categoría.");
      return;
    }
    if (!monto || Number(monto) <= 0) {
      setError("El monto tiene que ser mayor a cero.");
      return;
    }
    setGuardando(true);
    try {
      const datos = {
        fecha,
        categoria,
        especialidad,
        descripcion,
        monto,
        medioPago,
        observaciones,
        mecanico: categoria === CATEGORIA_PAGO_LABORATORIO ? mecanico.trim() : null,
        trabajoIds:
          !gasto && categoria === CATEGORIA_PAGO_LABORATORIO && trabajosSeleccionados.size > 0
            ? Array.from(trabajosSeleccionados)
            : undefined,
      };
      if (gasto) {
        await actualizarGasto(gasto.id, datos);
      } else {
        await crearGastoConReserva(datos, categorias);
      }
      onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{gasto ? "Editar gasto" : "Nuevo gasto"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
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
              Categoría
              <select
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              >
                {categorias.map((c) => (
                  <option key={c.id} value={c.nombre}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {categoria === CATEGORIA_PAGO_LABORATORIO && (
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              ¿A qué mecánico?
              <input
                list="mecanicos-sugeridos-gasto"
                value={mecanico}
                onChange={(e) => setMecanico(e.target.value)}
                placeholder="Ej. Mario"
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
              <datalist id="mecanicos-sugeridos-gasto">
                {laboratoriosSugeridos.map((l) => (
                  <option key={l} value={l} />
                ))}
              </datalist>
              <span className="text-xs text-gray-400">Para poder ver cuánto le debemos a cada uno en Cuentas por Mecánico.</span>
            </label>
          )}

          {!gasto && categoria === CATEGORIA_PAGO_LABORATORIO && trabajosMecanico.length > 0 && (
            <div className="flex flex-col gap-1 text-sm text-gray-700">
              ¿A qué trabajos corresponde este pago? (opcional)
              <div className="max-h-40 overflow-y-auto rounded-md border border-gray-300">
                {trabajosMecanico.map((t) => (
                  <label
                    key={t.id}
                    className="flex cursor-pointer items-center justify-between gap-2 border-b border-gray-100 px-2 py-1.5 text-xs last:border-b-0 hover:bg-gray-50"
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={trabajosSeleccionados.has(t.id)}
                        onChange={() => alternarTrabajo(t.id)}
                      />
                      {t.pacienteNombre} — {t.tipoTrabajo}
                      {t.pieza ? ` (${t.pieza})` : ""}
                    </span>
                    <span className="whitespace-nowrap text-gray-500">
                      {t.valor ? formatoPesos(t.valor) : "sin valor"}
                    </span>
                  </label>
                ))}
              </div>
              {trabajosSeleccionados.size > 0 && (
                <p
                  className={`text-xs ${
                    Number(monto) && Math.abs(Number(monto) - sumaSeleccionada) > 0.5
                      ? "font-medium text-amber-700"
                      : "text-gray-500"
                  }`}
                >
                  Estos {trabajosSeleccionados.size} trabajo{trabajosSeleccionados.size === 1 ? "" : "s"} valen{" "}
                  {formatoPesos(sumaSeleccionada)} según el sistema
                  {Number(monto) && Math.abs(Number(monto) - sumaSeleccionada) > 0.5
                    ? ` — estás pagando ${formatoPesos(Number(monto))}, una diferencia de ${formatoPesos(Math.abs(Number(monto) - sumaSeleccionada))}`
                    : ""}
                  .
                </p>
              )}
            </div>
          )}

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Descripción
            <input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Ej. Alquiler de agosto"
              className="rounded-md border border-gray-300 px-2 py-1.5"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Monto
              <input
                type="number"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Medio de pago
              <select
                value={medioPago}
                onChange={(e) => setMedioPago(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              >
                {MEDIOS_PAGO_GASTO.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Especialidad (opcional)
            <select
              value={especialidad}
              onChange={(e) => setEspecialidad(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            >
              {ESPECIALIDADES.map((e) => (
                <option key={e} value={e}>
                  {e || "General de la clínica (compartido)"}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Observaciones
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
              {guardando ? "Guardando..." : "Guardar gasto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
