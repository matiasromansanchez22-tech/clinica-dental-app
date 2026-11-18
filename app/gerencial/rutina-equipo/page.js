"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { supabase } from "@/lib/supabaseClient";
import { horaYFechaEnArgentina, sumarDiasISO } from "@/lib/pendientesPorProfesional";
import { calcularRutinaDelDia, esDomingo, nombreDeMomento, tareasPorMomento, VERIFICACIONES } from "@/lib/rutinaEquipo";
import { textoDeFecha } from "@/lib/resumenJornada";
import { asignarHoja, guardarTarea, marcarVisto, marcarVistoTodas, obtenerConfiguracion } from "@/lib/data/rutinaEquipo";

// Control de la rutina del equipo (solo Dueñas): por persona y por día, qué tareas se hicieron, cuáles las comprobó el sistema y cuáles
// solo las declaró la persona (esas se pueden marcar «Visto»). También se configuran las hojas, las tareas y quién tiene cada hoja.

const hora = (iso) => new Date(iso).toLocaleTimeString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit" });

const ESTILO = {
  verificada: { icono: "✔", clase: "bg-emerald-700 text-white", etiqueta: "Comprobada", texto: "text-emerald-800" },
  declarada: { icono: "✓", clase: "bg-brand-green text-white", etiqueta: "Declarada", texto: "text-gray-700" },
  contradice: { icono: "!", clase: "bg-red-600 text-white", etiqueta: "Tildada pero el sistema dice que no", texto: "text-red-800" },
  insuficiente: { icono: "!", clase: "bg-red-600 text-white", etiqueta: "Tildada pero no llega al mínimo", texto: "text-red-800" },
  mal: { icono: "✗", clase: "bg-red-100 text-red-700 border border-red-400", etiqueta: "No cumplida", texto: "text-red-800" },
  pendiente: { icono: "", clase: "bg-white border-2 border-gray-300", etiqueta: "Pendiente", texto: "text-gray-700" },
};

function PersonaControl({ p, recargar, setError }) {
  const [abierta, setAbierta] = useState(!p.libre);
  const comprobadas = p.tareas.filter((t) => t.estado === "verificada").length;
  const declaradas = p.tareas.filter((t) => t.estado === "declarada").length;
  const problemas = p.tareas.filter((t) => ["contradice", "insuficiente", "mal"].includes(t.estado)).length;
  const sinVer = p.tareas.filter((t) => t.tilde && !t.tilde.vistoPor && t.estado !== "verificada");
  const completa = p.hechas === p.total;
  const grupos = tareasPorMomento(p.tareas);

  async function visto(t) {
    setError(null);
    try {
      await marcarVisto(t.tilde.id, !t.tilde.vistoPor);
      await recargar();
    } catch (e) {
      setError(e.message);
    }
  }
  async function vistoTodas() {
    setError(null);
    try {
      await marcarVistoTodas(sinVer.map((t) => t.tilde.id));
      await recargar();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <section className={`rounded-xl border bg-white ${p.libre ? "opacity-60 " : ""}${problemas ? "border-red-300" : completa && p.conActividad ? "border-emerald-300" : "border-brand-tan/70"}`}>
      <button onClick={() => setAbierta((a) => !a)} className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left">
        <div>
          <p className="text-base font-bold text-gray-900">
            {p.nombre} <span className="ml-1 rounded-full bg-brand-tan/60 px-2 py-0.5 align-middle text-xs font-semibold text-brand-brown">{p.hoja.nombre}</span>
          </p>
          <p className="text-xs text-gray-600">
            {p.libre ? (
              <span className="font-semibold text-gray-500">No tiene turnos hoy: no cuenta</span>
            ) : !p.conActividad ? (
              <span className="font-semibold text-amber-700">Sin actividad hoy: no tildó nada ni el sistema lo vio trabajando</span>
            ) : (
              <>
                {p.hechas} de {p.total} · comprobadas <strong>{comprobadas}</strong> · declaradas <strong>{declaradas}</strong>
                {problemas > 0 && <span className="font-semibold text-red-700"> · con problema {problemas}</span>}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden h-2.5 w-28 overflow-hidden rounded-full bg-gray-200 sm:block">
            <div className={`h-full ${completa ? "bg-emerald-600" : "bg-brand-green"}`} style={{ width: `${p.porcentaje}%` }} />
          </div>
          <span className={`font-heading text-xl font-extrabold ${completa && p.conActividad ? "text-emerald-700" : "text-brand-brown"}`}>{p.porcentaje}%</span>
          <span className="text-gray-400">{abierta ? "▲" : "▼"}</span>
        </div>
      </button>

      {abierta && (
        <div className="border-t border-gray-100 px-4 pb-3">
          {sinVer.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <span>{sinVer.length} tarea{sinVer.length === 1 ? "" : "s"} declarada{sinVer.length === 1 ? "" : "s"} sin «Visto»</span>
              <button onClick={vistoTodas} className="rounded-md bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700">
                👁 Marcar todas como vistas
              </button>
            </div>
          )}
          {grupos.map((g) => (
            <div key={g.momento} className="mt-3">
              <p className="text-[11px] font-extrabold uppercase tracking-wide text-brand-brown/80">{nombreDeMomento(g.momento)}</p>
              <ul className="mt-1 divide-y divide-gray-100">
                {g.tareas.map((t) => {
                  const e = ESTILO[t.estado];
                  return (
                    <li key={t.id} className="flex gap-3 py-2">
                      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-sm font-bold ${e.clase}`}>{e.icono}</span>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm ${e.texto}`}>{t.texto}</p>
                        <p className="text-xs text-gray-500">
                          <span className="font-semibold">{e.etiqueta}</span>
                          {t.tilde ? ` · tildó a las ${hora(t.tilde.hechoEn)}` : ""}
                          {t.tilde?.valor ? ` · puso ${t.tilde.valor}${t.umbral !== null ? "%" : ""}` : ""}
                          {t.sistema?.detalle ? ` · Sistema: ${t.sistema.detalle}` : ""}
                        </p>
                      </div>
                      {t.tilde && t.estado !== "verificada" && (
                        <button
                          onClick={() => visto(t)}
                          className={`h-fit shrink-0 rounded-md border px-2 py-1 text-xs font-semibold ${t.tilde.vistoPor ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}
                        >
                          {t.tilde.vistoPor ? `👁 Visto ${t.tilde.vistoEn ? hora(t.tilde.vistoEn) : ""}` : "Marcar visto"}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function Control() {
  const { hoy } = useMemo(() => horaYFechaEnArgentina(), []);
  const [fecha, setFecha] = useState(hoy);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);

  const recargar = useCallback(async () => {
    try {
      const ahora = horaYFechaEnArgentina();
      setDatos(await calcularRutinaDelDia(supabase, { fecha, hoy: ahora.hoy, ahora: ahora.ahora }));
    } catch (e) {
      setError(e.message);
    }
  }, [fecha]);

  useEffect(() => {
    setDatos(null);
    setError(null);
    recargar();
  }, [recargar]);

  const resumen = useMemo(() => {
    if (!datos) return null;
    const ps = datos.personas.filter((p) => !p.libre);
    return {
      personas: ps.length,
      completas: ps.filter((p) => p.conActividad && p.hechas === p.total).length,
      sinActividad: ps.filter((p) => !p.conActividad).length,
      problemas: ps.reduce((n, p) => n + p.tareas.filter((t) => ["contradice", "insuficiente", "mal"].includes(t.estado)).length, 0),
      sinVer: ps.reduce((n, p) => n + p.tareas.filter((t) => t.tilde && !t.tilde.vistoPor && t.estado !== "verificada").length, 0),
    };
  }, [datos]);

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={() => setFecha(sumarDiasISO(fecha, -1))} className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm hover:bg-gray-50">
          ←
        </button>
        <input type="date" value={fecha} max={hoy} onChange={(e) => setFecha(e.target.value || hoy)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        <button disabled={fecha >= hoy} onClick={() => setFecha(sumarDiasISO(fecha, 1))} className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-40">
          →
        </button>
        <span className="text-sm font-semibold text-gray-700">{textoDeFecha(fecha)}</span>
        <button onClick={recargar} className="ml-auto rounded-md px-2 py-1.5 text-sm text-gray-500 hover:underline">
          Actualizar
        </button>
      </div>

      {error && <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
      {!datos && !error && <p className="mt-4 text-sm text-gray-500">Calculando…</p>}

      {datos && esDomingo(fecha) && <p className="mt-4 rounded-md border border-brand-tan bg-white px-4 py-3 text-sm text-gray-700">Los domingos no hay rutina.</p>}

      {datos && !esDomingo(fecha) && resumen && (
        <>
          {datos.personas.length === 0 && <p className="mt-4 text-sm text-gray-600">Todavía no hay nadie con una hoja asignada. Se asigna en la pestaña «Configurar».</p>}
          {datos.personas.length > 0 && (
            <>
              <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  ["Rutinas completas", `${resumen.completas} de ${resumen.personas}`, false],
                  ["Sin actividad", resumen.sinActividad, resumen.sinActividad > 0],
                  ["Tareas con problema", resumen.problemas, resumen.problemas > 0],
                  ["Declaradas sin «Visto»", resumen.sinVer, false],
                ].map(([t, v, alerta]) => (
                  <div key={t} className={`rounded-xl border px-4 py-3 ${alerta ? "border-red-300 bg-red-50" : "border-brand-tan/60 bg-white"}`}>
                    <p className="text-xs font-semibold uppercase tracking-wide text-brand-brown/70">{t}</p>
                    <p className={`font-heading text-3xl font-extrabold leading-none ${alerta ? "text-red-700" : "text-brand-charcoal"}`}>{v}</p>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-gray-500">
                <strong className="text-emerald-800">✔ Comprobada</strong>: la verificó el sistema, no se puede inventar. <strong>✓ Declarada</strong>: la tildó la persona y el sistema no tiene cómo comprobarla: por eso tiene su botón «Visto».
              </p>
              <div className="mt-3 flex flex-col gap-3">
                {datos.personas.map((p) => (
                  <PersonaControl key={p.usuarioId} p={p} recargar={recargar} setError={setError} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

function FormTarea({ hojaId, inicial, onGuardar, onCancelar }) {
  const [f, setF] = useState(
    inicial || { momento: "", texto: "", orden: 99, verificacion: "", pideValor: "", activa: true }
  );
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  return (
    <form
      className="mt-2 grid gap-2 rounded-lg border border-brand-tan bg-brand-cream p-3 text-sm sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (f.texto.trim() && f.momento.trim()) onGuardar({ ...f, hojaId });
      }}
    >
      <label className="flex flex-col gap-1 sm:col-span-2">
        Tarea
        <input value={f.texto} onChange={set("texto")} className="rounded-md border border-gray-300 px-2 py-1" required />
      </label>
      <label className="flex flex-col gap-1">
        Momento del día (con número para ordenar: «1. Al llegar»)
        <input value={f.momento} onChange={set("momento")} className="rounded-md border border-gray-300 px-2 py-1" required />
      </label>
      <label className="flex flex-col gap-1">
        Orden
        <input type="number" value={f.orden} onChange={set("orden")} className="rounded-md border border-gray-300 px-2 py-1" />
      </label>
      <label className="flex flex-col gap-1">
        ¿La comprueba el sistema?
        <select value={f.verificacion || ""} onChange={set("verificacion")} className="rounded-md border border-gray-300 px-2 py-1">
          <option value="">No: la declara la persona</option>
          {Object.entries(VERIFICACIONES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        Pide un número al tildar (pregunta; opcional)
        <input value={f.pideValor || ""} onChange={set("pideValor")} placeholder="Ej: ¿Qué % quedó organizado? (mínimo 60)" className="rounded-md border border-gray-300 px-2 py-1" />
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={f.activa} onChange={set("activa")} /> Activa
      </label>
      <div className="flex justify-end gap-2 sm:col-span-2">
        <button type="button" onClick={onCancelar} className="rounded-md px-3 py-1 text-gray-600 hover:underline">
          Cancelar
        </button>
        <button type="submit" className="rounded-md bg-brand-green px-4 py-1 font-semibold text-white">
          Guardar
        </button>
      </div>
    </form>
  );
}

function Configurar() {
  const [cfg, setCfg] = useState(null);
  const [error, setError] = useState(null);
  const [editando, setEditando] = useState(null); // { hojaId, tarea | null }

  const cargar = useCallback(async () => {
    try {
      setCfg(await obtenerConfiguracion());
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  if (error && !cfg) return <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>;
  if (!cfg) return <p className="mt-4 text-sm text-gray-500">Cargando…</p>;

  const hojaDe = (usuarioId) => cfg.asignaciones.find((a) => a.usuario_id === usuarioId)?.hoja_id || "";

  async function guardar(datos) {
    setError(null);
    try {
      await guardarTarea({ id: editando?.tarea?.id, ...datos });
      setEditando(null);
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-5">
      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      <section className="rounded-xl border border-brand-tan/70 bg-white p-4">
        <h2 className="font-heading text-lg font-bold text-brand-brown">¿Quién tiene cada hoja?</h2>
        <p className="text-xs text-gray-500">Cada persona ve solo su hoja en «Mi rutina de hoy». Sin hoja = no tiene rutina.</p>
        <ul className="mt-2 divide-y divide-gray-100">
          {cfg.perfiles
            .filter((p) => !/^(zz|test)/i.test(p.nombre))
            .map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm">
                <span>
                  <strong>{p.nombre}</strong> <span className="text-xs text-gray-500">({p.rol})</span>
                </span>
                <select
                  value={hojaDe(p.id)}
                  onChange={async (e) => {
                    setError(null);
                    try {
                      await asignarHoja(p.id, e.target.value);
                      await cargar();
                    } catch (er) {
                      setError(er.message);
                    }
                  }}
                  className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                >
                  <option value="">Sin rutina</option>
                  {cfg.hojas.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.nombre}
                    </option>
                  ))}
                </select>
              </li>
            ))}
        </ul>
      </section>

      {cfg.hojas.map((h) => {
        const tareas = cfg.tareas.filter((t) => t.hoja_id === h.id);
        return (
          <section key={h.id} className="rounded-xl border border-brand-tan/70 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-heading text-lg font-bold text-brand-brown">{h.nombre}</h2>
                <p className="text-xs text-gray-500">Se evalúa en el aviso de la {h.corte === "manana" ? "mañana (12:30)" : "tarde (18:30)"}.</p>
              </div>
              <button onClick={() => setEditando({ hojaId: h.id, tarea: null })} className="rounded-md bg-brand-green px-3 py-1.5 text-sm font-semibold text-white">
                + Agregar tarea
              </button>
            </div>
            {editando?.hojaId === h.id && !editando.tarea && <FormTarea hojaId={h.id} onGuardar={guardar} onCancelar={() => setEditando(null)} />}
            <ul className="mt-2 divide-y divide-gray-100">
              {tareas.map((t) => (
                <li key={t.id} className="py-2 text-sm">
                  {editando?.tarea?.id === t.id ? (
                    <FormTarea
                      hojaId={h.id}
                      inicial={{ momento: t.momento, texto: t.texto, orden: t.orden, verificacion: t.verificacion || "", pideValor: t.pide_valor || "", activa: t.activa }}
                      onGuardar={guardar}
                      onCancelar={() => setEditando(null)}
                    />
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className={t.activa ? "" : "opacity-50"}>
                        <p>
                          <span className="text-xs font-semibold text-brand-brown/70">{nombreDeMomento(t.momento)} · </span>
                          {t.texto}
                        </p>
                        <p className="text-xs text-gray-500">
                          {t.verificacion ? `🔎 ${VERIFICACIONES[t.verificacion] || t.verificacion}` : "Declarada por la persona"}
                          {t.pide_valor ? " · pide un número" : ""}
                          {!t.activa ? " · desactivada" : ""}
                        </p>
                      </div>
                      <button onClick={() => setEditando({ hojaId: h.id, tarea: t })} className="shrink-0 text-xs font-semibold text-brand-brown hover:underline">
                        Editar
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function Contenido() {
  const [pestana, setPestana] = useState("control");
  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-brown/70">Gerencial</p>
      <h1 className="font-heading text-3xl font-extrabold text-brand-brown">✅ Rutina del equipo</h1>
      <p className="mt-1 max-w-3xl text-sm text-gray-600">
        Quién hizo qué cada día. Lo que el sistema puede comprobar por su cuenta aparece como <strong>comprobado</strong>; el resto lo declara la persona y vos lo marcás como <strong>visto</strong>.
      </p>
      <div className="mt-3 flex overflow-hidden rounded-lg border border-brand-brown/40 text-sm sm:w-fit">
        {[
          ["control", "Control del día"],
          ["configurar", "Configurar"],
        ].map(([k, t]) => (
          <button key={k} onClick={() => setPestana(k)} className={`px-4 py-1.5 font-medium ${pestana === k ? "bg-brand-green text-white" : "bg-white text-brand-brown hover:bg-brand-tan/30"}`}>
            {t}
          </button>
        ))}
      </div>
      {pestana === "control" ? <Control /> : <Configurar />}
    </main>
  );
}

export default function RutinaEquipoControlPage() {
  const { perfil, cargando } = useAuth();
  if (cargando) return null;
  if (perfil?.rol !== "Duena") {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">Acceso restringido — esta sección no está disponible para este usuario.</div>
      </main>
    );
  }
  return <Contenido />;
}
