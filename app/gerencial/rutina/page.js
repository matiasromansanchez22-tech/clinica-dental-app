"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import SoloDuena from "@/components/SoloDuena";
import { useAuth } from "@/lib/auth/AuthProvider";
import { DIAS, MES, REGLAS, TURNOS, tareasDe } from "@/lib/rutinaSemanal";
import { guardarRegistroDeRutina, obtenerRegistroDeRutina, obtenerRegistrosDeRutina } from "@/lib/data/rutina";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS_LARGO = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

// Colores de cada bloque de la jornada (de la paleta de la marca).
const ESTILO_FASE = {
  arranque: "border-brand-green bg-[#dff4ec] text-[#1f4237]",
  foco: "border-brand-brown bg-[#f5e6d0] text-[#5a3015]",
  medio: "border-[#a8682f] bg-brand-tan text-[#43250f]",
  equipo: "border-[#5f7f72] bg-[#e6ece8] text-[#2b3d36]",
  cierre: "border-brand-mint bg-brand-charcoal text-brand-cream",
};

const hhmm = (min) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const sinSuscripcion = () => () => {};
function useMontado() {
  return useSyncExternalStore(sinSuscripcion, () => true, () => false);
}

function rangoDe(turno, fase) {
  const inicio = TURNOS[turno].inicio;
  return `${hhmm(inicio + fase.desde)} a ${hhmm(inicio + fase.desde + fase.min)}`;
}

function PrioridadesYNotas({ edicion, setEdicion, guardar, bloque }) {
  if (bloque === "arranque") {
    return (
      <div className="mt-2 rounded-md bg-white/60 p-2.5">
        <p className="text-xs font-bold uppercase tracking-wide opacity-80">Mis 3 prioridades de hoy</p>
        <div className="mt-1.5 grid gap-1.5">
          {[0, 1, 2].map((i) => (
            <input
              key={i}
              value={edicion.prioridades[i] || ""}
              onChange={(e) => setEdicion((ed) => ({ ...ed, prioridades: ed.prioridades.map((p, j) => (j === i ? e.target.value : p)) }))}
              onBlur={(e) => guardar({ prioridades: edicion.prioridades.map((p, j) => (j === i ? e.target.value : p)) })}
              placeholder={`Prioridad ${i + 1}`}
              className="w-full rounded-md border border-brand-green/30 bg-white px-2.5 py-1.5 text-sm text-gray-900"
            />
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="mt-2 rounded-md bg-white/10 p-2.5">
      <p className="text-xs font-bold uppercase tracking-wide opacity-80">Pendientes del cierre</p>
      <textarea
        value={edicion.notas}
        onChange={(e) => setEdicion((ed) => ({ ...ed, notas: e.target.value }))}
        onBlur={(e) => guardar({ notas: e.target.value })}
        rows={3}
        placeholder="Qué quedó pendiente, con fecha. Las 3 prioridades de mañana."
        className="mt-1.5 w-full rounded-md border border-white/20 bg-white px-2.5 py-1.5 text-sm text-gray-900"
      />
    </div>
  );
}

function PestanaHoy({ hoyIdx, ahora }) {
  const { perfil } = useAuth();
  const [diaVer, setDiaVer] = useState(hoyIdx <= 4 ? hoyIdx : 0);
  const fecha = useMemo(() => {
    const d = new Date(ahora);
    d.setDate(ahora.getDate() - hoyIdx + diaVer);
    return d;
  }, [ahora, hoyIdx, diaVer]);
  const fechaISO = iso(fecha);
  const dia = DIAS[diaVer];

  const [registro, setRegistro] = useState({ fecha: null, fila: null, error: null });
  const [edicion, setEdicion] = useState({ prioridades: ["", "", ""], notas: "" });
  const [estadoGuardado, setEstadoGuardado] = useState("");

  useEffect(() => {
    let activo = true;
    obtenerRegistroDeRutina(fechaISO)
      .then((fila) => {
        if (!activo) return;
        setRegistro({ fecha: fechaISO, fila, error: null });
        const p = fila?.prioridades || [];
        setEdicion({ prioridades: [p[0] || "", p[1] || "", p[2] || ""], notas: fila?.notas || "" });
      })
      .catch((e) => activo && setRegistro({ fecha: fechaISO, fila: null, error: e.message }));
    return () => {
      activo = false;
    };
  }, [fechaISO]);

  const cargando = registro.fecha !== fechaISO;
  const fila = cargando ? null : registro.fila;
  const turno = fila?.turno || dia.turno;
  const hechos = fila?.hechos || {};
  const fases = TURNOS[turno].fases;

  let total = 0;
  let hechas = 0;
  for (const fase of fases) {
    tareasDe(fase.id, dia, turno).forEach((_, i) => {
      total += 1;
      if (hechos[`${fase.id}-${i}`]) hechas += 1;
    });
  }
  const porcentaje = total ? Math.round((hechas / total) * 100) : 0;

  async function guardar(cambios) {
    if (!perfil?.id) return;
    setEstadoGuardado("Guardando...");
    try {
      const guardada = await guardarRegistroDeRutina(perfil.id, fechaISO, cambios);
      setRegistro((r) => (r.fecha === fechaISO ? { ...r, fila: guardada, error: null } : r));
      setEstadoGuardado("Guardado ✓");
    } catch (e) {
      setEstadoGuardado("");
      setRegistro((r) => ({ ...r, error: e.message }));
    }
  }

  function alternar(clave) {
    const nuevos = { ...hechos, [clave]: !hechos[clave] };
    setRegistro((r) => ({ ...r, fila: { ...(r.fila || {}), hechos: nuevos } }));
    guardar({ hechos: nuevos });
  }

  return (
    <section className="mt-5">
      {hoyIdx > 4 && (
        <p className="mb-3 text-sm text-gray-600">Hoy es {DIAS_LARGO[ahora.getDay()]}: día libre. Abajo se ve cómo arranca la semana.</p>
      )}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {DIAS.map((d, i) => (
          <button
            key={d.corto}
            onClick={() => setDiaVer(i)}
            className={`rounded-full border px-3.5 py-1 text-sm font-medium ${
              i === diaVer ? "border-brand-brown bg-brand-brown text-white" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
          >
            {d.corto}
            {i === hoyIdx && <span className="ml-1 text-[11px] font-normal opacity-80">hoy</span>}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="font-heading text-xl font-bold text-brand-brown">
          {dia.largo}: {dia.tema}
        </h2>
        <span className="text-sm text-gray-500">
          {fecha.getDate()} de {MESES[fecha.getMonth()]}
        </span>
      </div>
      <p className="mt-1 text-sm text-gray-600">{dia.lema}</p>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <span className="text-gray-600">Hoy vengo a la</span>
        <div className="flex overflow-hidden rounded-md border border-gray-300">
          {["manana", "tarde"].map((t) => (
            <button
              key={t}
              disabled={cargando}
              onClick={() => turno !== t && guardar({ turno: t }).then(() => undefined)}
              className={`px-3 py-1 ${turno === t ? "bg-brand-brown text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
            >
              {TURNOS[t].nombre} ({hhmm(TURNOS[t].inicio)})
            </button>
          ))}
        </div>
        {dia.gym && turno === "tarde" && (
          <span className="text-xs text-gray-500">Antes: gym de 8:30 a 10:00, ducha y comer algo, y salir para llegar a las 14:00.</span>
        )}
        <span className="ml-auto text-xs text-gray-500" aria-live="polite">
          {estadoGuardado}
        </span>
      </div>

      {registro.error && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          No se pudo guardar o leer el registro: {registro.error}
        </div>
      )}

      <div className="my-4 flex items-center gap-3 text-sm text-gray-600" aria-live="polite">
        <div className="h-2 max-w-xs flex-1 overflow-hidden rounded-full bg-gray-200">
          <div className="h-full rounded-full bg-brand-green transition-all" style={{ width: `${porcentaje}%` }} />
        </div>
        <span>
          {hechas} de {total} tareas hechas
        </span>
      </div>

      <div className="space-y-3">
        {fases.map((fase) => {
          const tareas = tareasDe(fase.id, dia, turno);
          const colchon = fase.min - tareas.reduce((a, t) => a + t.min, 0);
          return (
            <div key={fase.id} className={`rounded-lg border-l-[6px] px-4 py-3 ${ESTILO_FASE[fase.id]}`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-heading text-base font-bold">
                  {fase.nombre} <span className="text-sm font-medium opacity-80">{fase.sub}</span>
                </h3>
                <span className="text-sm font-bold tabular-nums">{rangoDe(turno, fase)}</span>
              </div>
              {fase.id === "arranque" && <PrioridadesYNotas edicion={edicion} setEdicion={setEdicion} guardar={guardar} bloque="arranque" />}
              <ul className="mt-2 grid gap-0.5">
                {tareas.map((t, i) => {
                  const clave = `${fase.id}-${i}`;
                  const hecha = Boolean(hechos[clave]);
                  return (
                    <li key={clave}>
                      <label className="grid cursor-pointer grid-cols-[22px_minmax(0,1fr)_auto] items-start gap-x-2.5 rounded-md px-1 py-1.5 hover:bg-black/10">
                        <input type="checkbox" checked={hecha} disabled={cargando} onChange={() => alternar(clave)} className="mt-1 h-4 w-4 cursor-pointer accent-brand-green" />
                        <span className="min-w-0">
                          <span className={`block text-sm ${hecha ? "line-through opacity-55" : ""}`}>{t.t}</span>
                          <span className="block text-xs opacity-75">{t.donde}</span>
                        </span>
                        <span className="whitespace-nowrap pt-0.5 text-xs tabular-nums opacity-80">{t.min} min</span>
                      </label>
                    </li>
                  );
                })}
                {colchon >= 10 && <li className="pl-9 pt-1 text-xs italic opacity-75">Margen para imprevistos y lo que se arrastra: {colchon} min</li>}
              </ul>
              {fase.id === "cierre" && <PrioridadesYNotas edicion={edicion} setEdicion={setEdicion} guardar={guardar} bloque="cierre" />}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PestanaSemana({ hoyIdx }) {
  return (
    <section className="mt-5">
      <p className="mb-3 max-w-2xl text-sm text-gray-600">
        La semana con los turnos habituales: lunes, miércoles y jueves a la tarde; martes y viernes a la mañana. El miércoles se puede pasar a la mañana
        desde «Hoy».
      </p>
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
        {DIAS.map((d, i) => (
          <article key={d.corto} className={`min-w-0 rounded-xl border p-2.5 ${i === hoyIdx ? "border-brand-brown bg-amber-50" : "border-gray-200 bg-white"}`}>
            <h3 className="font-heading px-1 text-base font-bold text-gray-900">{d.largo}</h3>
            <p className="px-1 pb-1 text-xs text-gray-500">
              {d.tema} · {TURNOS[d.turno].nombre.toLowerCase()}
            </p>
            {d.gym && (
              <div className="mt-1.5 rounded-md border border-dashed border-gray-300 px-2.5 py-1.5 text-[13px] leading-snug text-gray-500">
                <div className="text-xs font-bold tabular-nums">8:30 a 10:00</div>
                <div className="font-bold">Gym</div>
              </div>
            )}
            {TURNOS[d.turno].fases.map((fase) => {
              const tareas = tareasDe(fase.id, d, d.turno);
              const resumen = tareas.slice(0, 2).map((t) => t.t.split(":")[0]).join(" · ");
              return (
                <div key={fase.id} className={`mt-1.5 rounded-md border-l-4 px-2.5 py-1.5 text-[13px] leading-snug ${ESTILO_FASE[fase.id]}`}>
                  <div className="text-xs font-bold tabular-nums opacity-85">{rangoDe(d.turno, fase)}</div>
                  <div className="font-bold">{fase.id === "foco" ? d.tema : fase.nombre}</div>
                  {resumen && <div className="text-xs opacity-85">{resumen}</div>}
                </div>
              );
            })}
          </article>
        ))}
      </div>
    </section>
  );
}

// Lunes de la semana de una fecha y offset en semanas.
function lunesDe(ahora, hoyIdx, offsetSemanas) {
  const d = new Date(ahora);
  d.setDate(ahora.getDate() - hoyIdx + offsetSemanas * 7);
  return d;
}

function PestanaResumen({ hoyIdx, ahora }) {
  const [semana, setSemana] = useState(0); // 0 = esta semana, -1 = la anterior
  const lunes = lunesDe(ahora, hoyIdx, semana);
  const viernes = new Date(lunes);
  viernes.setDate(lunes.getDate() + 4);
  const hasta = iso(viernes);
  const desde = iso(new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() - 21)); // 4 semanas, para ver qué se repite
  const clave = `${desde}|${hasta}`;
  const [datos, setDatos] = useState({ clave: null, filas: [], error: null });

  useEffect(() => {
    let activo = true;
    obtenerRegistrosDeRutina(desde, hasta)
      .then((filas) => activo && setDatos({ clave, filas, error: null }))
      .catch((e) => activo && setDatos({ clave, filas: [], error: e.message }));
    return () => {
      activo = false;
    };
  }, [desde, hasta, clave]);

  const cargando = datos.clave !== clave;

  const { porDia, repetidas } = useMemo(() => {
    if (cargando) return { porDia: [], repetidas: [] };
    const filaPorFecha = Object.fromEntries(datos.filas.map((f) => [f.fecha, f]));
    const porDiaCalc = DIAS.map((d, i) => {
      const f = new Date(lunes);
      f.setDate(lunes.getDate() + i);
      const fila = filaPorFecha[iso(f)];
      const turno = fila?.turno || d.turno;
      let total = 0;
      let hechas = 0;
      const porFase = TURNOS[turno].fases.map((fase) => {
        const tareas = tareasDe(fase.id, d, turno);
        const h = tareas.filter((_, k) => fila?.hechos?.[`${fase.id}-${k}`]).length;
        total += tareas.length;
        hechas += h;
        return { id: fase.id, nombre: fase.nombre, total: tareas.length, hechas: h };
      });
      return { dia: d, fecha: f, fila, turno, total, hechas, porFase };
    });

    // Tareas que se dejan sin hacer día tras día (de las últimas 4 semanas, sobre los días con registro).
    const cuenta = {};
    for (const fila of datos.filas) {
      const idx = (new Date(`${fila.fecha}T12:00:00`).getDay() + 6) % 7;
      if (idx > 4) continue;
      const d = DIAS[idx];
      const turno = fila.turno || d.turno;
      for (const fase of TURNOS[turno].fases) {
        tareasDe(fase.id, d, turno).forEach((t, k) => {
          const c = (cuenta[`${idx}|${t.t}`] ||= { dia: d.largo, fase: fase.nombre, t: t.t, dias: 0, sinHacer: 0 });
          c.dias += 1;
          if (!fila.hechos?.[`${fase.id}-${k}`]) c.sinHacer += 1;
        });
      }
    }
    const repetidasCalc = Object.values(cuenta)
      .filter((c) => c.sinHacer >= 2 && c.sinHacer / c.dias >= 0.5)
      .sort((a, b) => b.sinHacer - a.sinHacer)
      .slice(0, 8);
    return { porDia: porDiaCalc, repetidas: repetidasCalc };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos, cargando]);

  const totalSemana = porDia.filter((d) => d.fila).reduce((a, d) => a + d.total, 0); // solo los días con registro
  const hechasSemana = porDia.reduce((a, d) => a + d.hechas, 0);
  const diasConRegistro = porDia.filter((d) => d.fila).length;

  return (
    <section className="mt-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded-md border border-gray-300 text-sm">
          {[
            [0, "Esta semana"],
            [-1, "La anterior"],
            [-2, "Hace dos"],
          ].map(([v, texto]) => (
            <button key={v} onClick={() => setSemana(v)} className={`px-3 py-1.5 ${semana === v ? "bg-brand-brown text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}>
              {texto}
            </button>
          ))}
        </div>
        <span className="text-sm text-gray-500">
          {lunes.getDate()} al {viernes.getDate()} de {MESES[viernes.getMonth()]}
        </span>
      </div>

      {datos.error && <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{datos.error}</div>}
      {cargando ? (
        <p className="mt-4 text-sm text-gray-500">Cargando...</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Tareas hechas</p>
              <p className="text-lg font-bold tabular-nums text-gray-900">
                {hechasSemana} de {totalSemana}
              </p>
              <p className="text-[11px] text-gray-500">{totalSemana ? Math.round((hechasSemana / totalSemana) * 100) : 0}% de la semana</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Días con registro</p>
              <p className="text-lg font-bold tabular-nums text-gray-900">{diasConRegistro} de 5</p>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="bg-brand-brown text-white">
                  <th className="px-3 py-2 text-left font-semibold">Día</th>
                  <th className="px-3 py-2 text-left font-semibold">Turno</th>
                  <th className="px-3 py-2 text-left font-semibold">Avance</th>
                  <th className="px-3 py-2 text-left font-semibold">Prioridades y pendientes</th>
                </tr>
              </thead>
              <tbody>
                {porDia.map((d) => (
                  <tr key={d.dia.corto} className="border-t border-gray-100 align-top">
                    <td className="whitespace-nowrap px-3 py-2 font-medium text-gray-900">
                      {d.dia.largo}
                      <span className="block text-xs font-normal text-gray-500">{d.dia.tema}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">{d.fila ? TURNOS[d.turno].nombre : "—"}</td>
                    <td className="px-3 py-2">
                      {d.fila ? (
                        <>
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-28 overflow-hidden rounded-full bg-gray-200">
                              <div className="h-full rounded-full bg-brand-green" style={{ width: `${d.total ? Math.round((d.hechas / d.total) * 100) : 0}%` }} />
                            </div>
                            <span className="text-xs tabular-nums text-gray-600">
                              {d.hechas}/{d.total}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-gray-500">{d.porFase.map((f) => `${f.nombre} ${f.hechas}/${f.total}`).join(" · ")}</p>
                        </>
                      ) : (
                        <span className="text-xs text-gray-400">Sin registro</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700">
                      {(d.fila?.prioridades || []).filter(Boolean).map((p, i) => (
                        <p key={i}>
                          {i + 1}. {p}
                        </p>
                      ))}
                      {d.fila?.notas && <p className="mt-1 whitespace-pre-line text-gray-500">{d.fila.notas}</p>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5">
            <h3 className="font-heading text-base font-bold text-brand-brown">Lo que se repite sin hacerse</h3>
            <p className="text-xs text-gray-500">De las últimas 4 semanas, las tareas que quedaron sin tildar en la mitad o más de los días con registro (mínimo 2 veces).</p>
            {repetidas.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">Todavía no hay tareas que se repitan sin hacerse.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {repetidas.map((c) => (
                  <li key={`${c.dia}-${c.t}`} className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm text-amber-900">
                    {c.t}
                    <span className="block text-xs opacity-80">
                      {c.dia} · {c.fase} · sin hacer {c.sinHacer} de {c.dias} veces
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function PestanaMes() {
  return (
    <section className="mt-5">
      <p className="mb-3 max-w-2xl text-sm text-gray-600">Tareas que se repiten una vez por mes. Se suman a la rutina del día en que caen.</p>
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {MES.map((m) => (
          <article key={m.titulo} className="min-w-0 rounded-xl border border-gray-200 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-brand-brown">{m.cuando}</p>
            <h3 className="font-heading text-base font-bold text-gray-900">{m.titulo}</h3>
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-gray-700">
              {m.items.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-gray-500">{m.donde}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function PestanaReglas() {
  return (
    <section className="mt-5 grid max-w-2xl gap-2.5">
      {REGLAS.map((r) => (
        <div key={r.t} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
          <h3 className="font-heading text-base font-bold text-gray-900">{r.t}</h3>
          <p className="mt-0.5 text-sm text-gray-600">{r.d}</p>
        </div>
      ))}
    </section>
  );
}

function RutinaContenido() {
  const montado = useMontado();
  const [ahora] = useState(() => new Date());
  const hoyIdx = (ahora.getDay() + 6) % 7; // 0 = lunes
  const [pestana, setPestana] = useState("hoy");

  if (!montado) return null;

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">🗓 Mi rutina semanal</h1>
      <p className="mt-0.5 text-sm text-gray-500">
        Lunes, miércoles y jueves a la tarde; martes y viernes a la mañana. Lo que tildás y escribís queda registrado.
      </p>

      <div className="mt-4 flex flex-wrap overflow-hidden rounded-md border border-gray-300 text-sm sm:inline-flex">
        {[
          ["hoy", "Hoy"],
          ["semana", "La semana"],
          ["resumen", "Resumen semanal"],
          ["mes", "El mes"],
          ["reglas", "Reglas"],
        ].map(([clave, texto]) => (
          <button key={clave} onClick={() => setPestana(clave)} className={`px-4 py-1.5 ${pestana === clave ? "bg-brand-brown text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}>
            {texto}
          </button>
        ))}
      </div>

      {pestana === "hoy" && <PestanaHoy hoyIdx={hoyIdx} ahora={ahora} />}
      {pestana === "semana" && <PestanaSemana hoyIdx={hoyIdx} />}
      {pestana === "resumen" && <PestanaResumen hoyIdx={hoyIdx} ahora={ahora} />}
      {pestana === "mes" && <PestanaMes />}
      {pestana === "reglas" && <PestanaReglas />}
    </main>
  );
}

export default function RutinaPage() {
  return (
    <SoloDuena>
      <RutinaContenido />
    </SoloDuena>
  );
}
