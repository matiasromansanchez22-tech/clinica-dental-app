"use client";

import { useEffect, useMemo, useState } from "react";
import {
  actualizarGasto,
  crearGastoConReserva,
  MEDIOS_PAGO_GASTO,
  obtenerTrabajosPendientesDePago,
} from "@/lib/data/gastos";
import { fechaDeHoyISO } from "@/lib/agenda";
import { subirComprobante, obtenerUrlComprobante } from "@/lib/data/comprobantes";
import LeerComprobanteIA from "@/components/LeerComprobanteIA";

const ESPECIALIDADES = ["", "General", "Ortodoncia"];

const CATEGORIA_PAGO_LABORATORIO = "Pagos a Laboratorio";

function formatoPesos(n) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

function colorEstadoTrabajo(estado) {
  if (estado === "Entregado") return "text-emerald-600";
  if (estado === "Prueba con el paciente") return "text-sky-600";
  if (estado === "Ajuste pendiente") return "text-amber-600";
  if (estado === "Listo para entregar") return "text-emerald-600";
  return "text-gray-400";
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
  // null = se usa la sugerencia automática (los trabajos más viejos sin pagar,
  // hasta donde alcanza el monto); si se toca un casillero pasa a ser manual.
  const [seleccionManual, setSeleccionManual] = useState(null);
  const [pendientes, setPendientes] = useState(null);
  const [reservaManual, setReservaManual] = useState(null);
  const [comprobante, setComprobante] = useState(null);
  const [viendoComprobante, setViendoComprobante] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  // Se tilda solo para Sueldos y las categorías que salen de la reserva; se
  // puede cambiar a mano para cualquier gasto.
  const categoriaElegida = categorias.find((c) => c.nombre === categoria);
  const desdeReserva = reservaManual ?? Boolean(categoriaElegida?.sale_de_reserva || categoria === "Sueldos");

  function aplicarSugerencia(sugerencia) {
    if (sugerencia.monto) setMonto(sugerencia.monto);
    if (sugerencia.fecha) setFecha(sugerencia.fecha);
    if (sugerencia.medioPago) setMedioPago(sugerencia.medioPago);
    if (sugerencia.categoriaSugerida) setCategoria(sugerencia.categoriaSugerida);
    if (sugerencia.descripcion) setDescripcion(sugerencia.descripcion);
  }

  async function verComprobante() {
    if (!gasto?.comprobantePath) return;
    setViendoComprobante(true);
    try {
      const url = await obtenerUrlComprobante(gasto.comprobantePath);
      window.open(url, "_blank");
    } catch (err) {
      setError(err.message);
    } finally {
      setViendoComprobante(false);
    }
  }

  const esPagoALaboratorio = !gasto && categoria === CATEGORIA_PAGO_LABORATORIO;

  // Los trabajos sin pagar se buscan solos al elegir "Pagos a Laboratorio", sin
  // depender de desde qué pantalla se abrió el formulario.
  useEffect(() => {
    if (!esPagoALaboratorio || pendientes !== null) return;
    obtenerTrabajosPendientesDePago()
      .then(setPendientes)
      .catch(() => setPendientes([]));
  }, [esPagoALaboratorio, pendientes]);

  const nombreMecanico = mecanico.trim().toLowerCase();
  const trabajosDelMecanico = useMemo(() => {
    const base = pendientes ?? trabajosMecanico;
    if (!nombreMecanico) return [];
    return base.filter((t) => (t.laboratorio || "").trim().toLowerCase() === nombreMecanico);
  }, [pendientes, trabajosMecanico, nombreMecanico]);

  // Mario cobra la mitad en la prueba y el resto al entregar, así que sus
  // trabajos "en prueba" no se tildan solos (se eligen a mano cuando
  // corresponde): marcarlos como pagos taparía la otra mitad.
  const enPruebaDeMario = (t) => nombreMecanico === "mario" && t.estado === "Prueba con el paciente";

  // Del más viejo al más nuevo; se salta el que ya no entra en lo que queda del monto
  // y sigue con los siguientes, para no dejar plata sin asignar.
  const sugerencia = useMemo(() => {
    let restante = Number(monto) || 0;
    const ids = new Set();
    for (const t of trabajosDelMecanico) {
      if (enPruebaDeMario(t)) continue;
      const valor = Number(t.valor) || 0;
      if (valor > restante + 0.5) continue;
      ids.add(t.id);
      restante -= valor;
    }
    return { ids, sobran: Math.max(restante, 0) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trabajosDelMecanico, monto]);

  const seleccion = seleccionManual ?? sugerencia.ids;
  const sumaSeleccionada = trabajosDelMecanico
    .filter((t) => seleccion.has(t.id))
    .reduce((a, t) => a + (Number(t.valor) || 0), 0);

  function alternarTrabajo(id) {
    const nuevo = new Set(seleccion);
    if (nuevo.has(id)) nuevo.delete(id);
    else nuevo.add(id);
    setSeleccionManual(nuevo);
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
      const comprobantePath = comprobante ? await subirComprobante(comprobante) : null;
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
          esPagoALaboratorio && seleccion.size > 0 ? Array.from(seleccion) : undefined,
        ...(comprobantePath ? { comprobantePath } : {}),
        desdeReserva,
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
          <LeerComprobanteIA
            categoriasDisponibles={categorias.map((c) => c.nombre)}
            onArchivoElegido={setComprobante}
            onLeido={aplicarSugerencia}
          />

          {gasto?.comprobantePath && (
            <button
              type="button"
              onClick={verComprobante}
              disabled={viendoComprobante}
              className="self-start text-xs font-medium text-brand-brown underline hover:text-brand-brown-dark disabled:opacity-50"
            >
              {viendoComprobante ? "Abriendo..." : "📎 Ver comprobante cargado"}
            </button>
          )}

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
                onChange={(e) => {
                  setMecanico(e.target.value);
                  setSeleccionManual(null);
                }}
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

          {esPagoALaboratorio && trabajosDelMecanico.length > 0 && (
            <div className="flex flex-col gap-1 text-sm text-gray-700">
              ¿A qué trabajos corresponde este pago?
              <span className="text-[11px] text-gray-400">
                Se tildan solos los más viejos sin pagar, hasta donde alcanza el monto. Podés cambiarlo.
              </span>
              <div className="max-h-40 overflow-y-auto rounded-md border border-gray-300">
                {trabajosDelMecanico.map((t) => {
                  // Mario cobra la mitad en el momento de traer para probar
                  // (el resto recién al entregar) — se aclara acá para no
                  // pagarle de más creyendo que ese trabajo ya está completo.
                  const enPrueba = enPruebaDeMario(t) && t.valor;
                  return (
                    <label
                      key={t.id}
                      className="flex cursor-pointer items-center justify-between gap-2 border-b border-gray-100 px-2 py-1.5 text-xs last:border-b-0 hover:bg-gray-50"
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={seleccion.has(t.id)}
                          onChange={() => alternarTrabajo(t.id)}
                        />
                        <span className="flex flex-col">
                          <span>
                            {t.pacienteNombre} — {t.tipoTrabajo}
                            {t.pieza ? ` (${t.pieza})` : ""}
                          </span>
                          <span className={`text-[10px] font-medium ${colorEstadoTrabajo(t.estado)}`}>{t.estado}</span>
                        </span>
                      </span>
                      <span className="flex flex-col items-end whitespace-nowrap">
                        <span className="text-gray-500">{t.valor ? formatoPesos(t.valor) : "sin valor"}</span>
                        {enPrueba && (
                          <span className="text-[10px] font-medium text-amber-600">
                            en prueba — 50%: {formatoPesos(t.valor / 2)}
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
              {Number(monto) > 0 && (
                <p
                  className={`text-xs ${
                    Math.abs(Number(monto) - sumaSeleccionada) > 0.5 ? "font-medium text-amber-700" : "text-gray-500"
                  }`}
                >
                  {seleccion.size === 0
                    ? "Este pago no cubre ningún trabajo entero: queda a cuenta del saldo."
                    : `Este pago cubre ${seleccion.size} trabajo${seleccion.size === 1 ? "" : "s"} por ${formatoPesos(sumaSeleccionada)}`}
                  {seleccion.size > 0 && Number(monto) - sumaSeleccionada > 0.5
                    ? ` — sobran ${formatoPesos(Number(monto) - sumaSeleccionada)} a cuenta (igual se descuentan del saldo).`
                    : ""}
                  {seleccion.size > 0 && sumaSeleccionada - Number(monto) > 0.5
                    ? ` — faltan ${formatoPesos(sumaSeleccionada - Number(monto))} para pagarlos completos.`
                    : ""}
                </p>
              )}
              {seleccionManual && (
                <button
                  type="button"
                  onClick={() => setSeleccionManual(null)}
                  className="self-start text-xs font-medium text-brand-brown hover:underline"
                >
                  Volver a la sugerencia automática
                </button>
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

          {!gasto ? (
            <label className="flex items-start gap-2 rounded-md border border-brand-tan bg-brand-tan/10 px-3 py-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={desdeReserva}
                onChange={(e) => setReservaManual(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                Se paga con la reserva del Consultorio
                <span className="block text-xs text-gray-500">
                  {desdeReserva
                    ? `Se descuenta de ${medioPago === "Efectivo" ? "Efectivo" : "Banco"} en Consultorio y no cuenta en el balance del mes ni en lo que queda limpio.`
                    : "Si no, se paga con la plata que entró y resta del balance del mes."}
                </span>
              </span>
            </label>
          ) : (
            gasto.desdeReserva && (
              <p className="rounded-md border border-brand-tan bg-brand-tan/10 px-3 py-2 text-xs text-gray-600">
                Este gasto se pagó con la reserva del Consultorio. Para cambiarlo, borralo y cargalo de nuevo.
              </p>
            )
          )}

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
