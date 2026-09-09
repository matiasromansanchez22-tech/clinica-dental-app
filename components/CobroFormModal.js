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
  return { itemId: "", prestacion: "", codigo: "", cantidad: 1, valor: 0, valorOS: 0, sinHonorarios: false };
}

function parteVacia(medio) {
  return { medio, monto: "" };
}

export default function CobroFormModal({ fecha, pacientes, profesionales, onClose, onCreado }) {
  const [pacienteId, setPacienteId] = useState("");
  const [profesionalAtencionId, setProfesionalAtencionId] = useState("");
  const [planActivo, setPlanActivo] = useState(null);
  const [cargandoPlan, setCargandoPlan] = useState(false);
  const [cobroIndependienteDelPlan, setCobroIndependienteDelPlan] = useState(false);
  const [prestacionesDisponibles, setPrestacionesDisponibles] = useState([]);
  const [prestaciones, setPrestaciones] = useState([filaVacia()]);
  const [medioPago, setMedioPago] = useState("Efectivo");
  const [pagoMixto, setPagoMixto] = useState(false);
  const [desglosePago, setDesglosePago] = useState([parteVacia("Efectivo"), parteVacia("Transferencia")]);
  const [pago, setPago] = useState(0);
  const [numeroCuota, setNumeroCuota] = useState("");
  const [precioAnterior, setPrecioAnterior] = useState(false);
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const paciente = pacientes.find((p) => p.id === pacienteId);
  const esObraSocial = paciente?.tipo_paciente === "Obra Social" || paciente?.tipo_paciente === "Mixto";
  const usaPlan = Boolean(planActivo) && !cobroIndependienteDelPlan;

  useEffect(() => {
    if (!paciente) {
      setPlanActivo(null);
      setPrestacionesDisponibles([]);
      return;
    }
    setProfesionalAtencionId("");
    setCobroIndependienteDelPlan(false);
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
    // Con pago mixto no hay un único medio para decidir el precio — se usa
    // el de Lista (el mismo que Transferencia/tarjeta) en vez de asumir que
    // le corresponde el descuento de Efectivo.
    const valor = !pagoMixto && medioPago === "Efectivo" ? item.valor_efectivo : item.valor_lista;
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
        // Especialidad del catálogo (solo particular por ahora) — para que
        // Producción pueda liquidar un % distinto según la especialidad de
        // la prestación, no solo un % fijo por profesional.
        fila.especialidad = item?.especialidad || null;
        // Prestaciones administrativas conocidas (no le corresponden % a
        // ningún profesional) se marcan solas al elegirlas — se puede
        // destildar a mano si hiciera falta.
        fila.sinHonorarios = fila.prestacion === "Estampilla";
      }
      nuevas[indice] = fila;
      return nuevas;
    });
  }

  // Si cambia el medio de pago (o se activa/desactiva el mixto), recalcular
  // los valores de particulares (Lista/Efectivo)
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
  }, [medioPago, pagoMixto]);

  const totalDesglosado = desglosePago.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);

  // Con pago mixto, el importe a cobrar sigue siempre la suma del
  // desglose — no tiene sentido que se puedan desincronizar.
  useEffect(() => {
    if (pagoMixto) setPago(totalDesglosado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagoMixto, totalDesglosado]);

  function actualizarParte(i, cambios) {
    setDesglosePago((partes) => partes.map((p, idx) => (idx === i ? { ...p, ...cambios } : p)));
  }

  function agregarParte() {
    const usados = new Set(desglosePago.map((p) => p.medio));
    const disponible = MEDIOS_PAGO.find((m) => !usados.has(m)) || MEDIOS_PAGO[0];
    setDesglosePago((partes) => [...partes, parteVacia(disponible)]);
  }

  function quitarParte(i) {
    setDesglosePago((partes) => partes.filter((_, idx) => idx !== i));
  }

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
    if (pagoMixto) {
      if (desglosePago.some((p) => !p.medio || !p.monto || Number(p.monto) <= 0)) {
        setError("Completá el medio y el monto de cada parte del pago mixto.");
        return;
      }
      const mediosRepetidos = new Set(desglosePago.map((p) => p.medio)).size !== desglosePago.length;
      if (mediosRepetidos) {
        setError("No repitas el mismo medio de pago dos veces — sumalo en una sola parte.");
        return;
      }
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
                sinHonorarios: p.sinHonorarios,
                especialidad: p.especialidad || null,
              })),
        importeTotal: usaPlan ? Number(pago) : importeTotal,
        pago: Number(pago),
        medioPago,
        desglosePago: pagoMixto ? desglosePago.map((p) => ({ medio: p.medio, monto: Number(p.monto) })) : null,
        // Si se cargaron las prestaciones completas (para liquidar bien al
        // profesional) pero el paciente pagó menos, queda anotada la
        // diferencia para no perderla de vista.
        saldoPendiente: !usaPlan && Number(pago) < importeTotal ? importeTotal - Number(pago) : null,
        idDocumento: usaPlan ? planActivo.numero_plan : null,
        tipoDocumento: usaPlan ? "Plan de financiación" : null,
        precioAnterior,
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

          {planActivo && (
            <div className="rounded-md border border-brand-mint/40 bg-brand-mint/15 px-3 py-2 text-sm text-brand-green">
              <p>
                Tiene un plan activo <strong>{planActivo.numero_plan}</strong>. Saldo pendiente actual: $
                {Number(planActivo.saldo_pendiente).toLocaleString("es-AR")}.
              </p>
              {usaPlan && (
                <p className="mt-1">
                  Este cobro se va a aplicar a{" "}
                  <strong>{numeroCuota === "Anticipo" ? "el anticipo" : `la cuota ${numeroCuota}`}</strong>.
                </p>
              )}
              <label className="mt-2 flex items-center gap-2 text-brand-green">
                <input
                  type="checkbox"
                  checked={cobroIndependienteDelPlan}
                  onChange={(e) => setCobroIndependienteDelPlan(e.target.checked)}
                />
                Este pago es por otro tratamiento, no es una cuota del plan
              </label>
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
                  <div key={i} className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      {esObraSocial && (
                        <input
                          type="text"
                          placeholder="Código"
                          title="Escribí el código que te pasó el profesional y se elige sola la prestación"
                          onChange={(e) => {
                            const codigo = e.target.value.trim();
                            if (!codigo) return;
                            const item = prestacionesDisponibles.find((p) => p.codigo === codigo);
                            if (item) {
                              actualizarFila(i, { itemId: item.id });
                              e.target.value = "";
                            }
                          }}
                          className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                        />
                      )}
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
                      <input
                        type="number"
                        min={0}
                        value={fila.valor}
                        onChange={(e) => actualizarFila(i, { valor: Number(e.target.value) })}
                        title="El sistema sugiere el valor de catálogo — se puede ajustar si hace falta"
                        className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-right text-sm"
                      />
                      <button type="button" onClick={() => quitarFila(i)} className="text-gray-400 hover:text-red-600">
                        ✕
                      </button>
                    </div>
                    {fila.itemId && (
                      <label className="flex items-center gap-1.5 pl-1 text-xs text-gray-500">
                        <input
                          type="checkbox"
                          checked={fila.sinHonorarios}
                          onChange={(e) => actualizarFila(i, { sinHonorarios: e.target.checked })}
                        />
                        Sin honorarios (no le genera % a nadie — ej. estampilla, consulta administrativa)
                      </label>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={pagoMixto} onChange={(e) => setPagoMixto(e.target.checked)} />
            Pago mixto (más de un medio de pago)
          </label>

          {pagoMixto ? (
            <div className="flex flex-col gap-2">
              {desglosePago.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    value={p.medio}
                    onChange={(e) => actualizarParte(i, { medio: e.target.value })}
                    className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  >
                    {MEDIOS_PAGO.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={0}
                    value={p.monto}
                    onChange={(e) => actualizarParte(i, { monto: e.target.value })}
                    placeholder="Monto"
                    className="w-28 rounded-md border border-gray-300 px-2 py-1.5 text-right text-sm"
                  />
                  {desglosePago.length > 1 && (
                    <button type="button" onClick={() => quitarParte(i)} className="text-gray-400 hover:text-red-600">
                      ✕
                    </button>
                  )}
                </div>
              ))}
              {desglosePago.length < MEDIOS_PAGO.length && (
                <button type="button" onClick={agregarParte} className="w-fit text-xs text-blue-600 hover:underline">
                  + Agregar otro medio
                </button>
              )}
              <p className="text-right text-sm font-semibold text-gray-900">
                Total pago mixto: ${totalDesglosado.toLocaleString("es-AR")}
              </p>
            </div>
          ) : (
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
          )}

          {!usaPlan && (
            <p className="text-right text-sm font-semibold text-gray-900">
              Total prestaciones: ${importeTotal.toLocaleString("es-AR")}
              {Number(pago) < importeTotal && (
                <span className="ml-2 font-normal text-amber-700">
                  (queda pendiente ${(importeTotal - Number(pago)).toLocaleString("es-AR")} — se liquida igual al
                  profesional)
                </span>
              )}
            </p>
          )}

          {!usaPlan && (
            <label className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <input
                type="checkbox"
                checked={precioAnterior}
                onChange={(e) => setPrecioAnterior(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Se cobró con precio anterior (todavía no actualizado)
                <span className="block text-xs text-amber-700">
                  Ajustá arriba el valor real de cada prestación si hace falta. Marcar esto además asegura que la
                  liquidación tome siempre lo efectivamente cobrado, como resguardo.
                </span>
              </span>
            </label>
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
