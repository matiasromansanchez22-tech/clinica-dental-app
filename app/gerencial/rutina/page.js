"use client";

import { useState, useSyncExternalStore } from "react";
import SoloDuena from "@/components/SoloDuena";
import { RUTINA } from "@/lib/rutinaSemanal";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const DIAS_LARGO = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

// Colores de cada bloque de la jornada (de la paleta de la marca).
const ESTILO_FASE = {
  arranque: "border-brand-green bg-[#dff4ec] text-[#1f4237]",
  foco: "border-brand-brown bg-[#f5e6d0] text-[#5a3015]",
  medio: "border-[#a8682f] bg-brand-tan text-[#43250f]",
  pausa: "border-dashed border-gray-300 bg-transparent text-gray-500",
  bloque2: "border-[#5f7f72] bg-[#e6ece8] text-[#2b3d36]",
  cierre: "border-brand-mint bg-brand-charcoal text-brand-cream",
};

const FASES = RUTINA.fases;

function hhmm(min) {
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
}

function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function tareasDe(faseId, dia) {
  if (faseId === "foco") return dia.foco;
  if (faseId === "bloque2") return dia.bloque2;
  return RUTINA.comunes[faseId] || [];
}

// Las marcas de "hecho" se guardan en este navegador (una clave por día).
function leerLocal(clave) {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}
function guardarLocal(clave, valor) {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    // sin almacenamiento: la rutina se ve igual, solo que no recuerda lo tildado
  }
}
function leerMarcas(fechaISO) {
  try {
    return JSON.parse(leerLocal(`rutina-hechos-${fechaISO}`) || "{}");
  } catch {
    return {};
  }
}

const sinSuscripcion = () => () => {};
function useMontado() {
  return useSyncExternalStore(sinSuscripcion, () => true, () => false);
}

function RutinaContenido() {
  const montado = useMontado();
  const [ahora] = useState(() => new Date());
  const hoyIdx = (ahora.getDay() + 6) % 7; // 0 = lunes
  const [pestana, setPestana] = useState("hoy");
  const [diaVer, setDiaVer] = useState(hoyIdx <= 4 ? hoyIdx : 0);
  const [inicio, setInicio] = useState(() => Number(leerLocal("rutina-inicio")) || 540);
  const [, setVersion] = useState(0);

  if (!montado) return null;

  const fechaDe = (idx) => {
    const d = new Date(ahora);
    d.setDate(ahora.getDate() - hoyIdx + idx);
    return d;
  };
  const rango = (f) => `${hhmm(inicio + f.desde)} a ${hhmm(inicio + f.desde + f.min)}`;

  const dia = RUTINA.dias[diaVer];
  const fecha = fechaDe(diaVer);
  const marcas = leerMarcas(iso(fecha));
  let total = 0;
  let hechas = 0;
  for (const fase of FASES) {
    tareasDe(fase.id, dia).forEach((_, i) => {
      if (fase.id === "pausa") return;
      total += 1;
      if (marcas[`${fase.id}-${i}`]) hechas += 1;
    });
  }
  const porcentaje = total ? Math.round((hechas / total) * 100) : 0;

  function alternar(clave) {
    const actuales = leerMarcas(iso(fecha));
    actuales[clave] = !actuales[clave];
    guardarLocal(`rutina-hechos-${iso(fecha)}`, JSON.stringify(actuales));
    setVersion((v) => v + 1);
  }

  function cambiarInicio(valor) {
    setInicio(valor);
    guardarLocal("rutina-inicio", String(valor));
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🗓 Mi rutina semanal</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Lunes a viernes: un arranque fijo, un punto medio y un cierre fijo; en el medio, un tema por día.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          Llego a las
          <select
            value={inicio}
            onChange={(e) => cambiarInicio(Number(e.target.value))}
            className="rounded-md border border-gray-300 bg-white px-2 py-1.5"
          >
            <option value={480}>8:00</option>
            <option value={540}>9:00</option>
            <option value={600}>10:00</option>
          </select>
        </label>
      </div>

      <div className="mt-4 flex flex-wrap overflow-hidden rounded-md border border-gray-300 text-sm sm:inline-flex">
        {[
          ["hoy", "Hoy"],
          ["semana", "La semana"],
          ["mes", "El mes"],
          ["reglas", "Reglas"],
        ].map(([clave, texto]) => (
          <button
            key={clave}
            onClick={() => setPestana(clave)}
            className={`px-4 py-1.5 ${pestana === clave ? "bg-brand-brown text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
          >
            {texto}
          </button>
        ))}
      </div>

      {pestana === "hoy" && (
        <section className="mt-5">
          {hoyIdx > 4 && (
            <p className="mb-3 text-sm text-gray-600">Hoy es {DIAS_LARGO[ahora.getDay()]}: día libre. Abajo se ve cómo arranca la semana.</p>
          )}
          <div className="mb-4 flex flex-wrap gap-1.5">
            {RUTINA.dias.map((d, i) => (
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

          <div className="my-4 flex items-center gap-3 text-sm text-gray-600" aria-live="polite">
            <div className="h-2 max-w-xs flex-1 overflow-hidden rounded-full bg-gray-200">
              <div className="h-full rounded-full bg-brand-green transition-all" style={{ width: `${porcentaje}%` }} />
            </div>
            <span>
              {hechas} de {total} tareas hechas
            </span>
          </div>

          <div className="space-y-3">
            {FASES.map((fase) => {
              if (fase.id === "pausa") {
                return (
                  <div key={fase.id} className={`rounded-lg border border-l-[6px] px-4 py-3 ${ESTILO_FASE.pausa}`}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="font-heading text-base font-bold">
                        {fase.nombre} <span className="text-sm font-medium opacity-80">{fase.sub}</span>
                      </h3>
                      <span className="text-sm font-bold tabular-nums">{rango(fase)}</span>
                    </div>
                  </div>
                );
              }
              const tareas = tareasDe(fase.id, dia);
              const colchon = fase.min - tareas.reduce((a, t) => a + t.min, 0);
              return (
                <div key={fase.id} className={`rounded-lg border-l-[6px] px-4 py-3 ${ESTILO_FASE[fase.id]}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-heading text-base font-bold">
                      {fase.nombre} <span className="text-sm font-medium opacity-80">{fase.sub}</span>
                    </h3>
                    <span className="text-sm font-bold tabular-nums">{rango(fase)}</span>
                  </div>
                  <ul className="mt-2 grid gap-0.5">
                    {tareas.map((t, i) => {
                      const clave = `${fase.id}-${i}`;
                      const hecha = Boolean(marcas[clave]);
                      return (
                        <li key={clave}>
                          <label className="grid cursor-pointer grid-cols-[22px_minmax(0,1fr)_auto] items-start gap-x-2.5 rounded-md px-1 py-1.5 hover:bg-black/10">
                            <input type="checkbox" checked={hecha} onChange={() => alternar(clave)} className="mt-1 h-4 w-4 cursor-pointer accent-brand-green" />
                            <span className="min-w-0">
                              <span className={`block text-sm ${hecha ? "line-through opacity-55" : ""}`}>{t.t}</span>
                              <span className="block text-xs opacity-75">{t.donde}</span>
                            </span>
                            <span className="whitespace-nowrap pt-0.5 text-xs tabular-nums opacity-80">{t.min} min</span>
                          </label>
                        </li>
                      );
                    })}
                    {colchon >= 10 && (
                      <li className="pl-9 pt-1 text-xs italic opacity-75">Margen para imprevistos y lo que se arrastra: {colchon} min</li>
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {pestana === "semana" && (
        <section className="mt-5">
          <p className="mb-3 max-w-2xl text-sm text-gray-600">
            Las cinco jornadas con sus horarios. El arranque, el punto medio y el cierre son iguales todos los días; cambian el bloque de foco y el de equipo.
          </p>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
            {RUTINA.dias.map((d, i) => (
              <article
                key={d.corto}
                className={`min-w-0 rounded-xl border p-2.5 ${i === hoyIdx ? "border-brand-brown bg-amber-50" : "border-gray-200 bg-white"}`}
              >
                <h3 className="font-heading px-1 text-base font-bold text-gray-900">{d.largo}</h3>
                <p className="px-1 pb-1 text-xs text-gray-500">{d.tema}</p>
                {FASES.map((fase) => {
                  const nombre = fase.id === "foco" ? d.tema : fase.nombre;
                  const resumen =
                    fase.id === "foco"
                      ? d.foco.slice(0, 2).map((t) => t.t.split(":")[0]).join(" · ")
                      : fase.id === "bloque2"
                        ? d.bloque2.slice(0, 2).map((t) => t.t.split(":")[0]).join(" · ")
                        : fase.id === "arranque"
                          ? "Qué revisar · Agenda · Cierre de ayer · Chat"
                          : fase.id === "medio"
                            ? "Plata de hoy · Turnos sin marcar · Pagos"
                            : fase.id === "cierre"
                              ? "Cierre Diario · Detalle del día · Agenda de mañana"
                              : "";
                  return (
                    <div key={fase.id} className={`mt-1.5 rounded-md border-l-4 px-2.5 py-1.5 text-[13px] leading-snug ${ESTILO_FASE[fase.id]}`}>
                      <div className="text-xs font-bold tabular-nums opacity-85">{rango(fase)}</div>
                      <div className="font-bold">{nombre}</div>
                      {resumen && <div className="text-xs opacity-85">{resumen}</div>}
                    </div>
                  );
                })}
              </article>
            ))}
          </div>
        </section>
      )}

      {pestana === "mes" && (
        <section className="mt-5">
          <p className="mb-3 max-w-2xl text-sm text-gray-600">Tareas que se repiten una vez por mes. Se suman a la rutina del día en que caen.</p>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {RUTINA.mes.map((m) => (
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
      )}

      {pestana === "reglas" && (
        <section className="mt-5 grid max-w-2xl gap-2.5">
          {RUTINA.reglas.map((r) => (
            <div key={r.t} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
              <h3 className="font-heading text-base font-bold text-gray-900">{r.t}</h3>
              <p className="mt-0.5 text-sm text-gray-600">{r.d}</p>
            </div>
          ))}
        </section>
      )}

      <p className="mt-8 max-w-2xl text-xs text-gray-500">
        Lo que tildás se guarda en este navegador. Los horarios se corren con «Llego a las»; la jornada dura 8 horas y media. Los temas de cada día y las tareas del mes son una propuesta.
      </p>
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
