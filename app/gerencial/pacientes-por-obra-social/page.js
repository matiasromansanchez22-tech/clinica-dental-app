"use client";

import { useEffect, useMemo, useState } from "react";
import SoloDuena from "@/components/SoloDuena";
import { fechaDeHoyISO } from "@/lib/agenda";
import { armarResumen, obtenerCobrosParaResumen } from "@/lib/data/pacientesPorObraSocial";

function formatoFecha(fechaISO) {
  if (!fechaISO) return "—";
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
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

function PaginaPacientesPorObraSocial() {
  const hoy = fechaDeHoyISO();
  const [modo, setModo] = useState("mes"); // "mes" | "rango" | "todo"
  const [mes, setMes] = useState(hoy.slice(0, 7));
  const [desde, setDesde] = useState(`${hoy.slice(0, 4)}-01-01`);
  const [hasta, setHasta] = useState(hoy);
  const [profesionalElegido, setProfesionalElegido] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [soloObrasSociales, setSoloObrasSociales] = useState(false);
  const [cobros, setCobros] = useState([]);
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
    obtenerCobrosParaResumen(fechaDesde, fechaHasta)
      .then(setCobros)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [modo, mes, desde, hasta]);

  const resumen = useMemo(() => armarResumen(cobros), [cobros]);

  const resumenFiltrado = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return resumen
      .filter((p) => profesionalElegido === "todos" || p.id === profesionalElegido)
      .map((p) => ({
        ...p,
        obrasSociales: p.obrasSociales
          .filter((g) => !(soloObrasSociales && g.clave === "particular"))
          .map((g) => {
            if (!texto) return g;
            // Si el texto coincide con la obra social se deja entera; si no, se
            // buscan pacientes con ese nombre.
            if (g.nombre.toLowerCase().includes(texto)) return g;
            return { ...g, pacientes: g.pacientes.filter((x) => x.paciente.toLowerCase().includes(texto)) };
          })
          .filter((g) => g.pacientes.length > 0),
      }))
      .filter((p) => p.obrasSociales.length > 0);
  }, [resumen, profesionalElegido, busqueda, soloObrasSociales]);

  const totalPacientes = (p) => p.obrasSociales.reduce((s, g) => s + g.pacientes.length, 0);

  function descargarExcel() {
    const lineas = [["Profesional", "Obra social", "Paciente", "Veces que vino", "Prestaciones", "Última visita"]];
    for (const p of resumenFiltrado) {
      for (const g of p.obrasSociales) {
        for (const x of g.pacientes) {
          lineas.push([p.nombre, g.nombre, x.paciente, x.visitas, x.prestaciones, formatoFecha(x.ultimaFecha)]);
        }
      }
    }
    // Punto y coma + BOM: así Excel en español lo abre directo en columnas y con tildes.
    const contenido = "﻿" + lineas.map((l) => l.map(celdaCSV).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([contenido], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `pacientes-por-obra-social-${hoy}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const profesionalesDisponibles = resumen.map((p) => ({ id: p.id, nombre: p.nombre }));

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">Pacientes por obra social</h1>
      <p className="mt-0.5 text-sm text-gray-500">
        Solo visible para Dueña. Para cada profesional, qué pacientes atendió agrupados por obra social. Sale de los
        cobros de Caja General (quién atendió + la cobertura que se eligió al cobrar). Ortodoncia no aparece porque ahí
        no se registra obra social.
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
          value={profesionalElegido}
          onChange={(e) => setProfesionalElegido(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="todos">Todos los profesionales</option>
          {profesionalesDisponibles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar obra social o paciente..."
          className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        />
        <label className="flex items-center gap-1.5 text-sm text-gray-700">
          <input type="checkbox" checked={soloObrasSociales} onChange={(e) => setSoloObrasSociales(e.target.checked)} />
          Sin Particulares
        </label>
        <button
          onClick={descargarExcel}
          disabled={cargando || resumenFiltrado.length === 0}
          className="ml-auto rounded-md bg-brand-brown px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          ⬇ Descargar para Excel
        </button>
      </div>

      {cargando ? (
        <p className="mt-6 text-sm text-gray-500">Cargando...</p>
      ) : resumenFiltrado.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">No hay pacientes para este filtro.</p>
      ) : (
        <div className="mt-5 flex flex-col gap-4">
          {resumenFiltrado.map((p) => (
            <section key={p.id} className="overflow-hidden rounded-lg border border-gray-200">
              <h2 className="flex items-baseline justify-between bg-brand-brown px-4 py-2 text-white">
                <span className="font-semibold">{p.nombre}</span>
                <span className="text-xs">{totalPacientes(p)} paciente{totalPacientes(p) === 1 ? "" : "s"} (por obra social)</span>
              </h2>
              <div className="divide-y divide-gray-100">
                {p.obrasSociales.map((g) => (
                  <details key={g.clave} className="group">
                    <summary className="flex cursor-pointer items-center justify-between px-4 py-2 text-sm hover:bg-gray-50">
                      <span className="font-medium text-gray-800">{g.nombre}</span>
                      <span className="text-xs text-gray-500">
                        {g.pacientes.length} paciente{g.pacientes.length === 1 ? "" : "s"}
                      </span>
                    </summary>
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-brand-tan/30 text-xs text-brand-brown">
                          <th className="px-4 py-1.5 text-left font-semibold">Paciente</th>
                          <th className="px-3 py-1.5 text-right font-semibold">Veces que vino</th>
                          <th className="px-3 py-1.5 text-right font-semibold">Prestaciones</th>
                          <th className="px-4 py-1.5 text-right font-semibold">Última visita</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.pacientes.map((x) => (
                          <tr key={x.id} className="border-t border-gray-100">
                            <td className="px-4 py-1.5 text-gray-800">{x.paciente}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{x.visitas}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">{x.prestaciones}</td>
                            <td className="px-4 py-1.5 text-right tabular-nums text-gray-600">{formatoFecha(x.ultimaFecha)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
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
