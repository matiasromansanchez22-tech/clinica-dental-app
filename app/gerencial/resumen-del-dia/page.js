"use client";

import { useEffect, useState } from "react";
import SoloDuena from "@/components/SoloDuena";
import { fechaDeHoyISO, sumarDias } from "@/lib/agenda";
import { obtenerResumenDelDia } from "@/lib/data/resumenDelDia";

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function textoFecha(fecha) {
  const d = new Date(`${fecha}T12:00:00`);
  const t = `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

const ESTILO_SECTOR = {
  ok: "border-emerald-200 bg-white",
  revisar: "border-amber-300 bg-amber-50",
  info: "border-sky-200 bg-white",
};
const ICONO = { ok: "✓", revisar: "⚠", info: "ℹ" };
const COLOR_ICONO = { ok: "text-emerald-600", revisar: "text-amber-600", info: "text-sky-600" };

function Sector({ s }) {
  return (
    <article className={`min-w-0 rounded-xl border p-4 ${ESTILO_SECTOR[s.estado] || ESTILO_SECTOR.ok}`}>
      <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
        <span className={COLOR_ICONO[s.estado]}>{ICONO[s.estado] || ICONO.ok}</span>
        {s.titulo}
      </h2>
      <ul className="mt-2 space-y-1.5 text-sm text-gray-700">
        {s.lineas.map((l, i) => (
          <li key={i} className="leading-snug">
            <span className={l.estado === "revisar" ? "font-semibold text-amber-800" : ""}>
              {l.estado === "revisar" && "⚠ "}
              {l.texto}
            </span>
            {l.detalles?.length > 0 && (
              <ul className="mt-0.5 list-disc pl-5 text-xs text-gray-600">
                {l.detalles.slice(0, 12).map((d, j) => (
                  <li key={j}>{d}</li>
                ))}
                {l.detalles.length > 12 && <li>y {l.detalles.length - 12} más</li>}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </article>
  );
}

function ResumenContenido() {
  const hoy = fechaDeHoyISO();
  const [fecha, setFecha] = useState(hoy);
  const [estado, setEstado] = useState({ fecha: null, resumen: null, error: null });

  useEffect(() => {
    let activo = true;
    obtenerResumenDelDia(fecha)
      .then((resumen) => activo && setEstado({ fecha, resumen, error: null }))
      .catch((e) => activo && setEstado({ fecha, resumen: null, error: e.message }));
    return () => {
      activo = false;
    };
  }, [fecha]);

  const cargando = estado.fecha !== fecha;
  const resumen = cargando ? null : estado.resumen;

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">📋 Resumen del día</h1>
      <p className="mt-0.5 text-sm text-gray-500">
        Lo que pasó en cada sector del día, con un control en cada uno. Se calcula en el momento con lo que hay cargado.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2 print:hidden">
        <button onClick={() => setFecha(sumarDias(fecha, -1))} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50">
          ← Día anterior
        </button>
        <input
          type="date"
          value={fecha}
          onChange={(e) => e.target.value && setFecha(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
        <button
          onClick={() => setFecha(sumarDias(fecha, 1))}
          disabled={fecha >= hoy}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-40"
        >
          Día siguiente →
        </button>
        {fecha !== hoy && (
          <button onClick={() => setFecha(hoy)} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50">
            Hoy
          </button>
        )}
      </div>

      <h2 className="mt-4 font-heading text-lg font-bold text-brand-brown">{textoFecha(fecha)}</h2>

      {estado.error && <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{estado.error}</div>}
      {cargando && <p className="mt-4 text-sm text-gray-500">Calculando el resumen...</p>}

      {resumen && (
        <>
          <div
            className={`mt-3 rounded-lg border px-4 py-3 ${
              resumen.revisar === 0 ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-amber-300 bg-amber-50 text-amber-900"
            }`}
          >
            <p className="text-base font-bold">
              {resumen.revisar === 0
                ? "✓ Todo coincide"
                : `⚠ ${resumen.revisar} ${resumen.revisar === 1 ? "sector para revisar" : "sectores para revisar"}`}
            </p>
            <p className="text-sm">
              Vinieron {resumen.pacientesQueVinieron} {resumen.pacientesQueVinieron === 1 ? "paciente" : "pacientes"} · se cobró $
              {Math.round(resumen.totalCobros).toLocaleString("es-AR")} en las cajas
            </p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {resumen.sectores.map((s) => (
              <Sector key={s.id} s={s} />
            ))}
          </div>

          <p className="mt-4 text-xs text-gray-500">
            Para ver la plata paso a paso, mirá{" "}
            <a href="/gerencial/detalle-del-dia" className="text-blue-600 underline">
              Detalle del día
            </a>
            . El bloque de Laboratorio muestra la situación de hoy, no la del día elegido.
          </p>
        </>
      )}
    </main>
  );
}

export default function ResumenDelDiaPage() {
  return (
    <SoloDuena>
      <ResumenContenido />
    </SoloDuena>
  );
}
