"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { crearCobroOrtodoncia } from "@/lib/data/cajaOrtodoncia";
import { obtenerConfiguracionOrtodoncia } from "@/lib/data/pacientesOrtodoncia";
import { CONCEPTOS_ORTODONCIA, TIPOS_BRACKET_ORTODONCIA, calcularEstadoAumento } from "@/lib/ortodoncia";
import {
  marcarPendienteOrtodonciaComoCobrado,
  obtenerPendienteCobroOrtodoncia,
} from "@/lib/data/prestacionesRealizadas";
import { aplicarSaldoAFavor, obtenerSaldoAFavor } from "@/lib/data/saldosAFavor";

const CONCEPTOS = CONCEPTOS_ORTODONCIA;
const MEDIOS_PAGO = ["Efectivo", "Transferencia", "Débito", "Crédito", "Mercado Pago", "QR"];
const BRACKETS = TIPOS_BRACKET_ORTODONCIA;

function parteVacia(medio) {
  return { medio, monto: "" };
}

export default function CobroOrtodonciaFormModal({
  fecha,
  pacientes,
  ortodoncistas,
  pacienteIdInicial,
  profesionalIdInicial,
  onClose,
  onCreado,
}) {
  const [pacienteId, setPacienteId] = useState(pacienteIdInicial || "");
  const [ortodoncistaAtencionId, setOrtodoncistaAtencionId] = useState(profesionalIdInicial || "");
  // No resetear el ortodoncista mientras el paciente no cambió realmente —
  // comparar contra el paciente anterior (en vez de una bandera "primera
  // vez") lo hace a prueba de que el efecto se dispare dos veces en
  // desarrollo (React Strict Mode).
  const pacienteIdAnterior = useRef(pacienteId);
  const [concepto, setConcepto] = useState("Control");
  const [cantidadControlesAbonados, setCantidadControlesAbonados] = useState(1);
  const [bracketReposicion, setBracketReposicion] = useState("Metálico");
  const [cantidadBrackets, setCantidadBrackets] = useState(1);
  const [seDespegoBracket, setSeDespegoBracket] = useState(false);
  const [cargoExtraDescripcion, setCargoExtraDescripcion] = useState("");
  const [cargoExtraMonto, setCargoExtraMonto] = useState("");
  const [saldoAFavor, setSaldoAFavor] = useState(0);
  const [montoAFavorAplicado, setMontoAFavorAplicado] = useState(0);
  const [montoAAplicarInput, setMontoAAplicarInput] = useState("");
  const [precios, setPrecios] = useState({ precio_bracket_metalico: 0, precio_bracket_porcelana: 0 });
  const [importe, setImporte] = useState(0);
  const [medioPago, setMedioPago] = useState("Efectivo");
  const [pagoMixto, setPagoMixto] = useState(false);
  const [desglosePago, setDesglosePago] = useState([parteVacia("Efectivo"), parteVacia("Transferencia")]);
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [aumentoConfirmado, setAumentoConfirmado] = useState(false);
  const [pendienteRealizado, setPendienteRealizado] = useState(null);

  useEffect(() => {
    obtenerConfiguracionOrtodoncia().then(setPrecios);
  }, []);

  const paciente = useMemo(() => pacientes.find((p) => p.id === pacienteId), [pacienteId, pacientes]);
  const estadoAumento = useMemo(
    () => (paciente ? calcularEstadoAumento(paciente.proximoAumento) : null),
    [paciente]
  );
  const porcentajeAumento = precios.aumento_porcentaje ?? 25;
  const cuotaSugerida = paciente?.valorControl
    ? Math.round((Number(paciente.valorControl) * (1 + porcentajeAumento / 100)) / 100) * 100
    : 0;
  const debeConfirmarAumento = estadoAumento?.texto === "Aumentar";

  useEffect(() => {
    if (pacienteIdAnterior.current !== pacienteId) setOrtodoncistaAtencionId("");
    pacienteIdAnterior.current = pacienteId;
    setAumentoConfirmado(false);
    setPendienteRealizado(null);
    setCargoExtraDescripcion("");
    setCargoExtraMonto("");
    setSaldoAFavor(0);
    setMontoAFavorAplicado(0);
    setMontoAAplicarInput("");
    if (!pacienteId) return;
    obtenerSaldoAFavor(pacienteId, true)
      .then(setSaldoAFavor)
      .catch(() => {});
    // Lo que el ortodoncista ya marcó como "hecho" en la Agenda — viene
    // pre-cargado acá en vez de arrancar siempre en "Control".
    obtenerPendienteCobroOrtodoncia(pacienteId).then((pendiente) => {
      if (!pendiente) return;
      setPendienteRealizado(pendiente);
      if (CONCEPTOS.includes(pendiente.prestacion)) setConcepto(pendiente.prestacion);
      if (pendiente.bracket_reposicion) {
        setSeDespegoBracket(true);
        setBracketReposicion(pendiente.bracket_reposicion);
        setCantidadBrackets(pendiente.cantidad_brackets || 1);
      }
      if (pendiente.cargo_extra_monto) {
        setCargoExtraDescripcion(pendiente.cargo_extra_descripcion || "");
        setCargoExtraMonto(pendiente.cargo_extra_monto);
      }
      if (pendiente.nota_proximo_turno) {
        setObservaciones((actual) => actual || `Nota del profesional: ${pendiente.nota_proximo_turno}`);
      }
    });
  }, [pacienteId]);

  const precioPorBracket =
    bracketReposicion === "Porcelana" ? precios.precio_bracket_porcelana : precios.precio_bracket_metalico;

  useEffect(() => {
    if (!paciente) return;
    let base = 0;
    if (concepto === "Control") {
      const valorControlUsado =
        debeConfirmarAumento && aumentoConfirmado ? cuotaSugerida : Number(paciente.valorControl || 0);
      const valorControles = valorControlUsado * Number(cantidadControlesAbonados || 1);
      const valorBrackets = seDespegoBracket ? Number(cantidadBrackets || 0) * precioPorBracket : 0;
      base = valorControles + valorBrackets;
    }
    setImporte(Math.max(0, base + Number(cargoExtraMonto || 0) - montoAFavorAplicado));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pacienteId,
    concepto,
    cantidadControlesAbonados,
    seDespegoBracket,
    cantidadBrackets,
    bracketReposicion,
    precios,
    aumentoConfirmado,
    cargoExtraMonto,
    montoAFavorAplicado,
  ]);

  function aplicarSaldo() {
    const sugerido = Math.min(saldoAFavor, Number(importe));
    const elegido = montoAAplicarInput === "" ? sugerido : Number(montoAAplicarInput) || 0;
    const monto = Math.min(elegido, saldoAFavor, Number(importe));
    if (monto <= 0) return;
    setMontoAFavorAplicado(monto);
    setMontoAAplicarInput("");
  }

  function quitarSaldoAplicado() {
    setMontoAFavorAplicado(0);
  }

  const totalDesglosado = desglosePago.reduce((acc, p) => acc + (Number(p.monto) || 0), 0);

  // Con pago mixto, el importe a cobrar sigue siempre la suma del
  // desglose — no tiene sentido que se puedan desincronizar. Se declara
  // después del cálculo automático de arriba para que, si hay pago mixto,
  // este sea el que gane.
  useEffect(() => {
    if (pagoMixto) setImporte(totalDesglosado);
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

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!pacienteId) {
      setError("Falta elegir el paciente.");
      return;
    }
    if (!ortodoncistaAtencionId) {
      setError("Falta elegir el ortodoncista que atendió.");
      return;
    }
    if (debeConfirmarAumento && !aumentoConfirmado) {
      setError("Este paciente tiene la cuota vencida para aumentar — tildá la confirmación de arriba antes de cobrar.");
      return;
    }
    if (!importe || Number(importe) <= 0) {
      setError("El importe tiene que ser mayor a cero.");
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
      const observacionesFinal = [
        observaciones || null,
        cargoExtraMonto ? `Cargo extra: ${cargoExtraDescripcion || "(sin descripción)"} ($${Number(cargoExtraMonto).toLocaleString("es-AR")})` : null,
      ]
        .filter(Boolean)
        .join(" | ");
      const cobro = await crearCobroOrtodoncia({
        fecha,
        pacienteId,
        ortodoncistaId: ortodoncistaAtencionId,
        ortodoncistaResponsableId: paciente.ortodoncistaId || null,
        concepto,
        cantidadControlesAbonados: concepto === "Control" ? Number(cantidadControlesAbonados) : null,
        bracketReposicion:
          concepto === "Reposición de bracket" || (concepto === "Control" && seDespegoBracket)
            ? bracketReposicion
            : null,
        cantidadBrackets:
          concepto === "Reposición de bracket" || (concepto === "Control" && seDespegoBracket)
            ? Number(cantidadBrackets)
            : null,
        importe: Number(importe),
        medioPago,
        desglosePago: pagoMixto ? desglosePago.map((p) => ({ medio: p.medio, monto: Number(p.monto) })) : null,
        observaciones: observacionesFinal || null,
      });
      if (pendienteRealizado) await marcarPendienteOrtodonciaComoCobrado(pendienteRealizado.id, cobro.id);
      if (montoAFavorAplicado > 0) {
        await aplicarSaldoAFavor({
          pacienteId,
          esOrtodoncia: true,
          monto: montoAFavorAplicado,
          cajaOrtodonciaId: cobro.id,
          fecha,
        });
      }
      onCreado();
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
          <h2 className="text-lg font-bold text-gray-900">Nuevo cobro — Ortodoncia</h2>
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
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>

          {paciente && (
            <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              Ortodoncista habitual: <span className="font-medium">{paciente.ortodoncista}</span>
              {" · "}Cuota control: {paciente.valorControl ? `$${Number(paciente.valorControl).toLocaleString("es-AR")}` : "—"}
            </div>
          )}

          {pendienteRealizado && (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              ✓ El ortodoncista marcó "{pendienteRealizado.prestacion}" en Agenda — ya viene elegido abajo.
              {pendienteRealizado.bracket_reposicion && (
                <>
                  {" "}
                  También marcó que se despegó {pendienteRealizado.cantidad_brackets || 1} bracket
                  {(pendienteRealizado.cantidad_brackets || 1) > 1 ? "s" : ""} ({pendienteRealizado.bracket_reposicion}) —
                  ya viene sumado al total.
                </>
              )}
              {pendienteRealizado.cargo_extra_monto && (
                <>
                  {" "}
                  También cargó un extra: {pendienteRealizado.cargo_extra_descripcion || "cargo extra"} ($
                  {Number(pendienteRealizado.cargo_extra_monto).toLocaleString("es-AR")}) — ya viene sumado al total.
                </>
              )}
              {pendienteRealizado.nota_proximo_turno && (
                <>
                  {" "}
                  📌 Nota para el próximo turno: {pendienteRealizado.nota_proximo_turno}
                </>
              )}
            </p>
          )}

          {debeConfirmarAumento && (
            <div className="rounded-md border-2 border-red-500 bg-red-50 px-3 py-3 text-sm">
              <p className="font-medium text-red-700">
                🔴 A este paciente le toca aumentar la cuota (venció el{" "}
                {paciente.proximoAumento?.split("-").reverse().join("/")}).
              </p>
              <p className="mt-1 text-red-700">
                Cuota actual: ${Number(paciente.valorControl || 0).toLocaleString("es-AR")} → Cuota sugerida:{" "}
                <strong>${cuotaSugerida.toLocaleString("es-AR")}</strong> ({porcentajeAumento}% de aumento)
              </p>
              <label className="mt-2 flex items-center gap-2 font-medium text-red-800">
                <input
                  type="checkbox"
                  checked={aumentoConfirmado}
                  onChange={(e) => setAumentoConfirmado(e.target.checked)}
                />
                Confirmo que voy a cobrarle el monto actualizado
              </label>
              {!aumentoConfirmado && (
                <p className="mt-1 text-xs text-red-600">No se puede registrar el cobro hasta confirmar esto.</p>
              )}
            </div>
          )}

          {paciente && (
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Ortodoncista que atendió
              <select
                value={ortodoncistaAtencionId}
                onChange={(e) => setOrtodoncistaAtencionId(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              >
                <option value="">Elegí quién atendió...</option>
                {ortodoncistas.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nombre}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Concepto
            <select
              value={concepto}
              onChange={(e) => setConcepto(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            >
              {CONCEPTOS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>

          {concepto === "Control" && (
            <>
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                Cantidad de controles abonados
                <input
                  type="number"
                  min={1}
                  value={cantidadControlesAbonados}
                  onChange={(e) => setCantidadControlesAbonados(e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1.5"
                />
              </label>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={seDespegoBracket}
                  onChange={(e) => setSeDespegoBracket(e.target.checked)}
                />
                Se despegó algún bracket (se suma al total del control)
              </label>

              {seDespegoBracket && (
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1 text-sm text-gray-700">
                    Tipo de bracket
                    <select
                      value={bracketReposicion}
                      onChange={(e) => setBracketReposicion(e.target.value)}
                      className="rounded-md border border-gray-300 px-2 py-1.5"
                    >
                      {BRACKETS.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-gray-700">
                    Cantidad despegada
                    <input
                      type="number"
                      min={1}
                      value={cantidadBrackets}
                      onChange={(e) => setCantidadBrackets(e.target.value)}
                      className="rounded-md border border-gray-300 px-2 py-1.5"
                    />
                  </label>
                  <p className="col-span-2 text-xs text-gray-500">
                    ${precioPorBracket.toLocaleString("es-AR")} por bracket ({bracketReposicion}) × {cantidadBrackets || 0} = $
                    {(precioPorBracket * Number(cantidadBrackets || 0)).toLocaleString("es-AR")}, ya sumado al importe
                    de abajo.
                  </p>
                </div>
              )}
            </>
          )}

          {concepto === "Reposición de bracket" && (
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                Tipo de bracket
                <select
                  value={bracketReposicion}
                  onChange={(e) => setBracketReposicion(e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1.5"
                >
                  {BRACKETS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                Cantidad
                <input
                  type="number"
                  min={1}
                  value={cantidadBrackets}
                  onChange={(e) => setCantidadBrackets(e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1.5"
                />
              </label>
            </div>
          )}

          <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2">
            <p className="mb-1 text-xs text-gray-600">Cargo extra (opcional, se suma al importe)</p>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={cargoExtraDescripcion}
                onChange={(e) => setCargoExtraDescripcion(e.target.value)}
                placeholder="Ej: Estudio radiográfico"
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
              <input
                type="number"
                min={0}
                value={cargoExtraMonto}
                onChange={(e) => setCargoExtraMonto(e.target.value)}
                placeholder="Monto"
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </div>
          </div>

          {saldoAFavor > 0 && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {montoAFavorAplicado > 0 ? (
                <div className="flex items-center justify-between">
                  <span>
                    ✓ Se aplicaron ${montoAFavorAplicado.toLocaleString("es-AR")} de saldo a favor a este cobro.
                  </span>
                  <button
                    type="button"
                    onClick={quitarSaldoAplicado}
                    className="text-xs font-medium text-emerald-700 underline hover:text-emerald-900"
                  >
                    Quitar
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span>💰 Este paciente tiene ${saldoAFavor.toLocaleString("es-AR")} a favor.</span>
                  <input
                    type="number"
                    min={0}
                    max={Math.min(saldoAFavor, Number(importe))}
                    value={montoAAplicarInput}
                    onChange={(e) => setMontoAAplicarInput(e.target.value)}
                    placeholder={String(Math.min(saldoAFavor, Number(importe)))}
                    className="w-28 rounded-md border border-emerald-300 px-2 py-1 text-sm"
                  />
                  <button
                    type="button"
                    onClick={aplicarSaldo}
                    className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                  >
                    Aplicar
                  </button>
                </div>
              )}
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
                Importe
                <input
                  type="number"
                  value={importe}
                  onChange={(e) => setImporte(e.target.value)}
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
                  {MEDIOS_PAGO.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
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
              disabled={guardando || (debeConfirmarAumento && !aumentoConfirmado)}
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
