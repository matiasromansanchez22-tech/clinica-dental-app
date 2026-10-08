"use client";

import { useEffect, useMemo, useState } from "react";
import SoloDuena from "@/components/SoloDuena";
import { fechaDeHoyISO } from "@/lib/agenda";
import {
  agruparPorObraSocial,
  honorariosDe,
  obtenerPrestacionesPorObraSocial,
  resumenParaLiquidar,
  totalOS,
} from "@/lib/data/pacientesPorObraSocial";

function formatoFecha(fechaISO) {
  if (!fechaISO) return "—";
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
  return /[;"\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

const ESTILO_ESTADO = {
  Pendiente: "bg-amber-100 text-amber-800",
  Entregada: "bg-sky-100 text-sky-800",
  Rechazada: "bg-red-100 text-red-800",
  Liquidada: "bg-emerald-100 text-emerald-800",
};

function PaginaPacientesPorObraSocial() {
  const hoy = fechaDeHoyISO();
  const [modo, setModo] = useState("mes"); // "mes" | "rango" | "todo"
  const [mes, setMes] = useState(hoy.slice(0, 7));
  const [desde, setDesde] = useState(`${hoy.slice(0, 4)}-01-01`);
  const [hasta, setHasta] = useState(hoy);
  const [obraSocialElegida, setObraSocialElegida] = useState("todas");
  const [profesionalElegido, setProfesionalElegido] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [prestaciones, setPrestaciones] = useState([]);
  const [abiertas, setAbiertas] = useState(() => new Set());
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let fechaDesde = null;
    let fechaHasta = null;
    if (modo === "mes") ({ desde: fechaDesde, hasta: fechaHasta } = rangoDelMes(mes));
    if (modo === "rango") {
      fechaDesde = desde || null;
      fechaHasta = hasta || null;
    }
    setCargando(true);
    setError(null);
    obtenerPrestacionesPorObraSocial(fechaDesde, fechaHasta)
      .then(setPrestaciones)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [modo, mes, desde, hasta]);

  const opcionesObraSocial = useMemo(() => agruparPorObraSocial(prestaciones), [prestaciones]);

  const opcionesProfesional = useMemo(() => {
    const mapa = new Map();
    for (const p of prestaciones) mapa.set(p.profesionalId ?? "sin-asignar", p.profesional);
    return [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1], "es"));
  }, [prestaciones]);

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return prestaciones.filter((p) => {
      if (obraSocialElegida !== "todas" && p.claveObraSocial !== obraSocialElegida) return false;
      if (profesionalElegido !== "todos" && (p.profesionalId ?? "sin-asignar") !== profesionalElegido) return false;
      if (!texto) return true;
      return (
        p.paciente.toLowerCase().includes(texto) ||
        p.prestacion.toLowerCase().includes(texto) ||
        (p.dni || "").toLowerCase().includes(texto) ||
        (p.numeroAfiliado || "").toLowerCase().includes(texto)
      );
    });
  }, [prestaciones, obraSocialElegida, profesionalElegido, busqueda]);

  const grupos = useMemo(() => agruparPorObraSocial(filtradas), [filtradas]);
  const liquidacion = useMemo(() => resumenParaLiquidar(filtradas), [filtradas]);

  const totales = useMemo(
    () => ({
      prestaciones: liquidacion.reduce((s, r) => s + r.prestaciones, 0),
      facturado: liquidacion.reduce((s, r) => s + r.facturado, 0),
      sinLiquidar: liquidacion.reduce((s, r) => s + r.sinLiquidar, 0),
      baseLiquidable: liquidacion.reduce((s, r) => s + r.baseLiquidable, 0),
      honorarios: liquidacion.reduce((s, r) => s + r.honorarios, 0),
    }),
    [liquidacion]
  );

  function alternar(clave) {
    setAbiertas((previas) => {
      const nuevas = new Set(previas);
      if (nuevas.has(clave)) nuevas.delete(clave);
      else nuevas.add(clave);
      return nuevas;
    });
  }

  function descargarExcel() {
    const lineas = [
      [
        "Obra social", "Paciente", "DNI", "Nº afiliado", "Fecha", "Prestación", "Código",
        "Cantidad", "Valor OS (c/u)", "Total OS", "Atendió", "Se liquida", "Honorarios", "Estado",
      ],
    ];
    for (const g of grupos) {
      for (const f of g.filas) {
        lineas.push([
          g.nombre, f.paciente, f.dni || "", f.numeroAfiliado || "", formatoFecha(f.fecha), f.prestacion,
          f.codigo || "", f.cantidad, f.valorOS, totalOS(f), f.profesional,
          f.sinHonorarios ? "No" : "Sí", Math.round(honorariosDe(f)), f.estado,
        ]);
      }
    }
    // Punto y coma + BOM: así Excel en español lo abre directo en columnas y con tildes.
    const contenido = "﻿" + lineas.map((l) => l.map(celdaCSV).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([contenido], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `prestaciones-por-obra-social-${hoy}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">Pacientes por obra social</h1>
      <p className="mt-0.5 text-sm text-gray-500">
        Solo visible para Dueña. Cada obra social con sus pacientes, lo que se les hizo y quién los atendió — la misma
        base de Control de Obras Sociales y Pagos ASOR, para poder cruzarla con lo que paga ASOR. Los Particulares no
        aparecen porque no pasan por obra social.
      </p>

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded-md border border-gray-300 text-sm">
          {[
            ["mes", "Un mes"],
            ["rango", "Entre fechas"],
            ["todo", "Todo"],
          ].map(([clave, texto]) => (
            <button
              key={clave}
              onClick={() => setModo(clave)}
              className={`px-3 py-1.5 ${
                modo === clave ? "bg-brand-brown text-white" : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {texto}
            </button>
          ))}
        </div>
        {modo === "mes" && (
          <input
            type="month"
            value={mes}
            onChange={(e) => e.target.value && setMes(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
        )}
        {modo === "rango" && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
            a
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </div>
        )}
        <select
          value={obraSocialElegida}
          onChange={(e) => setObraSocialElegida(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="todas">Todas las obras sociales</option>
          {opcionesObraSocial.map((g) => (
            <option key={g.clave} value={g.clave}>
              {g.nombre}
            </option>
          ))}
        </select>
        <select
          value={profesionalElegido}
          onChange={(e) => setProfesionalElegido(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="todos">Todos los profesionales</option>
          {opcionesProfesional.map(([id, nombre]) => (
            <option key={id} value={id}>
              {nombre}
            </option>
          ))}
        </select>
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar paciente, DNI o prestación..."
          className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        />
      </div>

      {cargando ? (
        <p className="mt-6 text-sm text-gray-500">Cargando...</p>
      ) : grupos.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">No hay prestaciones de obras sociales para este filtro.</p>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray-700">
            <span>
              <strong>{grupos.length}</strong> obra{grupos.length === 1 ? "" : "s"} social{grupos.length === 1 ? "" : "es"}
            </span>
            <span>
              <strong>{totales.prestaciones}</strong> prestaciones
            </span>
            <button
              onClick={() => setAbiertas(new Set(grupos.map((g) => g.clave)))}
              className="text-brand-brown underline"
            >
              Abrir todas
            </button>
            <button onClick={() => setAbiertas(new Set())} className="text-brand-brown underline">
              Cerrar todas
            </button>
            <button
              onClick={descargarExcel}
              className="ml-auto rounded-md bg-brand-brown px-3 py-1.5 font-medium text-white"
            >
              ⬇ Descargar para Excel
            </button>
          </div>

          <section className="mt-4 overflow-hidden rounded-lg border-2 border-brand-brown">
            <h2 className="bg-brand-tan/40 px-4 py-2 text-sm font-bold uppercase text-brand-brown">
              💰 Resumen para liquidar
            </h2>
            <div className="overflow-x-auto bg-white">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="text-xs text-gray-500">
                    <th className="px-4 py-2 text-left font-semibold">Profesional</th>
                    <th className="px-3 py-2 text-right font-semibold">Facturado a las OS</th>
                    <th className="px-3 py-2 text-right font-semibold">Sin liquidar (estampillas)</th>
                    <th className="px-3 py-2 text-right font-semibold">Base a liquidar</th>
                    <th className="px-3 py-2 text-right font-semibold">%</th>
                    <th className="px-4 py-2 text-right font-semibold">Hay que pagarle</th>
                  </tr>
                </thead>
                <tbody>
                  {liquidacion.map((r) => (
                    <tr key={r.id} className="border-t border-gray-100">
                      <td className="px-4 py-2 font-medium text-gray-900">{r.nombre}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatoPesos(r.facturado)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-500">{formatoPesos(r.sinLiquidar)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatoPesos(r.baseLiquidable)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-gray-500">{r.porcentaje}%</td>
                      <td className="px-4 py-2 text-right font-semibold tabular-nums text-brand-brown">
                        {formatoPesos(r.honorarios)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-brand-brown bg-brand-tan/20 font-bold">
                    <td className="px-4 py-2.5">TOTAL</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatoPesos(totales.facturado)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-gray-500">{formatoPesos(totales.sinLiquidar)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatoPesos(totales.baseLiquidable)}</td>
                    <td className="px-3 py-2.5"></td>
                    <td className="px-4 py-2.5 text-right text-base tabular-nums text-brand-brown">
                      {formatoPesos(totales.honorarios)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="bg-white px-4 pb-3 text-xs text-gray-500">
              Las estampillas se cobran a la obra social pero no se liquidan. Los honorarios son el % de obra social de
              cada profesional sobre la base a liquidar (valor de cada prestación × cantidad).
            </p>
          </section>

          <div className="mt-3 flex flex-col gap-3">
            {grupos.map((g) => {
              const abierta = abiertas.has(g.clave);
              return (
                <section key={g.clave} className="overflow-hidden rounded-lg border border-brand-brown/40 shadow-sm">
                  <button
                    onClick={() => alternar(g.clave)}
                    className="flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-1 bg-brand-brown px-4 py-3 text-left text-white"
                  >
                    <span className="flex items-center gap-2 text-lg font-bold">
                      <span className="text-sm">{abierta ? "▼" : "▶"}</span>
                      {g.nombre}
                    </span>
                    <span className="flex flex-wrap gap-x-5 gap-y-0.5 text-sm">
                      <span>{g.pacientes} paciente{g.pacientes === 1 ? "" : "s"}</span>
                      <span>{g.prestaciones} prestaciones</span>
                      <span>{formatoPesos(g.total)}</span>
                      <span className="font-semibold">A pagar: {formatoPesos(g.honorarios)}</span>
                    </span>
                  </button>
                  {abierta && (
                    <div className="overflow-x-auto bg-white">
                      <table className="w-full min-w-[820px] border-collapse text-sm">
                        <thead>
                          <tr className="bg-brand-tan/30 text-xs text-brand-brown">
                            <th className="px-4 py-2 text-left font-semibold">Paciente</th>
                            <th className="px-3 py-2 text-left font-semibold">Fecha</th>
                            <th className="px-3 py-2 text-left font-semibold">Qué se le hizo</th>
                            <th className="px-3 py-2 text-right font-semibold">Cant.</th>
                            <th className="px-3 py-2 text-right font-semibold">Valor OS</th>
                            <th className="px-3 py-2 text-right font-semibold">Honorarios</th>
                            <th className="px-3 py-2 text-left font-semibold">Atendió</th>
                            <th className="px-3 py-2 text-left font-semibold">Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {g.filas.map((f, i) => {
                            const cambiaPaciente = i === 0 || g.filas[i - 1].pacienteId !== f.pacienteId;
                            return (
                              <tr key={f.id} className={`border-t ${cambiaPaciente ? "border-gray-300" : "border-gray-100"}`}>
                                <td className="px-4 py-1.5 align-top">
                                  {cambiaPaciente && (
                                    <>
                                      <span className="font-medium text-gray-900">{f.paciente}</span>
                                      {(f.dni || f.numeroAfiliado) && (
                                        <span className="block text-[11px] text-gray-400">
                                          {f.dni ? `DNI ${f.dni}` : ""}
                                          {f.dni && f.numeroAfiliado ? " · " : ""}
                                          {f.numeroAfiliado ? `Afil. ${f.numeroAfiliado}` : ""}
                                        </span>
                                      )}
                                    </>
                                  )}
                                </td>
                                <td className="whitespace-nowrap px-3 py-1.5 align-top tabular-nums text-gray-600">
                                  {formatoFecha(f.fecha)}
                                </td>
                                <td className="px-3 py-1.5 align-top text-gray-800">
                                  {f.prestacion}
                                  {f.codigo && <span className="ml-1 text-[11px] text-gray-400">({f.codigo})</span>}
                                </td>
                                <td className="px-3 py-1.5 text-right align-top tabular-nums">{f.cantidad}</td>
                                <td className="whitespace-nowrap px-3 py-1.5 text-right align-top tabular-nums">
                                  {formatoPesos(f.valorOS)}
                                </td>
                                <td className="whitespace-nowrap px-3 py-1.5 text-right align-top tabular-nums">
                                  {f.sinHonorarios ? <span className="text-xs text-gray-400">No se liquida</span> : formatoPesos(honorariosDe(f))}
                                </td>
                                <td className="whitespace-nowrap px-3 py-1.5 align-top text-gray-800">{f.profesional}</td>
                                <td className="px-3 py-1.5 align-top">
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                      ESTILO_ESTADO[f.estado] || "bg-gray-100 text-gray-600"
                                    }`}
                                  >
                                    {f.estado || "—"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}

export default function PacientesPorObraSocialPage() {
  return (
    <SoloDuena>
      <PaginaPacientesPorObraSocial />
    </SoloDuena>
  );
}
