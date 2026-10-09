"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import NoOdontologoNiLaboratorio from "@/components/NoOdontologoNiLaboratorio";
import { fechaDeHoyISO, sumarDias } from "@/lib/agenda";
import { filtrarCobros, obtenerCobrosParaBuscador } from "@/lib/data/buscadorCobros";

const MEDIOS = ["Efectivo", "Transferencia", "Débito", "Crédito", "Mercado Pago", "QR", "Mixto"];

function formatoFecha(fechaISO) {
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}

function formatoPesos(n) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

function celdaCSV(valor) {
  const texto = String(valor ?? "");
  return /[;"\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

function BuscarCobros() {
  const hoy = fechaDeHoyISO();
  const parametros = useSearchParams();
  const [caja, setCaja] = useState(parametros.get("caja") === "ortodoncia" ? "Ortodoncia" : "General");
  const [dias, setDias] = useState(30); // 7 | 30 | 90 | 0 (todo) | -1 (entre fechas)
  const [desde, setDesde] = useState(sumarDias(hoy, -30));
  const [hasta, setHasta] = useState(hoy);
  const [texto, setTexto] = useState("");
  const [medio, setMedio] = useState("todos");
  const [cobros, setCobros] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let fechaDesde = null;
    let fechaHasta = null;
    if (dias > 0) fechaDesde = sumarDias(hoy, -dias);
    if (dias === -1) {
      fechaDesde = desde || null;
      fechaHasta = hasta || null;
    }
    setCargando(true);
    setError(null);
    obtenerCobrosParaBuscador(caja, fechaDesde, fechaHasta)
      .then(setCobros)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caja, dias, desde, hasta]);

  const filtrados = useMemo(() => filtrarCobros(cobros, texto, medio), [cobros, texto, medio]);
  const total = filtrados.reduce((s, c) => s + c.monto, 0);
  const porMedio = useMemo(() => {
    const mapa = {};
    for (const c of filtrados) for (const p of c.partes) mapa[p.medio] = (mapa[p.medio] || 0) + Number(p.monto);
    return Object.entries(mapa).sort((a, b) => b[1] - a[1]);
  }, [filtrados]);

  const rutaDia = caja === "Ortodoncia" ? "/ortodoncia/caja" : "/caja";

  function descargar() {
    const lineas = [["Fecha", "Paciente", "Cobertura", "Detalle", "Atendió", "Monto", "Medio"]];
    for (const c of filtrados) lineas.push([formatoFecha(c.fecha), c.paciente, c.cobertura, c.detalle, c.atendio, c.monto, c.medioTexto]);
    const contenido = "﻿" + lineas.map((l) => l.map(celdaCSV).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([contenido], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `cobros-${caja.toLowerCase()}-${hoy}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">🔎 Buscar cobros</h1>
      <p className="mt-0.5 text-sm text-gray-500">
        La lista de todos los cobros de la caja, de cualquier día. Escribí un paciente, una prestación, un profesional o un
        monto para encontrar uno; tocá <strong>Ver día</strong> para abrir ese día en Caja.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded-md border border-gray-300 text-sm">
          {["General", "Ortodoncia"].map((c) => (
            <button
              key={c}
              onClick={() => setCaja(c)}
              className={`px-3 py-1.5 ${caja === c ? "bg-brand-brown text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
            >
              Caja {c}
            </button>
          ))}
        </div>
        <div className="flex overflow-hidden rounded-md border border-gray-300 text-sm">
          {[
            [7, "7 días"],
            [30, "30 días"],
            [90, "90 días"],
            [0, "Todo"],
            [-1, "Entre fechas"],
          ].map(([valor, etiqueta]) => (
            <button
              key={valor}
              onClick={() => setDias(valor)}
              className={`px-3 py-1.5 ${dias === valor ? "bg-brand-brown text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
            >
              {etiqueta}
            </button>
          ))}
        </div>
        {dias === -1 && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
            a
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          autoFocus
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar paciente, prestación, profesional o monto..."
          className="w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <select value={medio} onChange={(e) => setMedio(e.target.value)} className="rounded-md border border-gray-300 px-2 py-2 text-sm">
          <option value="todos">Todos los medios de pago</option>
          {MEDIOS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <button
          onClick={descargar}
          disabled={cargando || filtrados.length === 0}
          className="ml-auto rounded-md bg-brand-brown px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          ⬇ Descargar para Excel
        </button>
      </div>

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      {!cargando && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-md bg-gray-700 px-3 py-1.5 text-white">
            {filtrados.length} cobro{filtrados.length === 1 ? "" : "s"} · <strong>{formatoPesos(total)}</strong>
          </span>
          {porMedio.map(([m, monto]) => (
            <span key={m} className="rounded-md border border-gray-200 px-3 py-1.5 text-gray-700">
              {m}: <strong>{formatoPesos(monto)}</strong>
            </span>
          ))}
        </div>
      )}

      <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr className="bg-brand-brown text-white">
              <th className="px-3 py-2 text-left font-semibold">Fecha</th>
              <th className="px-3 py-2 text-left font-semibold">Paciente</th>
              <th className="px-3 py-2 text-left font-semibold">Cobertura</th>
              <th className="px-3 py-2 text-left font-semibold">Detalle</th>
              <th className="px-3 py-2 text-left font-semibold">Atendió</th>
              <th className="px-3 py-2 text-right font-semibold">Monto</th>
              <th className="px-3 py-2 text-left font-semibold">Medio</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-gray-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!cargando && filtrados.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-gray-500">
                  No hay cobros que coincidan.
                </td>
              </tr>
            )}
            {filtrados.map((c) => (
              <tr key={c.id} className="border-t border-gray-100 align-top">
                <td className="whitespace-nowrap px-3 py-2 tabular-nums text-gray-800">{formatoFecha(c.fecha)}</td>
                <td className="px-3 py-2 font-medium text-gray-900">{c.paciente}</td>
                <td className="px-3 py-2 text-gray-600">{c.cobertura}</td>
                <td className="px-3 py-2 text-gray-600">{c.detalle}</td>
                <td className="whitespace-nowrap px-3 py-2 text-gray-600">{c.atendio}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-gray-900">{formatoPesos(c.monto)}</td>
                <td className="px-3 py-2 text-gray-600">{c.medioTexto}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <a href={`${rutaDia}?fecha=${c.fecha}`} className="text-xs font-medium text-brand-brown hover:underline">
                    Ver día →
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

export default function BuscarCobrosPage() {
  return (
    <NoOdontologoNiLaboratorio>
      <BuscarCobros />
    </NoOdontologoNiLaboratorio>
  );
}
