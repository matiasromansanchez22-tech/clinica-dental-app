"use client";

import { useEffect, useMemo, useState } from "react";
import SoloDuenaYContador from "@/components/SoloDuenaYContador";
import { fechaDeHoyISO } from "@/lib/agenda";
import { fechaHoraArgentina, obtenerHistorialPagos } from "@/lib/data/historialPagos";

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

function celdaCSV(valor) {
  const texto = String(valor ?? "");
  return /[;"\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

function rangoDelMes(mesISO) {
  const [anio, mes] = mesISO.split("-").map(Number);
  const ultimoDia = new Date(anio, mes, 0).getDate();
  return { desde: `${mesISO}-01`, hasta: `${mesISO}-${String(ultimoDia).padStart(2, "0")}` };
}

const ESTILO_ORIGEN = {
  "Caja del día": "bg-sky-100 text-sky-800",
  Reserva: "bg-amber-100 text-amber-800",
  Producción: "bg-violet-100 text-violet-800",
};

function PaginaHistorialPagos() {
  const hoy = fechaDeHoyISO();
  const [modo, setModo] = useState("mes"); // "mes" | "rango" | "todo"
  const [mes, setMes] = useState(hoy.slice(0, 7));
  const [desde, setDesde] = useState(`${hoy.slice(0, 4)}-01-01`);
  const [hasta, setHasta] = useState(hoy);
  const [profesionalElegido, setProfesionalElegido] = useState("todos");
  const [salioDeElegido, setSalioDeElegido] = useState("todos");
  const [pagos, setPagos] = useState([]);
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
    obtenerHistorialPagos(fechaDesde, fechaHasta)
      .then(setPagos)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [modo, mes, desde, hasta]);

  const profesionales = useMemo(() => {
    const mapa = new Map();
    for (const p of pagos) mapa.set(p.profesionalId, p.profesional);
    return [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1], "es"));
  }, [pagos]);

  const filtrados = useMemo(
    () =>
      pagos.filter(
        (p) =>
          (profesionalElegido === "todos" || p.profesionalId === profesionalElegido) &&
          (salioDeElegido === "todos" || p.salioDe === salioDeElegido)
      ),
    [pagos, profesionalElegido, salioDeElegido]
  );

  // Mes por mes (el más nuevo primero), con el total de cada mes.
  const meses = useMemo(() => {
    const porMes = new Map();
    for (const p of filtrados) {
      const clave = p.fecha.slice(0, 7);
      if (!porMes.has(clave)) porMes.set(clave, []);
      porMes.get(clave).push(p);
    }
    return [...porMes.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([clave, filas]) => ({
        clave,
        filas,
        total: filas.reduce((s, f) => s + f.monto, 0),
        porProfesional: Object.values(
          filas.reduce((acc, f) => {
            acc[f.profesionalId] ??= { nombre: f.profesional, total: 0 };
            acc[f.profesionalId].total += f.monto;
            return acc;
          }, {})
        ).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
      }));
  }, [filtrados]);

  function descargarExcel() {
    const lineas = [
      ["Fecha del pago", "Registrado (fecha y hora)", "Profesional", "Tipo", "Salió de", "Medio de pago", "Monto", "Observaciones"],
    ];
    for (const p of filtrados) {
      lineas.push([
        formatoFecha(p.fecha), fechaHoraArgentina(p.registradoEn), p.profesional, p.tipo, p.salioDe,
        p.medioPago, p.monto, p.observaciones || "",
      ]);
    }
    const contenido = "﻿" + lineas.map((l) => l.map(celdaCSV).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([contenido], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `historial-pagos-${hoy}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">🧾 Historial de pagos a profesionales</h1>
      <p className="mt-0.5 text-sm text-gray-500">
        Todo lo que se le pagó a cada profesional: la fecha del pago, el momento en que se registró en el sistema, el
        monto y de dónde salió la plata (caja del día, reserva del Consultorio o Producción y liquidación).
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
            <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
            a
            <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
          </div>
        )}
        <select
          value={profesionalElegido}
          onChange={(e) => setProfesionalElegido(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="todos">Todos los profesionales</option>
          {profesionales.map(([id, nombre]) => (
            <option key={id} value={id}>
              {nombre}
            </option>
          ))}
        </select>
        <select
          value={salioDeElegido}
          onChange={(e) => setSalioDeElegido(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="todos">Salió de: todo</option>
          <option value="Caja del día">Caja del día</option>
          <option value="Reserva">Reserva del Consultorio</option>
          <option value="Producción">Producción y liquidación</option>
        </select>
        <button
          onClick={descargarExcel}
          disabled={cargando || filtrados.length === 0}
          className="ml-auto rounded-md bg-brand-brown px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          ⬇ Descargar para Excel
        </button>
      </div>

      {cargando ? (
        <p className="mt-6 text-sm text-gray-500">Cargando...</p>
      ) : meses.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">No hay pagos registrados para este filtro.</p>
      ) : (
        meses.map((m) => (
          <section key={m.clave} className="mt-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-brand-brown pb-1">
              <h2 className="text-xl font-bold text-brand-brown">{nombreMes(m.clave)}</h2>
              <p className="text-sm text-gray-700">
                {m.filas.length} pago{m.filas.length === 1 ? "" : "s"} · <strong>Total del mes: {formatoPesos(m.total)}</strong>
              </p>
            </div>
            <p className="mt-1.5 text-xs text-gray-500">
              {m.porProfesional.map((p, i) => (
                <span key={p.nombre}>
                  {i > 0 && " · "}
                  {p.nombre}: <strong>{formatoPesos(p.total)}</strong>
                </span>
              ))}
            </p>
            <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full min-w-[820px] border-collapse text-sm">
                <thead>
                  <tr className="bg-brand-brown text-white">
                    <th className="px-3 py-2 text-left font-semibold">Fecha del pago</th>
                    <th className="px-3 py-2 text-left font-semibold">Registrado</th>
                    <th className="px-3 py-2 text-left font-semibold">Profesional</th>
                    <th className="px-3 py-2 text-left font-semibold">Tipo</th>
                    <th className="px-3 py-2 text-left font-semibold">Salió de</th>
                    <th className="px-3 py-2 text-left font-semibold">Medio</th>
                    <th className="px-3 py-2 text-right font-semibold">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {m.filas.map((p) => (
                    <tr key={p.id} className="border-t border-gray-100 align-top">
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-gray-800">{formatoFecha(p.fecha)}</td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-gray-500">{fechaHoraArgentina(p.registradoEn)}</td>
                      <td className="px-3 py-2 font-medium text-gray-900">
                        {p.profesional}
                        {p.observaciones && <span className="block text-[11px] font-normal text-gray-500">{p.observaciones}</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{p.tipo}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ESTILO_ORIGEN[p.salioDe]}`}>{p.salioDe}</span>
                      </td>
                      <td className="px-3 py-2 text-gray-600">{p.medioPago}</td>
                      <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-900">{formatoPesos(p.monto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      )}
    </main>
  );
}

export default function HistorialPagosPage() {
  return (
    <SoloDuenaYContador>
      <PaginaHistorialPagos />
    </SoloDuenaYContador>
  );
}
