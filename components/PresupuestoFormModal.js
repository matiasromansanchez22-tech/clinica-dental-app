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
  return { catalogoId: "", cantidad: 1, tipoPrecio: "Lista", importe: 0, prioridad: false };
}

export default function PresupuestoFormModal({
  presupuesto,
  pacientes,
  profesionales,
  catalogo,
  obrasSociales,
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
  const tienePaciente = paciente?.tipo_paciente === "Obra Social" || paciente?.tipo_paciente === "Mixto";
  // Si la obra social del paciente no cubre fija/prótesis, el presupuesto
  // se arma con el valor particular (no tiene sentido usar el copago del
  // nomenclador para algo que esa obra social no cubre).
  const obraSocialInfo = obrasSociales.find((os) => os.nombre.toLowerCase() === (paciente?.obra_social || "").toLowerCase());
  const cubreFijaProtesis = obraSocialInfo ? obraSocialInfo.cubre_fija_protesis : true;
  const esObraSocial = tienePaciente && cubreFijaProtesis;

  useEffect(() => {
    if (esObraSocial && paciente?.obra_social) {
      obtenerPrestacionesObraSocial(paciente.obra_social).then(setPrestacionesObraSocial);
    } else {
      setPrestacionesObraSocial([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteId]);

  const total = useMemo(() => calcularTotalPrestaciones(prestaciones), [prestaciones]);

  // Para que el paciente pueda decidir en el momento cómo le conviene
  // pagar, sin tener que armar dos presupuestos iguales: muestra cómo
  // quedaría el total de lista contra el de efectivo, prestación por
  // prestación, sin importar qué tipoPrecio esté elegido ahora en cada
  // fila. Para obra social no aplica — ahí se paga el copago, no hay
  // "lista" ni "efectivo".
  const comparacionPrecios = useMemo(() => {
    if (esObraSocial) return null;
    let totalLista = 0;
    let totalEfectivo = 0;
    for (const p of prestaciones) {
      if (!p.catalogoId) continue;
      const item = catalogo.find((c) => c.id === p.catalogoId);
      if (!item) continue;
      const cantidad = Number(p.cantidad) || 0;
      totalLista += cantidad * (Number(item.valor_lista) || 0);
      totalEfectivo += cantidad * (Number(item.valor_efectivo) || 0);
    }
    if (totalLista <= 0 && totalEfectivo <= 0) return null;
    return { totalLista: redondear(totalLista), totalEfectivo: redondear(totalEfectivo) };
  }, [prestaciones, catalogo, esObraSocial]);

  // Igual que comparacionPrecios, pero solo con las prestaciones que el
  // profesional marcó como prioridad — para ofrecerle al paciente una
  // segunda opción más chica y accesible si no puede con el presupuesto
  // completo.
  const comparacionPrioridad = useMemo(() => {
    if (esObraSocial) return null;
    let totalLista = 0;
    let totalEfectivo = 0;
    for (const p of prestaciones) {
      if (!p.catalogoId || !p.prioridad) continue;
      const item = catalogo.find((c) => c.id === p.catalogoId);
      if (!item) continue;
      const cantidad = Number(p.cantidad) || 0;
      totalLista += cantidad * (Number(item.valor_lista) || 0);
      totalEfectivo += cantidad * (Number(item.valor_efectivo) || 0);
    }
    if (totalLista <= 0 && totalEfectivo <= 0) return null;
    return { totalLista: redondear(totalLista), totalEfectivo: redondear(totalEfectivo) };
  }, [prestaciones, catalogo, esObraSocial]);

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
  const valorCuota = modalidadPago === "Financiado" && cuotas > 0 ? redondear(saldo / cuotas) : 0;

  // Mismo desglose de anticipo/saldo/cuota que el presupuesto completo, pero
  // calculado solo sobre lo marcado como prioridad — para que el
  // profesional pueda mostrarle al paciente en el momento cómo le quedaría
  // financiar solo esa parte, sin tener que armar otro presupuesto aparte.
  // El anticipo acá es siempre el sugerido (no se edita a mano como el del
  // presupuesto completo): si el paciente elige esta opción, se arma un
  // presupuesto nuevo con ese monto y ahí sí se puede ajustar.
  const totalPrioridad = useMemo(
    () => calcularTotalPrestaciones(prestaciones.filter((p) => p.prioridad)),
    [prestaciones]
  );
  const anticipoPrioridad = modalidadPago ? calcularAnticipoSugerido(totalPrioridad, modalidadPago, config) : 0;
  const saldoPrioridad = redondear(totalPrioridad - anticipoPrioridad);
  const valorCuotaPrioridad = modalidadPago === "Financiado" && cuotas > 0 ? redondear(saldoPrioridad / cuotas) : 0;

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
          {tienePaciente && !cubreFijaProtesis && (
            <p className="-mt-2 text-xs text-amber-700">
              {paciente.obra_social} no cubre fija/prótesis — este presupuesto se arma con el valor particular.
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
                  {!esObraSocial && (
                    <label
                      title="Marcar como prioridad: aparece en una segunda opción más chica y accesible"
                      className="flex items-center gap-1 text-xs text-gray-600"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(fila.prioridad)}
                        onChange={(e) => actualizarFila(i, { prioridad: e.target.checked })}
                      />
                      ⭐
                    </label>
                  )}
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

          {comparacionPrecios && (
            <div className="rounded-md border border-brand-tan bg-brand-tan/10 px-3 py-2 text-sm">
              <p className="text-xs font-semibold uppercase text-brand-brown">
                Cómo le queda al paciente según cómo pague (para decidir en el momento)
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-4">
                <span className="text-gray-700">
                  Valor de lista: <strong>${comparacionPrecios.totalLista.toLocaleString("es-AR")}</strong>
                </span>
                <span className="text-gray-700">
                  Valor en efectivo: <strong className="text-emerald-700">${comparacionPrecios.totalEfectivo.toLocaleString("es-AR")}</strong>
                </span>
                {comparacionPrecios.totalLista > comparacionPrecios.totalEfectivo && (
                  <span className="text-xs text-gray-500">
                    (ahorra ${(comparacionPrecios.totalLista - comparacionPrecios.totalEfectivo).toLocaleString("es-AR")} pagando en efectivo)
                  </span>
                )}
              </div>
            </div>
          )}

          {comparacionPrioridad && (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
              <p className="text-xs font-semibold uppercase text-amber-800">
                ⭐ Opción más accesible — solo lo marcado como prioridad
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-4">
                <span className="text-gray-700">
                  Valor de lista: <strong>${comparacionPrioridad.totalLista.toLocaleString("es-AR")}</strong>
                </span>
                <span className="text-gray-700">
                  Valor en efectivo: <strong className="text-emerald-700">${comparacionPrioridad.totalEfectivo.toLocaleString("es-AR")}</strong>
                </span>
                {comparacionPrioridad.totalLista > comparacionPrioridad.totalEfectivo && (
                  <span className="text-xs text-gray-500">
                    (ahorra ${(comparacionPrioridad.totalLista - comparacionPrioridad.totalEfectivo).toLocaleString("es-AR")} pagando en efectivo)
                  </span>
                )}
              </div>
            </div>
          )}

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
            <div className={`grid gap-3 ${modalidadPago === "Financiado" ? "grid-cols-3" : "grid-cols-2"}`}>
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
              {modalidadPago === "Financiado" && (
                <div className="flex flex-col gap-1 text-sm text-gray-700">
                  Valor de cada cuota
                  <div className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 font-medium text-brand-brown">
                    ${valorCuota.toLocaleString("es-AR")}
                  </div>
                </div>
              )}
            </div>
          )}

          {modalidadPago && totalPrioridad > 0 && (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2">
              <p className="mb-2 text-xs font-semibold uppercase text-amber-800">
                ⭐ Si el paciente elige solo lo prioritario (${totalPrioridad.toLocaleString("es-AR")})
              </p>
              <div className={`grid gap-3 ${modalidadPago === "Financiado" ? "grid-cols-3" : "grid-cols-2"}`}>
                <div className="flex flex-col gap-1 text-sm text-gray-700">
                  Anticipo sugerido
                  <div className="rounded-md border border-amber-200 bg-white px-2 py-1.5 text-gray-600">
                    ${anticipoPrioridad.toLocaleString("es-AR")}
                  </div>
                </div>
                <div className="flex flex-col gap-1 text-sm text-gray-700">
                  Saldo
                  <div className="rounded-md border border-amber-200 bg-white px-2 py-1.5 text-gray-600">
                    ${saldoPrioridad.toLocaleString("es-AR")}
                  </div>
                </div>
                {modalidadPago === "Financiado" && (
                  <div className="flex flex-col gap-1 text-sm text-gray-700">
                    Valor de cada cuota
                    <div className="rounded-md border border-amber-200 bg-white px-2 py-1.5 font-medium text-amber-800">
                      ${valorCuotaPrioridad.toLocaleString("es-AR")}
                    </div>
                  </div>
                )}
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
