"use client";

import { useEffect, useMemo, useState } from "react";
import {
  calcularAnticipoSugerido,
  calcularImportePrestacion,
  calcularTotalPrestaciones,
  redondear,
} from "@/lib/presupuestos";
import { crearPresupuesto, actualizarPresupuesto } from "@/lib/data/presupuestos";
import { obtenerPrestacionesObraSocial } from "@/lib/data/caja";

const MAX_PRESTACIONES = 6;

function filaVacia() {
  return { catalogoId: "", cantidad: 1, tipoPrecio: "Lista", importe: 0 };
}

export default function PresupuestoFormModal({
  presupuesto,
  pacientes,
  profesionales,
  catalogo,
  config,
  onClose,
  onGuardado,
}) {
  const esNuevo = !presupuesto;

  const [fecha, setFecha] = useState(presupuesto?.fecha || new Date().toISOString().slice(0, 10));
  const [pacienteId, setPacienteId] = useState(presupuesto?.pacienteId || "");
  const [profesionalId, setProfesionalId] = useState(presupuesto?.profesionalId || "");
  const [prestaciones, setPrestaciones] = useState(
    presupuesto?.prestaciones?.length ? presupuesto.prestaciones : [filaVacia()]
  );
  const [modalidadPago, setModalidadPago] = useState(presupuesto?.modalidadPago || "");
  const [cantidadCuotas, setCantidadCuotas] = useState(presupuesto?.cantidadCuotas || 2);
  const [anticipo, setAnticipo] = useState(presupuesto?.anticipo ?? "");
  const [anticipoEditadoManualmente, setAnticipoEditadoManualmente] = useState(Boolean(presupuesto));
  const [observaciones, setObservaciones] = useState(presupuesto?.observaciones || "");
  const [prestacionesObraSocial, setPrestacionesObraSocial] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const paciente = pacientes.find((p) => p.id === pacienteId);
  const esObraSocial = paciente?.tipo_paciente === "Obra Social" || paciente?.tipo_paciente === "Mixto";

  useEffect(() => {
    if (esObraSocial && paciente?.obra_social) {
      obtenerPrestacionesObraSocial(paciente.obra_social).then(setPrestacionesObraSocial);
    } else {
      setPrestacionesObraSocial([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteId]);

  const total = useMemo(() => calcularTotalPrestaciones(prestaciones), [prestaciones]);

  useEffect(() => {
    if (!modalidadPago) return;
    const sugerido = calcularAnticipoSugerido(total, modalidadPago, config);
    if (modalidadPago === "Contado") {
      setAnticipo(total);
    } else if (!anticipoEditadoManualmente) {
      setAnticipo(sugerido);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalidadPago, total]);

  const cuotas = modalidadPago === "Contado" ? 1 : Number(cantidadCuotas) || 0;
  const saldo = redondear(total - (Number(anticipo) || 0));

  function actualizarFila(indice, cambios) {
    setPrestaciones((filas) => {
      const nuevas = [...filas];
      const fila = { ...nuevas[indice], ...cambios };

      if ("catalogoId" in cambios || "cantidad" in cambios || "tipoPrecio" in cambios) {
        if (esObraSocial) {
          const item = prestacionesObraSocial.find((c) => c.id === fila.catalogoId);
          fila.importe = redondear((Number(fila.cantidad) || 0) * (Number(item?.copago_oficial) || 0));
          if (item) fila.prestacion = item.prestacion_os;
          fila.tipoPrecio = "Copago";
        } else {
          const item = catalogo.find((c) => c.id === fila.catalogoId);
          fila.importe = calcularImportePrestacion(item, fila.cantidad, fila.tipoPrecio);
          if (item) fila.prestacion = item.prestacion;
        }
      }
      nuevas[indice] = fila;
      return nuevas;
    });
  }

  function agregarFila() {
    if (prestaciones.length >= MAX_PRESTACIONES) return;
    setPrestaciones((f) => [...f, filaVacia()]);
  }

  function quitarFila(indice) {
    setPrestaciones((f) => f.filter((_, i) => i !== indice));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!pacienteId) {
      setError("Falta elegir el paciente.");
      return;
    }
    const prestacionesValidas = prestaciones.filter((p) => p.catalogoId);
    if (prestacionesValidas.length === 0) {
      setError("Agregá al menos una prestación.");
      return;
    }
    if (modalidadPago === "Financiado" && cuotas < (config.cuotas_minimas_financiado || 2)) {
      setError(`Financiado requiere mínimo ${config.cuotas_minimas_financiado || 2} cuotas.`);
      return;
    }

    setGuardando(true);
    try {
      const datos = {
        fecha,
        pacienteId,
        profesionalId,
        prestaciones: prestacionesValidas,
        total,
        modalidadPago: modalidadPago || null,
        cantidadCuotas: modalidadPago ? cuotas : null,
        anticipo: modalidadPago ? Number(anticipo) : null,
        saldo: modalidadPago ? saldo : null,
        observaciones,
      };
      if (esNuevo) {
        await crearPresupuesto(datos);
      } else {
        await actualizarPresupuesto(presupuesto.id, datos);
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
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            {esNuevo ? "Nuevo presupuesto" : `Presupuesto ${presupuesto.numero}`}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
              Profesional
              <select
                value={profesionalId}
                onChange={(e) => setProfesionalId(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              >
                <option value="">(sin asignar)</option>
                {profesionales.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Paciente
            <select
              value={pacienteId}
              onChange={(e) => setPacienteId(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            >
              <option value="">Elegí un paciente...</option>
              {pacientes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.apellido_y_nombre}
                  {p.tipo_paciente === "Obra Social" || p.tipo_paciente === "Mixto" ? ` (${p.obra_social || "Obra Social"})` : ""}
                </option>
              ))}
            </select>
          </label>
          {esObraSocial && (
            <p className="-mt-2 text-xs text-gray-500">
              Este paciente tiene obra social — las prestaciones de abajo muestran el copago que le corresponde pagar
              según {paciente.obra_social}, no el valor particular.
            </p>
          )}

          <div>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase text-gray-400">
                Prestaciones (hasta {MAX_PRESTACIONES}) — el precio se sugiere solo, pero se puede corregir a mano
              </p>
              {prestaciones.length < MAX_PRESTACIONES && (
                <button type="button" onClick={agregarFila} className="text-xs text-blue-600 hover:underline">
                  + Agregar prestación
                </button>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {prestaciones.map((fila, i) => (
                <div key={i} className="flex items-center gap-2">
                  {esObraSocial && (
                    <input
                      type="text"
                      placeholder="Código"
                      title="Escribí el código que te pasó el profesional y se elige sola la prestación"
                      onChange={(e) => {
                        const codigo = e.target.value.trim();
                        if (!codigo) return;
                        const item = prestacionesObraSocial.find((c) => c.codigo === codigo);
                        if (item) {
                          actualizarFila(i, { catalogoId: item.id });
                          e.target.value = "";
                        }
                      }}
                      className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  )}
                  <select
                    value={fila.catalogoId}
                    onChange={(e) => actualizarFila(i, { catalogoId: e.target.value })}
                    className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  >
                    <option value="">(elegir prestación)</option>
                    {esObraSocial
                      ? prestacionesObraSocial.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.codigo ? `${c.codigo} — ` : ""}
                            {c.prestacion_os}
                          </option>
                        ))
                      : catalogo.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.prestacion}
                          </option>
                        ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={fila.cantidad}
                    onChange={(e) => actualizarFila(i, { cantidad: Number(e.target.value) })}
                    className="w-16 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  />
                  {esObraSocial ? (
                    <span className="w-24 rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-center text-xs text-gray-500">
                      Copago
                    </span>
                  ) : (
                    <select
                      value={fila.tipoPrecio}
                      onChange={(e) => actualizarFila(i, { tipoPrecio: e.target.value })}
                      className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    >
                      <option value="Lista">Lista</option>
                      <option value="Efectivo">Efectivo</option>
                    </select>
                  )}
                  <input
                    type="number"
                    min={0}
                    value={fila.importe || 0}
                    onChange={(e) => actualizarFila(i, { importe: Number(e.target.value) })}
                    title="Precio sugerido según catálogo/obra social — se puede corregir a mano"
                    className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-right text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => quitarFila(i)}
                    className="text-gray-400 hover:text-red-600"
                    aria-label="Quitar"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end text-sm font-semibold text-gray-900">
            Total: ${total.toLocaleString("es-AR")}
          </div>

          <hr className="border-gray-200" />

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Modalidad de pago
              <select
                value={modalidadPago}
                onChange={(e) => {
                  setModalidadPago(e.target.value);
                  setAnticipo("");
                  setAnticipoEditadoManualmente(false);
                }}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              >
                <option value="">(sin definir)</option>
                <option value="Contado">Contado</option>
                <option value="Financiado">Financiado</option>
              </select>
            </label>
            {modalidadPago === "Financiado" && (
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                Cantidad de cuotas
                <input
                  type="number"
                  min={config.cuotas_minimas_financiado || 2}
                  value={cantidadCuotas}
                  onChange={(e) => setCantidadCuotas(e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1.5"
                />
              </label>
            )}
          </div>

          {modalidadPago && (
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                Anticipo
                <input
                  type="number"
                  value={anticipo}
                  disabled={modalidadPago === "Contado"}
                  onChange={(e) => {
                    setAnticipo(e.target.value);
                    setAnticipoEditadoManualmente(true);
                  }}
                  className="rounded-md border border-gray-300 px-2 py-1.5 disabled:bg-gray-50"
                />
              </label>
              <div className="flex flex-col gap-1 text-sm text-gray-700">
                Saldo
                <div className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-gray-500">
                  ${saldo.toLocaleString("es-AR")}
                </div>
              </div>
            </div>
          )}

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
              {guardando ? "Guardando..." : "Guardar presupuesto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
