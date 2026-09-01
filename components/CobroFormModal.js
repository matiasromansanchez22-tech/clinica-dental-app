"use client";

import { useEffect, useMemo, useState } from "react";
import {
  calcularSugerenciaPago,
  crearCobro,
  obtenerPlanActivoPaciente,
  obtenerPrestacionesObraSocial,
  obtenerPrestacionesParticular,
} from "@/lib/data/caja";

const MEDIOS_PAGO = ["Efectivo", "Transferencia", "Débito", "Crédito", "Mercado Pago", "QR"];
const MAX_PRESTACIONES = 3;

function filaVacia() {
  return { itemId: "", prestacion: "", codigo: "", cantidad: 1, valor: 0, valorOS: 0 };
}

export default function CobroFormModal({ fecha, pacientes, profesionales, onClose, onCreado }) {
  const [pacienteId, setPacienteId] = useState("");
  const [profesionalAtencionId, setProfesionalAtencionId] = useState("");
  const [planActivo, setPlanActivo] = useState(null);
  const [cargandoPlan, setCargandoPlan] = useState(false);
  const [prestacionesDisponibles, setPrestacionesDisponibles] = useState([]);
  const [prestaciones, setPrestaciones] = useState([filaVacia()]);
  const [medioPago, setMedioPago] = useState("Efectivo");
  const [pago, setPago] = useState(0);
  const [numeroCuota, setNumeroCuota] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const paciente = pacientes.find((p) => p.id === pacienteId);
  const esObraSocial = paciente?.tipo_paciente === "Obra Social" || paciente?.tipo_paciente === "Mixto";
  const usaPlan = Boolean(planActivo);

  useEffect(() => {
    if (!paciente) {
      setPlanActivo(null);
      setPrestacionesDisponibles([]);
      return;
    }
    setProfesionalAtencionId("");
    setCargandoPlan(true);
    obtenerPlanActivoPaciente(paciente.id)
      .then((plan) => {
        setPlanActivo(plan);
        if (plan) {
          const { pagoSugerido, numeroCuota: cuota } = calcularSugerenciaPago(plan);
          setPago(pagoSugerido);
          setNumeroCuota(String(cuota));
        }
      })
      .finally(() => setCargandoPlan(false));

    if (esObraSocial && paciente.obra_social) {
      obtenerPrestacionesObraSocial(paciente.obra_social).then(setPrestacionesDisponibles);
    } else {
      obtenerPrestacionesParticular().then(setPrestacionesDisponibles);
    }
    setPrestaciones([filaVacia()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteId]);

  function calcularValor(item) {
    if (!item) return { valor: 0, valorOS: 0 };
    if (esObraSocial) {
      return { valor: Number(item.copago_oficial) || 0, valorOS: Number(item.valor_os) || 0 };
    }
    const valor = medioPago === "Efectivo" ? item.valor_efectivo : item.valor_lista;
    return { valor: Number(valor) || 0, valorOS: 0 };
  }

  function actualizarFila(indice, cambios) {
    setPrestaciones((filas) => {
      const nuevas = [...filas];
      const fila = { ...nuevas[indice], ...cambios };
      if ("itemId" in cambios) {
        const item = prestacionesDisponibles.find((p) => p.id === cambios.itemId);
        const { valor, valorOS } = calcularValor(item);
        fila.prestacion = item ? (esObraSocial ? item.prestacion_os : item.prestacion) : "";
        fila.codigo = item?.codigo || "";
        fila.valor = valor;
        fila.valorOS = valorOS;
      }
      nuevas[indice] = fila;
      return nuevas;
    });
  }

  // Si cambia el medio de pago, recalcular los valores de particulares (Lista/Efectivo)
  useEffect(() => {
    if (esObraSocial) return;
    setPrestaciones((filas) =>
      filas.map((f) => {
        if (!f.itemId) return f;
        const item = prestacionesDisponibles.find((p) => p.id === f.itemId);
        const { valor } = calcularValor(item);
        return { ...f, valor };
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [medioPago]);

  const importeTotal = useMemo(
    () => prestaciones.reduce((acc, f) => acc + (f.itemId ? Number(f.valor) * Number(f.cantidad) : 0), 0),
    [prestaciones]
  );

  useEffect(() => {
    if (!usaPlan) setPago(importeTotal);
  }, [importeTotal, usaPlan]);

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
    if (!profesionalAtencionId) {
      setError("Falta elegir el profesional que atendió.");
      return;
    }
    if (!usaPlan && prestaciones.every((p) => !p.itemId)) {
      setError("Agregá al menos una prestación.");
      return;
    }

    setGuardando(true);
    try {
      await crearCobro({
        fecha,
        tipo: esObraSocial ? "Obra Social" : "Particular",
        cobertura: esObraSocial ? paciente.obra_social : "Particular",
        pacienteId,
        dni: paciente.dni,
        numeroAfiliado: paciente.numero_afiliado,
        profesionalResponsableId: paciente.profesional_responsable_id || null,
        profesionalAtencionId: profesionalAtencionId || null,
        modalidad: usaPlan ? "Plan de financiación" : "Día a día",
        numeroCuota: usaPlan ? numeroCuota : null,
        prestaciones: usaPlan
          ? []
          : prestaciones
              .filter((p) => p.itemId)
              .map((p) => ({
                prestacion: p.prestacion,
                codigo: p.codigo,
                cantidad: p.cantidad,
                valor: p.valor,
                valorOS: p.valorOS,
              })),
        importeTotal: usaPlan ? Number(pago) : importeTotal,
        pago: Number(pago),
        medioPago,
        idDocumento: usaPlan ? planActivo.numero_plan : null,
        tipoDocumento: usaPlan ? "Plan de financiación" : null,
        observaciones,
      });
      onCreado();
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
          <h2 className="text-lg font-bold text-gray-900">Nuevo cobro</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                </option>
              ))}
            </select>
          </label>

          {paciente && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
                <span className="text-gray-500">Cobertura: </span>
                {esObraSocial ? paciente.obra_social : "Particular"}
              </div>
              <label className="flex flex-col gap-1 text-gray-700">
                Profesional que atendió
                <select
                  value={profesionalAtencionId}
                  onChange={(e) => setProfesionalAtencionId(e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1.5"
                >
                  <option value="">Elegí quién atendió...</option>
                  {profesionales.map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.nombre}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-gray-400">
                  Profesional habitual: {paciente.profesional_responsable?.nombre || "—"}
                </span>
              </label>
            </div>
          )}

          {cargandoPlan && <p className="text-sm text-gray-500">Buscando plan de financiación activo...</p>}

          {usaPlan && (
            <div className="rounded-md border border-brand-mint/40 bg-brand-mint/15 px-3 py-2 text-sm text-brand-green">
              Tiene un plan activo <strong>{planActivo.numero_plan}</strong> — este cobro se va a aplicar a{" "}
              <strong>{numeroCuota === "Anticipo" ? "el anticipo" : `la cuota ${numeroCuota}`}</strong>. Saldo pendiente
              actual: ${Number(planActivo.saldo_pendiente).toLocaleString("es-AR")}.
            </div>
          )}

          {paciente && !usaPlan && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase text-gray-400">
                  Prestaciones (hasta {MAX_PRESTACIONES})
                </p>
                {prestaciones.length < MAX_PRESTACIONES && (
                  <button type="button" onClick={agregarFila} className="text-xs text-blue-600 hover:underline">
                    + Agregar
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {prestaciones.map((fila, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      value={fila.itemId}
                      onChange={(e) => actualizarFila(i, { itemId: e.target.value })}
                      className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    >
                      <option value="">(elegir prestación)</option>
                      {prestacionesDisponibles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {esObraSocial ? p.prestacion_os : p.prestacion}
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
                    <span className="w-24 text-right text-sm text-gray-600">
                      ${Number(fila.valor || 0).toLocaleString("es-AR")}
                    </span>
                    <button type="button" onClick={() => quitarFila(i)} className="text-gray-400 hover:text-red-600">
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Medio de pago
              <select
                value={medioPago}
                onChange={(e) => setMedioPago(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              >
                {MEDIOS_PAGO.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              {usaPlan ? "Pago" : "Importe a cobrar"}
              <input
                type="number"
                value={pago}
                onChange={(e) => setPago(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
            </label>
          </div>

          {!usaPlan && (
            <p className="text-right text-sm font-semibold text-gray-900">
              Total prestaciones: ${importeTotal.toLocaleString("es-AR")}
            </p>
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
              {guardando ? "Guardando..." : "Registrar cobro"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
