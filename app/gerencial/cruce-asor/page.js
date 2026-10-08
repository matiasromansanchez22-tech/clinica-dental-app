"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import SoloDuenaYContador from "@/components/SoloDuenaYContador";
import { fechaDeHoyISO } from "@/lib/agenda";
import { cruzar, obtenerFichasParaCruce, obtenerLineasAsor } from "@/lib/data/cruceAsor";

function formatoFecha(fechaISO) {
  if (!fechaISO) return "—";
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}

function formatoPesos(n) {
  const redondeado = Math.round(n);
  return (redondeado < 0 ? "-$" : "$") + Math.abs(redondeado).toLocaleString("es-AR");
}

function celdaCSV(valor) {
  const texto = String(valor ?? "");
  return /[;"\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

const ESTADOS = {
  coincide: { texto: "✅ Coincide", clase: "bg-emerald-100 text-emerald-800", borde: "border-emerald-300" },
  diferencia: { texto: "⚠ Diferencias", clase: "bg-amber-100 text-amber-800", borde: "border-amber-300" },
  soloAsor: { texto: "❌ Solo en ASOR", clase: "bg-red-100 text-red-800", borde: "border-red-300" },
  soloApp: { texto: "❌ Solo en la app", clase: "bg-violet-100 text-violet-800", borde: "border-violet-300" },
};

const ESTADO_LINEA = {
  coincide: { texto: "Coincide", clase: "text-emerald-700" },
  importeDistinto: { texto: "Importe distinto", clase: "text-amber-700" },
  soloAsor: { texto: "Solo en ASOR", clase: "text-red-700" },
  soloApp: { texto: "Solo en la app", clase: "text-violet-700" },
};

function PaginaCruceAsor() {
  const hoy = fechaDeHoyISO();
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState(hoy);
  const [lineasAsor, setLineasAsor] = useState([]);
  const [fichas, setFichas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [obraSocialElegida, setObraSocialElegida] = useState("todas");
  const [estadoElegido, setEstadoElegido] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [abiertos, setAbiertos] = useState(() => new Set());

  useEffect(() => {
    setCargando(true);
    setError(null);
    Promise.all([obtenerLineasAsor(), obtenerFichasParaCruce(desde || null, hasta || null)])
      .then(([a, f]) => {
        setLineasAsor(a);
        setFichas(f);
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [desde, hasta]);

  const pacientes = useMemo(() => cruzar(lineasAsor, fichas), [lineasAsor, fichas]);

  const obrasSociales = useMemo(
    () => [...new Set(pacientes.map((p) => p.obraSocial))].sort((a, b) => a.localeCompare(b, "es")),
    [pacientes]
  );

  const filtrados = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return pacientes.filter((p) => {
      if (obraSocialElegida !== "todas" && p.obraSocial !== obraSocialElegida) return false;
      if (estadoElegido !== "todos" && p.estado !== estadoElegido) return false;
      if (!texto) return true;
      return p.paciente.toLowerCase().includes(texto) || (p.dni || "").includes(texto);
    });
  }, [pacientes, obraSocialElegida, estadoElegido, busqueda]);

  const resumen = useMemo(() => {
    const r = { coincide: 0, diferencia: 0, soloAsor: 0, soloApp: 0 };
    for (const p of pacientes.filter((x) => obraSocialElegida === "todas" || x.obraSocial === obraSocialElegida)) {
      r[p.estado]++;
    }
    return r;
  }, [pacientes, obraSocialElegida]);

  const grupos = useMemo(() => {
    const mapa = new Map();
    for (const p of filtrados) {
      if (!mapa.has(p.obraSocial)) mapa.set(p.obraSocial, []);
      mapa.get(p.obraSocial).push(p);
    }
    return [...mapa.entries()];
  }, [filtrados]);

  function alternar(clave) {
    setAbiertos((previos) => {
      const nuevos = new Set(previos);
      if (nuevos.has(clave)) nuevos.delete(clave);
      else nuevos.add(clave);
      return nuevos;
    });
  }

  function descargarExcel() {
    const lineas = [
      [
        "Obra social", "Paciente", "DNI", "Estado del paciente", "Estado de la línea", "Código ASOR",
        "Importe ASOR", "Pendiente ASOR", "N° presupuesto ASOR", "Fecha app", "Código app", "Prestación app",
        "Importe app", "Atendió",
      ],
    ];
    for (const p of filtrados) {
      for (const l of p.lineas) {
        lineas.push([
          p.obraSocial, p.paciente, p.dni || "", ESTADOS[p.estado].texto.replace(/^\S+\s/, ""),
          ESTADO_LINEA[l.estado].texto, l.asor?.codigo || "", l.asor ? l.asor.importe : "",
          l.asor ? l.asor.pendiente : "", l.asor?.nroPresupuesto || "", l.app ? formatoFecha(l.app.fecha) : "",
          l.app?.codigo || "", l.app?.prestacion || "", l.app ? l.app.importe : "", l.app?.profesional || "",
        ]);
      }
    }
    const contenido = "﻿" + lineas.map((l) => l.map(celdaCSV).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([contenido], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `cruce-asor-${hoy}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">Cruce con ASOR</h1>
      <p className="mt-0.5 text-sm text-gray-500">
        Compara el detalle que mandó ASOR (el que se cargó en Pagos ASOR → Importar PDF) contra lo que se facturó en la
        app, paciente por paciente. Se busca por DNI, código de prestación e importe. De la app solo se miran las obras
        sociales que vinieron en el archivo de ASOR.
      </p>

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          Prestaciones de la app desde
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
          hasta
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          />
        </div>
        <select
          value={obraSocialElegida}
          onChange={(e) => setObraSocialElegida(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="todas">Todas las obras sociales</option>
          {obrasSociales.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar paciente o DNI..."
          className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        />
      </div>

      {cargando ? (
        <p className="mt-6 text-sm text-gray-500">Cargando...</p>
      ) : lineasAsor.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">
          Todavía no hay detalle de ASOR cargado. Cargalo desde Pagos ASOR → Importar PDF.
        </p>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Object.entries(ESTADOS).map(([clave, e]) => (
              <button
                key={clave}
                onClick={() => setEstadoElegido(estadoElegido === clave ? "todos" : clave)}
                className={`rounded-lg border-2 px-4 py-3 text-left ${e.borde} ${
                  estadoElegido === clave ? "ring-2 ring-brand-brown" : ""
                } bg-white`}
              >
                <span className="block text-xs font-semibold text-gray-600">{e.texto}</span>
                <span className="block text-2xl font-bold tabular-nums text-gray-900">{resumen[clave]}</span>
                <span className="block text-[11px] text-gray-500">paciente{resumen[clave] === 1 ? "" : "s"}</span>
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray-700">
            <span>
              Detalle de ASOR cargado: <strong>{lineasAsor.length}</strong> renglones
            </span>
            <button
              onClick={() => setAbiertos(new Set(filtrados.map((p) => p.clave)))}
              className="text-brand-brown underline"
            >
              Abrir todos
            </button>
            <button onClick={() => setAbiertos(new Set())} className="text-brand-brown underline">
              Cerrar todos
            </button>
            <button
              onClick={descargarExcel}
              className="ml-auto rounded-md bg-brand-brown px-3 py-1.5 font-medium text-white"
            >
              ⬇ Descargar para Excel
            </button>
          </div>

          {grupos.length === 0 ? (
            <p className="mt-6 text-sm text-gray-500">No hay pacientes para este filtro.</p>
          ) : (
            <div className="mt-3 flex flex-col gap-4">
              {grupos.map(([obraSocial, lista]) => (
                <section key={obraSocial} className="overflow-hidden rounded-lg border border-brand-brown/40 shadow-sm">
                  <h2 className="flex flex-wrap items-center justify-between gap-x-6 bg-brand-brown px-4 py-2.5 text-white">
                    <span className="text-lg font-bold">{obraSocial}</span>
                    <span className="text-sm">
                      {lista.length} paciente{lista.length === 1 ? "" : "s"}
                    </span>
                  </h2>
                  <div className="overflow-x-auto bg-white">
                    <table className="w-full min-w-[720px] border-collapse text-sm">
                      <thead>
                        <tr className="bg-brand-tan/30 text-xs text-brand-brown">
                          <th className="w-6 px-2 py-2"></th>
                          <th className="px-3 py-2 text-left font-semibold">Paciente</th>
                          <th className="px-3 py-2 text-left font-semibold">DNI</th>
                          <th className="px-3 py-2 text-right font-semibold">Según ASOR</th>
                          <th className="px-3 py-2 text-right font-semibold">Según la app</th>
                          <th className="px-3 py-2 text-right font-semibold">Diferencia</th>
                          <th className="px-3 py-2 text-left font-semibold">Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lista.map((p) => {
                          const abierto = abiertos.has(p.clave);
                          const dif = p.totalAsor - p.totalApp;
                          return (
                            <Fragment key={p.clave}>
                              <tr
                                onClick={() => alternar(p.clave)}
                                className="cursor-pointer border-t border-gray-100 hover:bg-gray-50"
                              >
                                <td className="px-2 py-2 text-gray-400">{abierto ? "▾" : "▸"}</td>
                                <td className="px-3 py-2 font-medium text-gray-900">{p.paciente}</td>
                                <td className="px-3 py-2 text-gray-600">{p.dni || "—"}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{formatoPesos(p.totalAsor)}</td>
                                <td className="px-3 py-2 text-right tabular-nums">{formatoPesos(p.totalApp)}</td>
                                <td
                                  className={`px-3 py-2 text-right tabular-nums ${
                                    Math.abs(dif) < 1 ? "text-gray-400" : "font-semibold text-red-700"
                                  }`}
                                >
                                  {formatoPesos(dif)}
                                </td>
                                <td className="px-3 py-2">
                                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ESTADOS[p.estado].clase}`}>
                                    {ESTADOS[p.estado].texto}
                                  </span>
                                </td>
                              </tr>
                              {abierto && (
                                <tr className="bg-gray-50">
                                  <td></td>
                                  <td colSpan={6} className="px-3 py-2">
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="text-gray-500">
                                          <th className="py-1 text-left font-semibold">ASOR</th>
                                          <th className="py-1 text-right font-semibold">Importe</th>
                                          <th className="py-1 pl-6 text-left font-semibold">En la app</th>
                                          <th className="py-1 text-right font-semibold">Importe</th>
                                          <th className="py-1 pl-6 text-left font-semibold">Resultado</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {p.lineas.map((l, i) => (
                                          <tr key={i} className="border-t border-gray-200 align-top">
                                            <td className="py-1 text-gray-800">
                                              {l.asor ? (
                                                <>
                                                  [{l.asor.codigo}]
                                                  <span className="block text-[10px] text-gray-400">
                                                    Presup. {l.asor.nroPresupuesto}
                                                  </span>
                                                </>
                                              ) : (
                                                <span className="text-gray-300">—</span>
                                              )}
                                            </td>
                                            <td className="py-1 text-right tabular-nums">
                                              {l.asor ? formatoPesos(l.asor.importe) : ""}
                                            </td>
                                            <td className="py-1 pl-6 text-gray-800">
                                              {l.app ? (
                                                <>
                                                  {l.app.prestacion} {l.app.codigo ? `(${l.app.codigo})` : ""}
                                                  <span className="block text-[10px] text-gray-400">
                                                    {formatoFecha(l.app.fecha)} · {l.app.profesional}
                                                  </span>
                                                </>
                                              ) : (
                                                <span className="text-gray-300">—</span>
                                              )}
                                            </td>
                                            <td className="py-1 text-right tabular-nums">
                                              {l.app ? formatoPesos(l.app.importe) : ""}
                                            </td>
                                            <td className={`py-1 pl-6 font-medium ${ESTADO_LINEA[l.estado].clase}`}>
                                              {ESTADO_LINEA[l.estado].texto}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}

export default function CruceAsorPage() {
  return (
    <SoloDuenaYContador>
      <PaginaCruceAsor />
    </SoloDuenaYContador>
  );
}
