"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import { horaYFechaEnArgentina } from "@/lib/pendientesPorProfesional";
import { calcularRutinaDelDia, ESTADOS, esDomingo, nombreDeMomento, tareasPorMomento } from "@/lib/rutinaEquipo";
import { textoDeFecha } from "@/lib/resumenJornada";
import { destildarTarea, tildarTarea } from "@/lib/data/rutinaEquipo";

// "Mi rutina de hoy": la hoja de tareas de cada persona del equipo, para ir tildando lo que hace durante el día. Cada tilde queda
// guardada con la hora; lo que el sistema puede comprobar por su cuenta (horario marcado, «qué se hizo» cargado, etc.) se marca solo.

const hora = (iso) => new Date(iso).toLocaleTimeString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit" });

function Casillero({ estado, onClick, deshabilitado }) {
  const hecha = ESTADOS[estado].hecha;
  const verificada = estado === "verificada";
  const mala = estado === "mal" || estado === "contradice" || estado === "insuficiente";
  return (
    <button
      onClick={onClick}
      disabled={deshabilitado}
      aria-label={hecha ? "Tarea hecha" : "Marcar como hecha"}
      className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-2 text-base font-bold ${
        verificada ? "border-emerald-700 bg-emerald-700 text-white" : hecha ? "border-brand-green bg-brand-green text-white" : mala ? "border-red-500 bg-red-50 text-red-700" : "border-gray-400 bg-white text-transparent hover:border-brand-green"
      } ${deshabilitado ? "cursor-default" : ""}`}
    >
      {verificada ? "✔" : hecha ? "✓" : mala ? "!" : "✓"}
    </button>
  );
}

function Tarea({ t, fecha, hoy, recargar, setError }) {
  const [pidiendo, setPidiendo] = useState(false);
  const [valor, setValor] = useState("");
  const [guardando, setGuardando] = useState(false);
  const esHoy = fecha === hoy;
  const verificada = t.estado === "verificada";
  const tildable = esHoy && !verificada && !t.tilde;
  const destildable = esHoy && t.tilde && !t.tilde.vistoPor;

  async function tildar(v = null) {
    setGuardando(true);
    setError(null);
    try {
      await tildarTarea({ tareaId: t.id, fecha, valor: v });
      setPidiendo(false);
      setValor("");
      await recargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }
  async function destildar() {
    setGuardando(true);
    setError(null);
    try {
      await destildarTarea(t.tilde.id);
      await recargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  function alApretar() {
    if (guardando) return;
    if (tildable) {
      if (t.pideValor) setPidiendo((p) => !p);
      else tildar();
    } else if (destildable) destildar();
  }

  return (
    <li className="flex gap-3 py-2.5">
      <Casillero estado={t.estado} onClick={alApretar} deshabilitado={guardando || (!tildable && !destildable)} />
      <div className="min-w-0 flex-1">
        <p className={`text-[15px] leading-snug ${ESTADOS[t.estado].hecha ? "text-gray-500" : "text-gray-900"}`}>{t.texto}</p>
        {t.sistema?.detalle && (
          <p className={`mt-0.5 text-xs ${t.sistema.estado === "ok" ? "font-medium text-emerald-700" : t.sistema.estado === "mal" ? "font-medium text-red-700" : "text-gray-500"}`}>
            {t.sistema.estado === "ok" ? "✔ Comprobado: " : t.sistema.estado === "mal" ? "⚠ El sistema ve que no: " : "Sistema: "}
            {t.sistema.detalle}
          </p>
        )}
        {t.tilde && (
          <p className="mt-0.5 text-xs text-gray-500">
            Tildada a las {hora(t.tilde.hechoEn)}
            {t.tilde.valor ? ` · ${t.tilde.valor}${t.umbral !== null ? "%" : ""}` : ""}
            {t.tilde.vistoPor ? " · 👁 vista por la dirección" : ""}
          </p>
        )}
        {t.estado === "insuficiente" && <p className="mt-0.5 text-xs font-semibold text-red-700">Lo que pusiste no llega al mínimo ({t.umbral}). Destildá y corregí cuando lo logres.</p>}
        {t.estado === "contradice" && <p className="mt-0.5 text-xs font-semibold text-red-700">La dirección lo va a ver: tildaste algo que el sistema no confirma.</p>}
        {pidiendo && (
          <form
            className="mt-2 flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (valor.trim()) tildar(valor);
            }}
          >
            <label className="text-xs text-gray-700">{t.pideValor}</label>
            <input type="number" min="0" max="100" inputMode="numeric" autoFocus value={valor} onChange={(e) => setValor(e.target.value)} className="w-20 rounded-md border border-gray-300 px-2 py-1 text-sm" />
            <button type="submit" disabled={!valor.trim() || guardando} className="rounded-md bg-brand-green px-3 py-1 text-sm font-semibold text-white disabled:opacity-50">
              Confirmar
            </button>
          </form>
        )}
      </div>
    </li>
  );
}

function RutinaContenido() {
  const { user } = useAuth();
  const userId = user?.id;
  const { hoy } = useMemo(() => horaYFechaEnArgentina(), []);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);

  const recargar = useCallback(async () => {
    try {
      const ahora = horaYFechaEnArgentina();
      const r = await calcularRutinaDelDia(supabase, { fecha: ahora.hoy, hoy: ahora.hoy, ahora: ahora.ahora, usuarioId: userId });
      setDatos(r);
    } catch (e) {
      setError(e.message);
    }
  }, [userId]);

  useEffect(() => {
    if (!user) return;
    recargar();
    const alVolver = () => document.visibilityState === "visible" && recargar();
    document.addEventListener("visibilitychange", alVolver);
    return () => document.removeEventListener("visibilitychange", alVolver);
  }, [user, recargar]);

  if (error && !datos) return <main className="mx-auto max-w-2xl p-6"><div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div></main>;
  if (!datos) return <main className="mx-auto max-w-2xl p-6 text-sm text-gray-500">Cargando tu rutina…</main>;

  const mia = datos.personas[0];
  if (!mia) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="font-heading text-2xl font-extrabold text-brand-brown">✅ Mi rutina de hoy</h1>
        <p className="mt-3 rounded-md border border-brand-tan bg-white px-4 py-3 text-sm text-gray-700">Todavía no tenés una rutina asignada. Pedile a la dirección que te la asigne.</p>
      </main>
    );
  }
  if (esDomingo(hoy)) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="font-heading text-2xl font-extrabold text-brand-brown">✅ Mi rutina de hoy</h1>
        <p className="mt-3 rounded-md border border-brand-tan bg-white px-4 py-3 text-sm text-gray-700">Hoy es domingo: no hay rutina. ¡Que descanses!</p>
      </main>
    );
  }

  const grupos = tareasPorMomento(mia.tareas);
  const completa = mia.hechas === mia.total;
  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-brown/70">{mia.hoja.nombre}</p>
      <h1 className="font-heading text-3xl font-extrabold text-brand-brown">✅ Mi rutina de hoy</h1>
      <p className="mt-1 text-sm text-gray-600">
        {textoDeFecha(hoy)} · {mia.nombre}. Tildá cada tarea cuando esté <strong>hecha de verdad</strong>: queda guardada con la hora y la dirección la ve. Lo que el sistema puede comprobar solo, se marca solo.
      </p>

      <div className="mt-4 rounded-xl border border-brand-tan/70 bg-white p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-semibold text-gray-700">
            {mia.hechas} de {mia.total} tareas
          </p>
          <p className={`font-heading text-2xl font-extrabold ${completa ? "text-emerald-700" : "text-brand-brown"}`}>{mia.porcentaje}%</p>
        </div>
        <div className="mt-2 h-3 overflow-hidden rounded-full bg-gray-200">
          <div className={`h-full rounded-full transition-all ${completa ? "bg-emerald-600" : "bg-brand-green"}`} style={{ width: `${mia.porcentaje}%` }} />
        </div>
        {completa && <p className="mt-2 text-sm font-semibold text-emerald-700">🎉 ¡Rutina completa! Gracias por hacerlo bien.</p>}
      </div>

      {error && <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      <div className="mt-4 flex flex-col gap-4">
        {grupos.map((g) => (
          <section key={g.momento} className="rounded-xl border border-brand-tan/70 bg-white">
            <h2 className="rounded-t-xl bg-brand-tan/60 px-4 py-2 text-xs font-extrabold uppercase tracking-wide text-brand-brown">{nombreDeMomento(g.momento)}</h2>
            <ul className="divide-y divide-gray-100 px-4">
              {g.tareas.map((t) => (
                <Tarea key={t.id} t={t} fecha={datos.fecha} hoy={hoy} recargar={recargar} setError={setError} />
              ))}
            </ul>
          </section>
        ))}
      </div>
      <button onClick={recargar} className="mt-4 text-sm text-gray-500 hover:underline">
        Actualizar
      </button>
    </main>
  );
}

export default function RutinaEquipoPage() {
  const { user, cargando } = useAuth();
  if (cargando || !user) return null;
  return <RutinaContenido />;
}
