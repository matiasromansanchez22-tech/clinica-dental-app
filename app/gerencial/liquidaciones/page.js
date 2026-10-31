"use client";

import { useEffect, useMemo, useState } from "react";
import SoloDuenaYContador from "@/components/SoloDuenaYContador";
import { fechaDeHoyISO } from "@/lib/agenda";
import { obtenerHistorialPagos } from "@/lib/data/historialPagos";
import { obtenerProduccionPorProfesional } from "@/lib/data/produccionProfesionales";

const NOMBRES_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function nombreMes(claveMes) {
  const [anio, mes] = claveMes.split("-");
  return `${NOMBRES_MES[Number(mes) - 1]} ${anio}`;
}

function formatoFecha(fechaISO) {
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}

function formatoPesos(n) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

function rangoDelMes(mesISO) {
  const [anio, mes] = mesISO.split("-").map(Number);
  const ultimoDia = new Date(anio, mes, 0).getDate();
  return { desde: `${mesISO}-01`, hasta: `${mesISO}-${String(ultimoDia).padStart(2, "0")}` };
}

function celdaCSV(valor) {
  const texto = String(valor ?? "");
  return /[;"\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

function descargarCSV(nombreArchivo, lineas) {
  // Punto y coma + BOM: así Excel en español lo abre directo en columnas y con tildes.
  const contenido = "﻿" + lineas.map((l) => l.map(celdaCSV).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([contenido], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  URL.revokeObjectURL(url);
}

// Une, por profesional, lo que le correspondía en el mes (Producción) con lo que se le pagó (Historial de pagos).
function armarBalance(produccion, pagos) {
  const porProfesional = new Map();
  const entradaDe = (id, nombre) => {
    if (!porProfesional.has(id)) {
      porProfesional.set(id, { id, nombre, correspondia: 0, osPendiente: 0, pagos: [], pagado: 0, pagadoConDetalle: 0 });
    }
    return porProfesional.get(id);
  };
  for (const f of produccion) {
    // Los honorarios de obra social se liquidan a mes vencido: van aparte, no entran en el saldo del mes.
    const e = entradaDe(f.profesionalId, f.nombre);
    e.correspondia += f.honorariosCopago;
    e.osPendiente += f.honorariosOS;
  }
  for (const p of pagos) {
    const e = entradaDe(p.profesionalId, p.profesional);
    e.pagos.push(p);
    e.pagado += p.monto;
    if (p.cobrosCubiertos.length > 0) e.pagadoConDetalle += p.monto;
  }
  return [...porProfesional.values()]
    .filter((e) => e.correspondia > 0 || e.osPendiente > 0 || e.pagos.length > 0)
    .map((e) => ({ ...e, saldo: e.correspondia - e.pagado }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

function Cifra({ titulo, valor, ayuda, tono = "normal" }) {
  const color = tono === "alerta" ? "text-amber-700" : tono === "ok" ? "text-emerald-700" : "text-gray-900";
  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{titulo}</p>
      <p className={`text-lg font-bold tabular-nums ${color}`}>{valor}</p>
      {ayuda && <p className="text-[11px] text-gray-500">{ayuda}</p>}
    </div>
  );
}

function textoSaldo(saldo) {
  if (Math.abs(saldo) < 500) return { valor: "$0", ayuda: "Al día", tono: "ok" };
  if (saldo > 0) return { valor: formatoPesos(saldo), ayuda: "Falta liquidarle", tono: "alerta" };
  return { valor: formatoPesos(-saldo), ayuda: "Se le pagó de más (o es de un mes anterior)", tono: "normal" };
}

function TarjetaProfesional({ e }) {
  const saldo = textoSaldo(e.saldo);
  const sinDetalle = e.pagado - e.pagadoConDetalle;
  return (
    <section className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 break-inside-avoid">
      <h2 className="text-lg font-bold text-brand-brown">{e.nombre}</h2>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Cifra titulo="Le correspondía" valor={formatoPesos(e.correspondia)} ayuda="Honorarios de copago/particular y ortodoncia" />
        <Cifra titulo="Se le liquidó" valor={formatoPesos(e.pagado)} ayuda={`${e.pagos.length} pago${e.pagos.length === 1 ? "" : "s"}`} />
        <Cifra titulo="Saldo" valor={saldo.valor} ayuda={saldo.ayuda} tono={saldo.tono} />
        <Cifra titulo="Obra social (mes vencido)" valor={formatoPesos(e.osPendiente)} ayuda="Aparte, se liquida cuando se cobra" />
      </div>

      {e.pagos.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">No se le registró ningún pago en este mes.</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-md border border-gray-200 bg-white">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="bg-brand-brown text-white">
                <th className="px-3 py-2 text-left font-semibold">Fecha</th>
                <th className="px-3 py-2 text-left font-semibold">Qué se liquidó</th>
                <th className="px-3 py-2 text-left font-semibold">Pacientes que incluye</th>
                <th className="px-3 py-2 text-right font-semibold">Monto</th>
              </tr>
            </thead>
            <tbody>
              {e.pagos.map((p) => (
                <tr key={p.id} className="border-t border-gray-100 align-top">
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-gray-800">{formatoFecha(p.fecha)}</td>
                  <td className="px-3 py-2 text-gray-700">
                    {p.tipo}
                    <span className="block text-[11px] text-gray-500">
                      {p.medioPago} · {p.salioDe}
                    </span>
                    {p.observaciones && <span className="block text-[11px] text-gray-500">{p.observaciones}</span>}
                  </td>
                  <td className="px-3 py-2 text-gray-800">
                    {p.cobrosCubiertos.length === 0 ? (
                      <span className="text-xs text-gray-400">Sin detalle de pacientes</span>
                    ) : (
                      <>
                        {p.cobrosCubiertos.some((c) => c.tratamientoSaldado) && (
                          <span className="mb-0.5 block text-[11px] font-semibold text-emerald-700">Tratamiento saldado ✓</span>
                        )}
                        {p.cobrosCubiertos.map((c, i) => (
                          <span key={i} className="block text-xs">
                            <strong>{c.paciente}</strong> — {c.detalle} ({formatoFecha(c.fecha)}, {formatoPesos(c.monto)})
                          </span>
                        ))}
                      </>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-gray-900">{formatoPesos(p.monto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {sinDetalle > 0 && (
        <p className="mt-2 text-xs text-gray-500">
          De lo liquidado, {formatoPesos(sinDetalle)} se cargó sin tildar los pacientes que cubría.
        </p>
      )}
    </section>
  );
}

function Contenido() {
  const hoy = fechaDeHoyISO();
  const [mes, setMes] = useState(hoy.slice(0, 7));
  const [profesionalElegido, setProfesionalElegido] = useState("todos");
  const [balance, setBalance] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const { desde, hasta } = rangoDelMes(mes);
    let vigente = true;
    setCargando(true);
    setError(null);
    Promise.all([obtenerProduccionPorProfesional(desde, hasta), obtenerHistorialPagos(desde, hasta)])
      .then(([produccion, pagos]) => {
        if (vigente) setBalance(armarBalance(produccion, pagos));
      })
      .catch((e) => vigente && setError(e.message))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [mes]);

  const visibles = useMemo(
    () => balance.filter((e) => profesionalElegido === "todos" || e.id === profesionalElegido),
    [balance, profesionalElegido]
  );
  const totales = useMemo(
    () => ({
      correspondia: visibles.reduce((s, e) => s + e.correspondia, 0),
      pagado: visibles.reduce((s, e) => s + e.pagado, 0),
      osPendiente: visibles.reduce((s, e) => s + e.osPendiente, 0),
    }),
    [visibles]
  );
  const saldoTotal = textoSaldo(totales.correspondia - totales.pagado);

  function descargar() {
    const lineas = [["Mes", "Profesional", "Fecha del pago", "Tipo", "Medio", "Salió de", "Monto del pago", "Paciente", "Detalle", "Fecha del cobro", "Monto cobrado"]];
    for (const e of visibles) {
      for (const p of e.pagos) {
        const base = [nombreMes(mes), e.nombre, formatoFecha(p.fecha), p.tipo, p.medioPago, p.salioDe, p.monto];
        if (p.cobrosCubiertos.length === 0) lineas.push([...base, "(sin detalle de pacientes)", "", "", ""]);
        else for (const c of p.cobrosCubiertos) lineas.push([...base, c.paciente, c.detalle, formatoFecha(c.fecha), c.monto]);
      }
    }
    descargarCSV(`liquidaciones-profesionales-${mes}.csv`, lineas);
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">🧾 Liquidaciones por profesional</h1>
      <p className="mt-0.5 text-sm text-gray-500">
        Por cada profesional: lo que le correspondía en el mes, lo que se le liquidó (cada pago con los pacientes que
        incluye) y el saldo. Para que un pago muestre sus pacientes, hay que tildarlos al registrar el pago.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3 print:hidden">
        <input
          type="month"
          value={mes}
          onChange={(e) => e.target.value && setMes(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
        <select
          value={profesionalElegido}
          onChange={(e) => setProfesionalElegido(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="todos">Todos los profesionales</option>
          {balance.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </select>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => window.print()}
            disabled={cargando || visibles.length === 0}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 disabled:opacity-50"
          >
            🖨 Imprimir
          </button>
          <button
            onClick={descargar}
            disabled={cargando || visibles.length === 0}
            className="rounded-md bg-brand-brown px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            ⬇ Descargar para Excel
          </button>
        </div>
      </div>

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      {cargando ? (
        <p className="mt-6 text-sm text-gray-500">Cargando...</p>
      ) : visibles.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">No hay honorarios ni pagos registrados en {nombreMes(mes)}.</p>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-brand-brown pb-1">
            <h2 className="text-xl font-bold text-brand-brown">{nombreMes(mes)}</h2>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Cifra titulo="Le correspondía (total)" valor={formatoPesos(totales.correspondia)} />
            <Cifra titulo="Se liquidó (total)" valor={formatoPesos(totales.pagado)} />
            <Cifra titulo="Saldo (total)" valor={saldoTotal.valor} ayuda={saldoTotal.ayuda} tono={saldoTotal.tono} />
            <Cifra titulo="Obra social (mes vencido)" valor={formatoPesos(totales.osPendiente)} />
          </div>
          {visibles.map((e) => (
            <TarjetaProfesional key={e.id} e={e} />
          ))}
        </>
      )}
    </main>
  );
}

export default function LiquidacionesPage() {
  return (
    <SoloDuenaYContador>
      <Contenido />
    </SoloDuenaYContador>
  );
}
