"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import SoloDuenaYContador from "@/components/SoloDuenaYContador";
import RegistrarPagoProfesionalModal from "@/components/RegistrarPagoProfesionalModal";
import { useAuth } from "@/lib/auth/AuthProvider";
import { fechaDeHoyISO } from "@/lib/agenda";
import { marcarCobrosLiquidados } from "@/lib/data/cobrosLiquidados";
import { crearPagoProfesional } from "@/lib/data/pagosProfesionales";
import { buscarPosiblesDuplicados, mensajeDeDuplicados } from "@/lib/data/posiblesDuplicados";
import { obtenerHistorialPagos } from "@/lib/data/historialPagos";
import { obtenerCobrosConEstadoDeLiquidacion } from "@/lib/data/estadoLiquidaciones";
import { obtenerProduccionPorProfesional } from "@/lib/data/produccionProfesionales";

// Liquidación por profesional, en versión simple: un mes, una "cortina" por profesional con lo que le correspondía, lo que se le liquidó y
// lo que falta, con el detalle de cada paciente y de cada pago adentro. Une lo que antes estaba en Producción y en Liquidaciones.

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const pesos = (n) => `$${Math.round(n).toLocaleString("es-AR")}`;
const dm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const TOLERANCIA = 500;

function rango(mes) {
  const [a, m] = mes.split("-").map(Number);
  return { desde: `${mes}-01`, hasta: `${mes}-${String(new Date(a, m, 0).getDate()).padStart(2, "0")}` };
}
function sumarMes(mes, n) {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(a, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
const nombreMes = (mes) => `${MESES[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`;

const ESTILO_ESTADO = {
  liquidado: ["bg-emerald-100 text-emerald-800", "Liquidado ✓"],
  parcial: ["bg-amber-100 text-amber-800", "Pago parcial"],
  pendiente: ["bg-rose-100 text-rose-800", "Falta liquidar"],
};

// Une, por profesional, lo que le correspondía (Producción), lo que se le pagó (pagos) y los cobros del mes con su estado.
function armarBalance(produccion, pagos, cobros) {
  const mapa = new Map();
  const de = (id, nombre) => {
    if (!mapa.has(id)) mapa.set(id, { id, nombre, fila: null, atenciones: 0, correspondia: 0, osPendiente: 0, pagos: [], pagado: 0, cobros: [] });
    return mapa.get(id);
  };
  for (const f of produccion) {
    const e = de(f.profesionalId, f.nombre);
    e.fila = f;
    e.atenciones = f.cantidadAtenciones;
    e.correspondia = f.honorariosCopago;
    e.osPendiente = f.honorariosOS;
  }
  for (const p of pagos) {
    const e = de(p.profesionalId, p.profesional);
    e.pagos.push(p);
    e.pagado += p.monto;
  }
  for (const c of cobros) de(c.profesionalId, c.profesional).cobros.push(c);
  const orden = { pendiente: 0, parcial: 1, liquidado: 2 };
  return [...mapa.values()]
    .filter((e) => e.correspondia > 0 || e.osPendiente > 0 || e.pagos.length > 0)
    .map((e) => ({
      ...e,
      saldo: e.correspondia - e.pagado,
      cobros: [...e.cobros].sort((a, b) => orden[a.estado] - orden[b.estado] || a.fecha.localeCompare(b.fecha) || a.paciente.localeCompare(b.paciente, "es")),
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

function textoSaldo(saldo) {
  if (Math.abs(saldo) < TOLERANCIA) return { valor: "$0", ayuda: "Al día", clase: "text-emerald-700" };
  if (saldo > 0) return { valor: pesos(saldo), ayuda: "Falta liquidarle", clase: "text-rose-700" };
  return { valor: pesos(-saldo), ayuda: "Se le pagó de más (o es de otro mes)", clase: "text-amber-700" };
}

const MEDIOS_PAGO = ["Efectivo", "Transferencia", "Débito", "Crédito", "Mercado Pago", "QR"];

// "Ya liquidé": para cuando el pago a un profesional lo hizo la dirección por afuera (por ejemplo, el día que correspondía no había plata).
// Se tildan los pacientes que ya se pagaron y queda registrado el pago y cada paciente como liquidado, igual que al registrar un pago.
function PanelYaLiquide({ e, preseleccion, onClose, onGuardado }) {
  const { perfil } = useAuth();
  const puedeUsarReserva = perfil?.rol === "Duena" || perfil?.rol === "Contador";
  const pendientes = useMemo(() => e.cobros.filter((c) => c.estado !== "liquidado" && c.falta > 0), [e.cobros]);
  const [elegidos, setElegidos] = useState(() => new Set(preseleccion ? [preseleccion] : pendientes.map((c) => c.clave)));
  const [fecha, setFecha] = useState(fechaDeHoyISO());
  const [medioPago, setMedioPago] = useState("Efectivo");
  const [desdeReserva, setDesdeReserva] = useState(false);
  const [observaciones, setObservaciones] = useState(`Marcado como liquidado por ${perfil?.nombre ?? "la dirección"} (se pagó fuera de la app)`);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const lista = pendientes.filter((c) => elegidos.has(c.clave));
  const total = lista.reduce((a, c) => a + c.falta, 0);

  const alternar = (clave) =>
    setElegidos((a) => {
      const n = new Set(a);
      if (n.has(clave)) n.delete(clave);
      else n.add(clave);
      return n;
    });

  async function confirmar() {
    setError(null);
    if (lista.length === 0 || total <= 0) return setError("Tildá al menos un paciente que ya se haya liquidado.");
    setGuardando(true);
    try {
      const parecidos = await buscarPosiblesDuplicados({ tabla: "pagos_profesionales", fecha, monto: total, quien: `${e.nombre} ${observaciones}`, profesionalId: e.id });
      if (parecidos.length > 0 && !window.confirm(mensajeDeDuplicados(parecidos, total))) {
        setGuardando(false);
        return;
      }
      const pago = await crearPagoProfesional({ fecha, profesionalId: e.id, tipo: "Copago", monto: total, medioPago, observaciones, desdeReserva });
      try {
        await marcarCobrosLiquidados(
          pago.id,
          lista.map((c) => ({ tipo: c.clave.startsWith("o:") ? "ortodoncia" : "general", id: c.clave.split("|")[0].slice(2), parcial: false, honorarios: c.honorarios, montoPagado: c.falta }))
        );
      } catch (errMarca) {
        window.alert(`El pago se registró, pero no se pudieron marcar los pacientes como liquidados: ${errMarca.message}`);
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
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold text-brand-brown">✅ Ya liquidé · {e.nombre}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            ✕
          </button>
        </div>
        <p className="mb-3 text-sm text-gray-600">Tildá los pacientes que ya le pagaste. Queda registrado el pago y cada paciente como liquidado.</p>
        {error && <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

        {pendientes.length === 0 ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">No hay pacientes pendientes de liquidar este mes.</p>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between text-xs">
              <button onClick={() => setElegidos(new Set(pendientes.map((c) => c.clave)))} className="font-semibold text-brand-brown hover:underline">
                Tildar todos
              </button>
              <button onClick={() => setElegidos(new Set())} className="text-gray-500 hover:underline">
                Destildar todos
              </button>
            </div>
            <ul className="max-h-64 divide-y divide-gray-100 overflow-y-auto rounded-md border border-gray-200">
              {pendientes.map((c) => (
                <li key={c.clave}>
                  <label className="flex cursor-pointer items-start gap-2 px-3 py-2 text-sm hover:bg-brand-cream/60">
                    <input type="checkbox" checked={elegidos.has(c.clave)} onChange={() => alternar(c.clave)} className="mt-1" />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium text-gray-900">{c.paciente}</span>
                      <span className="block truncate text-xs text-gray-500">
                        {dm(c.fecha)} · {c.detalle}
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums text-brand-green">{pesos(c.falta)}</span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex items-center justify-between rounded-md bg-brand-green px-3 py-2 text-white">
              <span className="text-sm">Total que ya liquidaste ({lista.length})</span>
              <b className="font-heading text-xl">{pesos(total)}</b>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                Fecha en que se pagó
                <input type="date" value={fecha} max={fechaDeHoyISO()} onChange={(ev) => setFecha(ev.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5" />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                Medio de pago
                <select value={medioPago} onChange={(ev) => setMedioPago(ev.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5">
                  {MEDIOS_PAGO.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
            </div>
            {puedeUsarReserva && (
              <label className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <input type="checkbox" checked={desdeReserva} onChange={(ev) => setDesdeReserva(ev.target.checked)} className="mt-0.5" />
                <span>
                  <strong>Se pagó con la reserva del Consultorio.</strong> Descuenta de la reserva y no baja lo limpio del mes. Si no la marcás, queda como un pago de Producción.
                </span>
              </label>
            )}
            <label className="mt-3 flex flex-col gap-1 text-sm text-gray-700">
              Observaciones
              <textarea value={observaciones} onChange={(ev) => setObservaciones(ev.target.value)} rows={2} className="rounded-md border border-gray-300 px-2 py-1.5" />
            </label>
          </>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          {pendientes.length > 0 && (
            <button onClick={confirmar} disabled={guardando || lista.length === 0} className="rounded-md bg-brand-brown px-4 py-2 text-sm font-semibold text-white hover:bg-brand-brown-dark disabled:opacity-50">
              {guardando ? "Guardando..." : `Ya liquidé ${pesos(total)}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Profesional({ e, abierto, onAlternar, soloFaltan, onPagar, onYaLiquide }) {
  const s = textoSaldo(e.saldo);
  const cobros = soloFaltan ? e.cobros.filter((c) => c.estado !== "liquidado") : e.cobros;
  const totalCorresponde = e.cobros.reduce((a, c) => a + c.honorarios, 0);
  const puedePagar = e.id !== "sin-asignar" && e.fila;
  return (
    <section className="overflow-hidden rounded-xl border border-brand-tan/70 bg-white">
      <button onClick={onAlternar} className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left hover:bg-brand-cream/60" aria-expanded={abierto}>
        <div>
          <p className="text-base font-bold text-gray-900">{e.nombre}</p>
          <p className="text-sm text-gray-600">
            <strong>{e.atenciones}</strong> {e.atenciones === 1 ? "atención" : "atenciones"}
            {e.osPendiente > 0 && <span> · obra social a mes vencido {pesos(e.osPendiente)}</span>}
          </p>
        </div>
        <div className="flex items-center gap-5 text-right">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Le correspondía</p>
            <p className="font-heading text-lg font-extrabold text-brand-charcoal">{pesos(e.correspondia)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Se le liquidó</p>
            <p className="font-heading text-lg font-extrabold text-brand-charcoal">{pesos(e.pagado)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-500">{s.ayuda}</p>
            <p className={`font-heading text-xl font-extrabold ${s.clase}`}>{s.valor}</p>
          </div>
          <span className="text-gray-400">{abierto ? "▲" : "▼"}</span>
        </div>
      </button>

      {abierto && (
        <div className="border-t border-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-brand-cream/60 px-4 py-2">
            <p className="text-xs text-gray-600">
              {e.pagos.length} pago{e.pagos.length === 1 ? "" : "s"} registrado{e.pagos.length === 1 ? "" : "s"} este mes
              {e.osPendiente > 0 && " · la obra social se liquida a mes vencido, cuando se cobra"}
            </p>
            {puedePagar && (
              <div className="flex flex-wrap gap-2">
                {e.cobros.some((c) => c.estado !== "liquidado") && (
                  <button onClick={() => onYaLiquide(e, null)} className="rounded-md border border-brand-green bg-white px-3 py-1.5 text-sm font-semibold text-brand-green hover:bg-emerald-50">
                    ✅ Ya liquidé
                  </button>
                )}
                <button
                  onClick={() => onPagar(e, "Copago", Math.max(e.saldo, 0))}
                  className="rounded-md bg-brand-green px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-green/90"
                >
                  💵 Registrar pago{e.saldo > TOLERANCIA ? ` (${pesos(e.saldo)})` : ""}
                </button>
                {e.osPendiente > 0 && (
                  <button onClick={() => onPagar(e, "Obra Social", e.osPendiente)} className="rounded-md border border-brand-brown/40 px-3 py-1.5 text-sm font-medium text-brand-brown hover:bg-brand-tan/30">
                    💵 Pagar obra social ({pesos(e.osPendiente)})
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-brand-tan/40 text-left text-xs uppercase tracking-wide text-brand-brown">
                  <th className="px-4 py-2">Fecha</th>
                  <th className="px-2 py-2">Paciente</th>
                  <th className="px-2 py-2">Qué se cobró</th>
                  <th className="px-2 py-2 text-right">Cobró</th>
                  <th className="px-2 py-2 text-right">Le corresponde</th>
                  <th className="px-4 py-2">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cobros.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-3 text-center text-sm text-gray-500">
                      {soloFaltan ? "No hay pacientes con liquidación pendiente." : "No hay cobros con honorarios en este mes."}
                    </td>
                  </tr>
                )}
                {cobros.map((c) => {
                  const [clase, texto] = ESTILO_ESTADO[c.estado];
                  return (
                    <tr key={c.clave} className="align-top">
                      <td className="whitespace-nowrap px-4 py-2 text-gray-600">{dm(c.fecha)}</td>
                      <td className="px-2 py-2 font-medium text-gray-900">
                        {c.paciente}
                        {c.grupo === "obra_social" && <span className="ml-1 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-900">Obra social</span>}
                      </td>
                      <td className="px-2 py-2 text-xs text-gray-600">{c.detalle}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{pesos(c.monto)}</td>
                      <td className="px-2 py-2 text-right font-semibold tabular-nums text-brand-green">{pesos(c.honorarios)}</td>
                      <td className="px-4 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${clase}`}>{texto}</span>
                        {c.estado === "parcial" && <p className="mt-0.5 text-[11px] text-gray-500">Pagó {pesos(c.liquidado)} · falta {pesos(c.falta)}</p>}
                        {c.estado !== "liquidado" && puedePagar && (
                          <button onClick={() => onYaLiquide(e, c.clave)} className="mt-1 block text-[11px] font-semibold text-brand-green hover:underline">
                            ✅ Ya liquidé
                          </button>
                        )}
                        {c.estado === "liquidado" && c.fechaLiquidacion && <p className="mt-0.5 text-[11px] text-gray-500">{dm(c.fechaLiquidacion)}</p>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-brand-cream font-bold">
                  <td className="px-4 py-2" colSpan={4}>
                    Total de {e.nombre.split(" ")[0]}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-brand-green">{pesos(totalCorresponde)}</td>
                  <td className="px-4 py-2 text-xs text-gray-700">Saldo: {s.valor}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {e.pagos.length > 0 && (
            <div className="border-t border-gray-100 px-4 py-3">
              <p className="text-xs font-extrabold uppercase tracking-wide text-brand-brown/80">Pagos registrados</p>
              <ul className="mt-1 divide-y divide-gray-100 text-sm">
                {e.pagos.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                    <span>
                      <span className="tabular-nums text-gray-600">{dm(p.fecha)}</span> · {p.tipo} · {p.medioPago}
                      <span className="text-xs text-gray-500"> · {p.salioDe}</span>
                      {p.cobrosCubiertos.length > 0 && <span className="text-xs text-gray-500"> · cubre {p.cobrosCubiertos.length} paciente{p.cobrosCubiertos.length === 1 ? "" : "s"}</span>}
                      {p.observaciones && <span className="block text-[11px] text-gray-500">{p.observaciones}</span>}
                    </span>
                    <strong className="tabular-nums">{pesos(p.monto)}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Contenido() {
  const mesActual = fechaDeHoyISO().slice(0, 7);
  const [mes, setMes] = useState(mesActual);
  const [balance, setBalance] = useState(null);
  const [error, setError] = useState(null);
  const [abiertos, setAbiertos] = useState(() => new Set());
  const [soloFaltan, setSoloFaltan] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [modalPago, setModalPago] = useState(null); // { fila, tipo, montoSugerido }
  const [yaLiquide, setYaLiquide] = useState(null); // { e, preseleccion }
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vigente = true;
    setError(null);
    const { desde, hasta } = rango(mes);
    Promise.all([
      obtenerProduccionPorProfesional(desde, hasta),
      obtenerHistorialPagos(desde, hasta),
      // Si todavía no se corrió alguna migración de pagos parciales, la pantalla se ve igual, sin el detalle por paciente.
      obtenerCobrosConEstadoDeLiquidacion(desde, hasta).catch(() => []),
    ])
      .then(([produccion, pagos, cobros]) => vigente && setBalance(armarBalance(produccion, pagos, cobros)))
      .catch((e) => vigente && setError(e.message));
    return () => {
      vigente = false;
    };
  }, [mes, version]);

  const cambiarMes = useCallback((nuevo) => {
    setBalance(null);
    setMes(nuevo);
  }, []);

  const t = useMemo(() => {
    if (!balance) return null;
    return {
      atenciones: balance.reduce((a, e) => a + e.atenciones, 0),
      correspondia: balance.reduce((a, e) => a + e.correspondia, 0),
      pagado: balance.reduce((a, e) => a + e.pagado, 0),
      os: balance.reduce((a, e) => a + e.osPendiente, 0),
    };
  }, [balance]);
  const cerrado = mes < mesActual;
  const saldoTotal = t ? t.correspondia - t.pagado : 0;
  const frase = t
    ? `${cerrado ? "Cerró" : "Va"} ${nombreMes(mes)} con ${t.atenciones} atenciones. A los profesionales les correspondió ${pesos(t.correspondia)}; se les liquidó ${pesos(t.pagado)}${
        Math.abs(saldoTotal) < TOLERANCIA ? ": está todo al día." : saldoTotal > 0 ? `; falta liquidar ${pesos(saldoTotal)}.` : `; se pagó de más ${pesos(-saldoTotal)} (o corresponde a otro mes).`
      }${t.os > 0 ? ` Aparte, de obra social quedan ${pesos(t.os)} para liquidar a mes vencido.` : ""}`
    : "";

  const alternar = (id) =>
    setAbiertos((a) => {
      const n = new Set(a);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  async function copiar() {
    const lineas = [frase, "", ...balance.map((e) => `• ${e.nombre}: le correspondía ${pesos(e.correspondia)} · se le liquidó ${pesos(e.pagado)} · saldo ${textoSaldo(e.saldo).valor}`)];
    try {
      await navigator.clipboard.writeText(lineas.join("\n"));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      window.prompt("Copiá el resumen:", lineas.join("\n"));
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-brown/70">Gerencial</p>
      <h1 className="font-heading text-3xl font-extrabold text-brand-brown">💰 Liquidación por profesional</h1>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={() => cambiarMes(sumarMes(mes, -1))} className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm hover:bg-gray-50" aria-label="Mes anterior">
          ←
        </button>
        <input type="month" value={mes} max={mesActual} onChange={(e) => e.target.value && cambiarMes(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        <button disabled={mes >= mesActual} onClick={() => cambiarMes(sumarMes(mes, 1))} className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-40" aria-label="Mes siguiente">
          →
        </button>
        <span className="text-sm font-semibold capitalize text-gray-700">{nombreMes(mes)}</span>
        {balance && balance.length > 0 && (
          <div className="ml-auto flex flex-wrap gap-2 text-sm">
            <label className="flex items-center gap-1.5 rounded-md border border-gray-300 px-2.5 py-1.5 text-gray-700">
              <input type="checkbox" checked={soloFaltan} onChange={(e) => setSoloFaltan(e.target.checked)} /> Solo lo que falta liquidar
            </label>
            <button onClick={() => setAbiertos(new Set(balance.map((p) => p.id)))} className="rounded-md border border-brand-brown/40 px-3 py-1.5 font-medium text-brand-brown hover:bg-brand-tan/30">
              Abrir todos
            </button>
            <button onClick={() => setAbiertos(new Set())} className="rounded-md border border-brand-brown/40 px-3 py-1.5 font-medium text-brand-brown hover:bg-brand-tan/30">
              Cerrar todos
            </button>
          </div>
        )}
      </div>

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
      {!balance && !error && <p className="mt-4 text-sm text-gray-500">Calculando…</p>}

      {balance && balance.length === 0 && <p className="mt-4 rounded-md border border-brand-tan bg-white px-4 py-3 text-sm text-gray-700">No hay honorarios ni pagos en {nombreMes(mes)}.</p>}

      {balance && balance.length > 0 && (
        <>
          <div className="mt-4 rounded-xl border border-brand-green/40 bg-emerald-50/60 px-4 py-3">
            <p className="text-[15px] leading-relaxed text-gray-900">{frase}</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
              <div>
                <p className="font-heading text-2xl font-extrabold text-brand-charcoal">{pesos(t.correspondia)}</p>
                <p className="text-[11px] uppercase tracking-wide text-gray-500">les correspondía</p>
              </div>
              <div>
                <p className="font-heading text-2xl font-extrabold text-brand-charcoal">{pesos(t.pagado)}</p>
                <p className="text-[11px] uppercase tracking-wide text-gray-500">se les liquidó</p>
              </div>
              <div>
                <p className={`font-heading text-2xl font-extrabold ${textoSaldo(saldoTotal).clase}`}>{textoSaldo(saldoTotal).valor}</p>
                <p className="text-[11px] uppercase tracking-wide text-gray-500">{textoSaldo(saldoTotal).ayuda}</p>
              </div>
              <div>
                <p className="font-heading text-2xl font-extrabold text-brand-charcoal">{pesos(t.os)}</p>
                <p className="text-[11px] uppercase tracking-wide text-gray-500">obra social (mes vencido)</p>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <button onClick={copiar} className="rounded-md border border-brand-brown/40 bg-white px-3 py-1 text-sm font-medium text-brand-brown hover:bg-brand-tan/30">
                {copiado ? "✓ Copiado" : "📋 Copiar resumen"}
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {balance.map((e) => (
              <Profesional key={e.id} e={e} abierto={abiertos.has(e.id)} onAlternar={() => alternar(e.id)} soloFaltan={soloFaltan} onPagar={(prof, tipo, montoSugerido) => setModalPago({ fila: prof.fila, tipo, montoSugerido })} onYaLiquide={(prof, preseleccion) => setYaLiquide({ e: prof, preseleccion })} />
            ))}
          </div>
        </>
      )}

      <p className="mt-6 text-xs text-gray-500">
        ¿Necesitás cambiar los porcentajes, imprimir el informe de un profesional o bajar el Excel? Está en la pantalla completa de{" "}
        <Link href="/gerencial/produccion" className="font-semibold text-brand-brown underline">
          Producción
        </Link>{" "}
        y en la de{" "}
        <Link href="/gerencial/liquidaciones" className="font-semibold text-brand-brown underline">
          Liquidaciones
        </Link>
        .
      </p>

      {yaLiquide && (
        <PanelYaLiquide
          e={yaLiquide.e}
          preseleccion={yaLiquide.preseleccion}
          onClose={() => setYaLiquide(null)}
          onGuardado={() => {
            setYaLiquide(null);
            setVersion((v) => v + 1);
          }}
        />
      )}

      {modalPago && (
        <RegistrarPagoProfesionalModal
          profesional={modalPago.fila}
          tipo={modalPago.tipo}
          montoSugerido={modalPago.montoSugerido}
          onClose={() => setModalPago(null)}
          onGuardado={() => {
            setModalPago(null);
            setVersion((v) => v + 1);
          }}
        />
      )}
    </main>
  );
}

export default function LiquidacionPorProfesionalPage() {
  return (
    <SoloDuenaYContador>
      <Contenido />
    </SoloDuenaYContador>
  );
}
