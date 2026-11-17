"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import { horaYFechaEnArgentina } from "@/lib/pendientesPorProfesional";
import { calcularResumenJornada, JORNADAS, jornadaDeAhora, textoDeFecha, textoResumen } from "@/lib/resumenJornada";

// Resumen de fin de jornada (mañana o tarde): cuántos pacientes vinieron y cuántos quedaron sin cargar "qué se hizo" y "qué sigue".
// Solo para las Dueñas: ven a todos los profesionales.

function Tarjeta({ titulo, valor, pie, alerta }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${alerta ? "border-red-300 bg-red-50" : "border-brand-tan/60 bg-white"}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-brown/70">{titulo}</p>
      <p className={`font-heading text-3xl font-extrabold leading-none ${alerta ? "text-red-700" : "text-brand-charcoal"}`}>{valor}</p>
      {pie && <p className="mt-1 text-xs text-gray-500">{pie}</p>}
    </div>
  );
}

function ResumenContenido() {
  const { perfil } = useAuth();
  const { hoy, ahora } = useMemo(() => horaYFechaEnArgentina(), []);
  const [fecha, setFecha] = useState(hoy);
  const [jornada, setJornada] = useState(jornadaDeAhora(ahora));
  const [resumen, setResumen] = useState(null);
  const [error, setError] = useState(null);
  const [copiado, setCopiado] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const ahoraMismo = horaYFechaEnArgentina();
      setResumen(await calcularResumenJornada(supabase, { fecha, jornada, hoy: ahoraMismo.hoy, ahora: ahoraMismo.ahora }));
    } catch (e) {
      setError(e.message);
    }
  }, [fecha, jornada]);

  useEffect(() => {
    setResumen(null);
    cargar();
  }, [cargar]);

  const filas = useMemo(() => {
    if (!resumen) return [];
    return resumen.porProfesional;
  }, [resumen]);

  // Totales de lo que se ve.
  const total = useMemo(() => {
    const t = { agendados: 0, vinieron: 0, sinQueSeHizo: 0, sinQueSigue: 0, pendientes: 0 };
    for (const p of filas) {
      t.agendados += p.agendados;
      t.vinieron += p.vinieron;
      t.sinQueSeHizo += p.sinQueSeHizo;
      t.sinQueSigue += p.sinQueSigue;
      t.pendientes += p.pacientes.length;
    }
    return t;
  }, [filas]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(textoResumen(resumen));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      window.prompt("Copiá este resumen:", textoResumen(resumen));
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-brown/70">Fin de jornada</p>
      <h1 className="font-heading text-3xl font-extrabold text-brand-brown">📋 Resumen de la {JORNADAS[jornada].texto}</h1>
      <p className="mt-1 max-w-3xl text-sm text-gray-600">
        Cuántos pacientes vinieron y cuántos quedaron sin cargar <strong>qué se hizo</strong> y <strong>qué sigue</strong> (la próxima prestación o el próximo turno). Incluye Odontología General y Ortodoncia.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded-lg border border-brand-brown/40 text-sm">
          {Object.values(JORNADAS).map((j) => (
            <button key={j.clave} onClick={() => setJornada(j.clave)} className={`px-4 py-1.5 font-medium ${jornada === j.clave ? "bg-brand-green text-white" : "bg-white text-brand-brown hover:bg-brand-tan/30"}`}>
              {j.clave === "manana" ? "☀️ Mañana" : "🌇 Tarde"}
            </button>
          ))}
        </div>
        <input type="date" value={fecha} max={hoy} onChange={(e) => setFecha(e.target.value || hoy)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        <span className="text-sm text-gray-600">{textoDeFecha(fecha)}</span>
        {resumen && (
          <button onClick={copiar} className="ml-auto rounded-md border border-brand-brown/40 px-3 py-1.5 text-sm font-medium text-brand-brown hover:bg-brand-tan/30">
            {copiado ? "✓ Copiado" : "📋 Copiar resumen"}
          </button>
        )}
        <button onClick={cargar} className="rounded-md px-2 py-1.5 text-sm text-gray-500 hover:underline">
          Actualizar
        </button>
      </div>

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
      {!resumen && !error && <p className="mt-4 text-sm text-gray-500">Calculando…</p>}

      {resumen && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tarjeta titulo="Agendados" valor={total.agendados} pie={resumen.total.porVenir ? `${resumen.total.porVenir} todavía por atender` : undefined} />
            <Tarjeta titulo="Vinieron" valor={total.vinieron} />
            <Tarjeta titulo="Sin cargar qué se hizo" valor={total.sinQueSeHizo} alerta={total.sinQueSeHizo > 0} />
            <Tarjeta titulo="Sin cargar qué sigue" valor={total.sinQueSigue} alerta={total.sinQueSigue > 0} />
          </div>

          {total.pendientes === 0 ? (
            <p className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">✅ Todo cargado: qué se hizo y qué sigue. ¡Gracias!</p>
          ) : (
            <p className="mt-4 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
              ⚠️ {total.pendientes} paciente{total.pendientes === 1 ? "" : "s"} sin cargar. Es obligatorio completarlo: sin eso no se puede cobrar ni liquidar bien.
            </p>
          )}

          <div className="mt-4 flex flex-col gap-3">
            {filas.length === 0 && <p className="text-sm text-gray-500">No hubo turnos en esta jornada.</p>}
            {filas.map((p) => {
              const pendiente = p.pacientes.length;
              return (
                <section key={`${p.area}|${p.profesionalId}`} className={`rounded-xl border bg-white p-4 ${pendiente ? "border-red-300" : "border-emerald-200"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-base font-bold text-gray-900">
                        {p.nombre} <span className={`ml-1 rounded-full px-2 py-0.5 align-middle text-xs font-semibold ${p.area === "Ortodoncia" ? "bg-violet-100 text-violet-900" : "bg-sky-100 text-sky-900"}`}>{p.area}</span>
                      </p>
                      <p className="text-sm text-gray-600">
                        {p.agendados} agendado{p.agendados === 1 ? "" : "s"} · vinieron <strong>{p.vinieron}</strong>
                        {pendiente ? (
                          <>
                            {" "}· sin cargar <strong className="text-red-700">{pendiente}</strong> (qué se hizo {p.sinQueSeHizo} · qué sigue {p.sinQueSigue})
                          </>
                        ) : (
                          <span className="font-semibold text-emerald-700"> · todo cargado ✅</span>
                        )}
                      </p>
                    </div>
                    {pendiente > 0 && (
                      <Link href={p.area === "Ortodoncia" ? "/ortodoncia/agenda" : "/agenda"} className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-800">
                        Ir a la agenda →
                      </Link>
                    )}
                  </div>
                  {pendiente > 0 && (
                    <ul className="mt-2 divide-y divide-gray-100 text-sm">
                      {p.pacientes.map((x, i) => (
                        <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                          <span>
                            <span className="tabular-nums text-gray-500">{x.hora}</span> · <strong>{x.paciente}</strong>
                          </span>
                          <span className="flex gap-1">
                            {x.falta.map((f) => (
                              <span key={f} className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                                falta {f}
                              </span>
                            ))}
                          </span>
                        </li>
                      ))}
                    </ul>
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

export default function ResumenJornadaPage() {
  const { perfil, cargando } = useAuth();
  if (cargando) return null;
  if (perfil?.rol !== "Duena") {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">Acceso restringido — esta sección no está disponible para este usuario.</div>
      </main>
    );
  }
  return <ResumenContenido />;
}
