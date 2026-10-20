"use client";

import { useEffect, useMemo, useState } from "react";
import { RESULTADOS_RETOMAR, obtenerRegistroRetomar } from "@/lib/data/registroRetomar";

function formatoFecha(fechaISO) {
  if (!fechaISO) return "—";
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}

function celdaCSV(valor) {
  const texto = String(valor ?? "");
  return /[;"\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

const ESTILO_RESULTADO = {
  [RESULTADOS_RETOMAR.VINO]: "bg-emerald-100 text-emerald-800",
  [RESULTADOS_RETOMAR.TURNO_DADO]: "bg-emerald-100 text-emerald-800",
  [RESULTADOS_RETOMAR.YA_TENIA]: "bg-sky-100 text-sky-800",
  [RESULTADOS_RETOMAR.SIN_TURNO]: "bg-red-100 text-red-800",
  [RESULTADOS_RETOMAR.CERRADO]: "bg-gray-100 text-gray-600",
};

function Tarjeta({ titulo, valor, detalle, activa, onClick, color }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-4 py-3 text-left transition ${activa ? "border-brand-brown bg-brand-tan/30" : "border-gray-200 bg-white hover:bg-gray-50"}`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{titulo}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${color || "text-gray-900"}`}>{valor}</p>
      {detalle && <p className="mt-0.5 text-xs text-gray-500">{detalle}</p>}
    </button>
  );
}

// Registro de los pacientes a los que se les escribió desde Retomar y qué pasó con cada uno.
export default function RegistroRetomar() {
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [resultado, setResultado] = useState("todos");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    obtenerRegistroRetomar()
      .then(setDatos)
      .finally(() => setCargando(false));
  }, []);

  const visibles = useMemo(() => {
    if (!datos) return [];
    const q = busqueda.trim().toLowerCase();
    return datos.filas.filter((f) => (resultado === "todos" || f.resultado === resultado) && (!q || f.nombre.toLowerCase().includes(q)));
  }, [datos, resultado, busqueda]);

  function exportar() {
    const filas = [
      ["Paciente", "Ortodoncista", "Contactado el", "Estado del seguimiento", "Resultado", "Turno", "Hora", "Turno cargado el", "Nota"],
      ...visibles.map((f) => [f.nombre, f.ortodoncista, formatoFecha(f.contactadoEl), f.estado, f.resultado, formatoFecha(f.turnoFecha), f.turnoHora || "", formatoFecha(f.turnoCargadoEl), f.nota || ""]),
    ];
    const url = URL.createObjectURL(new Blob(["﻿" + filas.map((l) => l.map(celdaCSV).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "registro-retomar-tratamiento.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (cargando) return <p className="mt-6 text-sm text-gray-500">Calculando...</p>;
  if (!datos?.disponible) {
    return <p className="mt-6 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">Falta activar el seguimiento (migración 158).</p>;
  }
  const r = datos.resumen;
  const alternar = (x) => setResultado(resultado === x ? "todos" : x);

  return (
    <>
      <p className="mt-3 text-sm text-gray-600">
        De todos los pacientes a los que se les escribió desde esta pantalla, cuántos <strong>ya tienen turno</strong> (cargado después del mensaje) o
        <strong> ya vinieron</strong>. Se actualiza solo con lo que carga la secretaria en la agenda.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Tarjeta titulo="Contactados" valor={r.contactados} detalle="Se les escribió o se habló con ellos" />
        <Tarjeta
          titulo="Volvieron"
          valor={r.volvieron}
          color="text-emerald-700"
          detalle={r.porcentaje !== null ? `${r.porcentaje}% de los contactados (turno dado + ya vinieron)` : ""}
        />
        <Tarjeta
          titulo="Turno dado"
          valor={r.turnoDado}
          color="text-emerald-700"
          detalle="Cargado después del mensaje"
          activa={resultado === RESULTADOS_RETOMAR.TURNO_DADO}
          onClick={() => alternar(RESULTADOS_RETOMAR.TURNO_DADO)}
        />
        <Tarjeta
          titulo="Ya vinieron"
          valor={r.vino}
          color="text-emerald-700"
          detalle="Vinieron o pagaron después del mensaje"
          activa={resultado === RESULTADOS_RETOMAR.VINO}
          onClick={() => alternar(RESULTADOS_RETOMAR.VINO)}
        />
        <Tarjeta
          titulo="Sin turno todavía"
          valor={r.sinTurno}
          color="text-red-700"
          detalle="Hay que insistirles"
          activa={resultado === RESULTADOS_RETOMAR.SIN_TURNO}
          onClick={() => alternar(RESULTADOS_RETOMAR.SIN_TURNO)}
        />
      </div>
      <p className="mt-2 text-xs text-gray-500">
        Además: {r.yaTenia} ya tenían turno antes del mensaje (no cuentan como logro del mensaje) y {r.cerrados} no siguen (dijeron que no o ya no son pacientes).
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar paciente..." className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        <select value={resultado} onChange={(e) => setResultado(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
          <option value="todos">Todos</option>
          {Object.values(RESULTADOS_RETOMAR).map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </select>
        <button onClick={exportar} className="ml-auto rounded-md border border-brand-brown/40 px-3 py-1.5 text-sm font-medium text-brand-brown hover:bg-brand-tan/30">
          ⬇️ Descargar Excel (CSV)
        </button>
      </div>

      <p className="mt-3 text-sm font-semibold text-gray-700">
        {visibles.length} paciente{visibles.length === 1 ? "" : "s"}
      </p>
      <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="bg-brand-brown text-white">
              <th className="px-3 py-2 text-left font-semibold">Paciente</th>
              <th className="px-3 py-2 text-left font-semibold">Contactado el</th>
              <th className="px-3 py-2 text-left font-semibold">Seguimiento</th>
              <th className="px-3 py-2 text-left font-semibold">Resultado</th>
              <th className="px-3 py-2 text-left font-semibold">Turno</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((f) => (
              <tr key={f.id} className="border-t border-gray-100 align-top">
                <td className="px-3 py-2">
                  <p className="font-medium text-gray-900">{f.nombre}</p>
                  <p className="text-xs text-gray-500">{f.ortodoncista}</p>
                </td>
                <td className="whitespace-nowrap px-3 py-2 tabular-nums text-gray-700">{formatoFecha(f.contactadoEl)}</td>
                <td className="px-3 py-2 text-xs text-gray-700">
                  {f.estado}
                  {f.nota && <p className="text-gray-500">{f.nota}</p>}
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${ESTILO_RESULTADO[f.resultado]}`}>{f.resultado}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 tabular-nums text-gray-700">
                  {f.turnoFecha ? (
                    <>
                      {formatoFecha(f.turnoFecha)} {f.turnoHora}
                      <span className="block text-xs text-gray-500">cargado el {formatoFecha(f.turnoCargadoEl)}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
