"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import SoloDuenaYSecretaria from "@/components/SoloDuenaYSecretaria";
import { useAuth } from "@/lib/auth/AuthProvider";
import { fechaDeHoyISO, sumarDias } from "@/lib/agenda";
import {
  aMinutos,
  clasificarIngreso,
  deshacerIngreso,
  horaAhora,
  horaLimite,
  marcarIngreso,
  MARGEN_MIN,
  obtenerIngresosPorRango,
  obtenerProfesionalesConHorario,
  resumenPorProfesional,
  turnosEsperadosDeFecha,
  TURNOS,
} from "@/lib/data/ingresosProfesionales";

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const textoFecha = (iso) => {
  const [a, m, d] = iso.split("-").map(Number);
  return `${DIAS[new Date(a, m - 1, d).getDay()]} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
};

const ESTILOS = {
  "a-tiempo": { chip: "bg-emerald-100 text-emerald-900", borde: "border-emerald-300", icono: "✅" },
  justo: { chip: "bg-amber-100 text-amber-900", borde: "border-amber-300", icono: "⚠️" },
  tarde: { chip: "bg-red-100 text-red-800", borde: "border-red-300", icono: "⏰" },
  "no-vino": { chip: "bg-gray-200 text-gray-700", borde: "border-gray-300", icono: "🚫" },
};

const TEXTO_RESULTADO = {
  "a-tiempo": "Llegó con tiempo",
  justo: `Llegó, pero con menos de ${MARGEN_MIN} min de anticipación`,
  tarde: "Llegó tarde",
  "no-vino": "No vino",
};

// Se vuelve a calcular cada medio minuto, para que los avisos de "ya pasó la hora" se actualicen solos.
function useAhora() {
  const [ahora, setAhora] = useState(() => horaAhora());
  useEffect(() => {
    const t = setInterval(() => setAhora(horaAhora()), 30000);
    return () => clearInterval(t);
  }, []);
  return ahora;
}

function TarjetaProfesional({ item, ingreso, ahora, onMarcar, onDeshacer, puedeDeshacer, trabajando }) {
  const [otraHora, setOtraHora] = useState(false);
  const [hora, setHora] = useState("");
  const limite = horaLimite(item.horaProgramada);

  if (ingreso) {
    const r = clasificarIngreso(ingreso);
    const e = ESTILOS[r.clave];
    return (
      <li className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4 ${e.borde}`}>
        <div>
          <p className="text-base font-bold text-gray-900">{item.nombre}</p>
          <p className="text-xs text-gray-500">
            Su horario empieza a las <strong>{item.horaProgramada}</strong> · tenía que llegar a las <strong>{limite}</strong>
          </p>
          <p className="mt-1 text-sm text-gray-800">
            {ingreso.estado === "No vino" ? "Marcado como que no vino" : <>Llegó a las <strong>{ingreso.horaLlegada}</strong> ({r.texto})</>}
            {ingreso.manual && <span className="ml-1 rounded bg-gray-100 px-1.5 text-xs text-gray-600">hora cargada a mano</span>}
          </p>
          <p className="text-xs text-gray-500">
            Lo marcó {ingreso.marcadoPor}
            {ingreso.nota ? ` · Nota: ${ingreso.nota}` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`rounded-full px-3 py-1 text-sm font-semibold ${e.chip}`}>
            {e.icono} {TEXTO_RESULTADO[r.clave]}
          </span>
          {puedeDeshacer(ingreso) && (
            <button disabled={trabajando} onClick={() => onDeshacer(ingreso)} className="text-xs text-gray-500 underline hover:text-red-700 disabled:opacity-50">
              Me equivoqué, deshacer
            </button>
          )}
        </div>
      </li>
    );
  }

  const faltan = aMinutos(limite) - aMinutos(ahora);
  let aviso;
  let claseAviso = "text-gray-600";
  if (aMinutos(ahora) >= aMinutos(item.horaProgramada)) {
    aviso = `Ya debería estar: su horario empezaba a las ${item.horaProgramada}`;
    claseAviso = "font-semibold text-red-700";
  } else if (faltan <= 0) {
    aviso = `Ya pasó la hora de llegada (${limite}). Empieza a las ${item.horaProgramada}`;
    claseAviso = "font-semibold text-amber-700";
  } else if (faltan <= 60) {
    aviso = `Tiene que llegar a las ${limite} (faltan ${faltan} min)`;
  } else {
    aviso = `Tiene que llegar a las ${limite} · empieza a las ${item.horaProgramada}`;
  }

  return (
    <li className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-base font-bold text-gray-900">{item.nombre}</p>
          <p className="text-xs text-gray-500">{item.especialidad || "—"}{item.horaFin ? ` · de ${item.horaProgramada} a ${item.horaFin}` : ""}</p>
          <p className={`mt-1 text-sm ${claseAviso}`}>{aviso}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={trabajando}
            onClick={() => onMarcar(item, {})}
            className="rounded-lg bg-emerald-600 px-4 py-2.5 text-base font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
          >
            ✅ Llegó ahora
          </button>
          <button disabled={trabajando} onClick={() => setOtraHora((v) => !v)} className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            ✏️ Otra hora
          </button>
          <button
            disabled={trabajando}
            onClick={() => {
              const nota = window.prompt(`¿Querés dejar una nota de por qué ${item.nombre} no vino? (opcional)`);
              if (nota === null) return;
              onMarcar(item, { estado: "No vino", nota });
            }}
            className="rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            No vino
          </button>
        </div>
      </div>
      {otraHora && (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg bg-gray-50 p-3">
          <label className="text-sm text-gray-700">
            ¿A qué hora llegó?
            <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="ml-2 rounded-md border border-gray-300 px-2 py-1" />
          </label>
          <button
            disabled={!hora || trabajando}
            onClick={() => onMarcar(item, { horaLlegada: hora, manual: true })}
            className="rounded-md bg-brand-brown px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
          >
            Guardar
          </button>
          <p className="w-full text-xs text-gray-500">Usalo solo si te olvidaste de marcar en el momento. Queda registrado que la hora se cargó a mano.</p>
        </div>
      )}
    </li>
  );
}

function PanelHoy({ profesionales, esDuena, usuarioId }) {
  const hoy = fechaDeHoyISO();
  const ahora = useAhora();
  const [ingresos, setIngresos] = useState(null);
  const [error, setError] = useState(null);
  const [trabajando, setTrabajando] = useState(false);
  const [extra, setExtra] = useState({ profesionalId: "", turno: "Mañana", horaProgramada: "" });

  const cargar = useCallback(async () => {
    try {
      setIngresos(await obtenerIngresosPorRango(hoy, hoy));
    } catch (e) {
      setError(e.message);
    }
  }, [hoy]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const esperados = useMemo(() => turnosEsperadosDeFecha(profesionales, hoy), [profesionales, hoy]);

  // Lista del día: los que tienen horario hoy + los que se marcaron aunque no figuraran.
  const lista = useMemo(() => {
    const marcas = new Map((ingresos || []).map((i) => [`${i.profesionalId}|${i.turno}`, i]));
    const base = esperados.map((e) => ({ item: e, ingreso: marcas.get(`${e.profesionalId}|${e.turno}`) || null }));
    const vistos = new Set(esperados.map((e) => `${e.profesionalId}|${e.turno}`));
    for (const i of ingresos || []) {
      if (!vistos.has(`${i.profesionalId}|${i.turno}`)) {
        base.push({ item: { profesionalId: i.profesionalId, nombre: i.profesional, especialidad: "Fuera del horario cargado", turno: i.turno, horaProgramada: i.horaProgramada, horaFin: null }, ingreso: i });
      }
    }
    return base;
  }, [esperados, ingresos]);

  async function ejecutar(fn) {
    setTrabajando(true);
    setError(null);
    try {
      await fn();
      await cargar();
    } catch (e) {
      setError(e.message);
      await cargar();
    } finally {
      setTrabajando(false);
    }
  }

  const puedeDeshacer = (i) => esDuena || (i.marcadoPorId === usuarioId && Date.now() - new Date(i.creadoEn).getTime() < 15 * 60 * 1000);

  const marcar = (item, opciones) =>
    ejecutar(() => marcarIngreso({ fecha: hoy, profesionalId: item.profesionalId, turno: item.turno, horaProgramada: item.horaProgramada, ...opciones }));

  async function agregarExtra(e) {
    e.preventDefault();
    if (!extra.profesionalId || !extra.horaProgramada) return;
    await ejecutar(() => marcarIngreso({ fecha: hoy, profesionalId: extra.profesionalId, turno: extra.turno, horaProgramada: extra.horaProgramada }));
    setExtra({ profesionalId: "", turno: "Mañana", horaProgramada: "" });
  }

  if (!ingresos && !error) return <p className="mt-4 text-sm text-gray-500">Cargando…</p>;

  return (
    <div className="mt-4">
      <p className="text-sm text-gray-600">
        Marcá a qué hora llega cada profesional. El botón <strong>“Llegó ahora”</strong> guarda la hora de este momento. Se les pide llegar{" "}
        <strong>{MARGEN_MIN} minutos antes</strong> de que empiece su horario.
      </p>
      {error && <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      {TURNOS.map((turno) => {
        const delTurno = lista.filter((l) => l.item.turno === turno);
        const marcados = delTurno.filter((l) => l.ingreso).length;
        return (
          <section key={turno} className="mt-5">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-600">
              {turno === "Mañana" ? "☀️ Mañana" : "🌇 Tarde"} · {marcados} de {delTurno.length} marcados
            </h2>
            {delTurno.length === 0 ? (
              <p className="mt-2 rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">Nadie tiene horario cargado en este turno hoy.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-3">
                {delTurno.map((l) => (
                  <TarjetaProfesional
                    key={`${l.item.profesionalId}|${l.item.turno}`}
                    item={l.item}
                    ingreso={l.ingreso}
                    ahora={ahora}
                    trabajando={trabajando}
                    onMarcar={marcar}
                    puedeDeshacer={puedeDeshacer}
                    onDeshacer={(i) => ejecutar(() => deshacerIngreso(i.id))}
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <details className="mt-6 rounded-xl border border-gray-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-semibold text-gray-700">➕ Vino un profesional que no figura hoy</summary>
        <form onSubmit={agregarExtra} className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-sm text-gray-700">
            Profesional
            <select value={extra.profesionalId} onChange={(e) => setExtra({ ...extra, profesionalId: e.target.value })} className="mt-1 block rounded-md border border-gray-300 px-2 py-1.5" required>
              <option value="">Elegí…</option>
              {profesionales.filter((p) => p.activo).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-700">
            Turno
            <select value={extra.turno} onChange={(e) => setExtra({ ...extra, turno: e.target.value })} className="mt-1 block rounded-md border border-gray-300 px-2 py-1.5">
              {TURNOS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="text-sm text-gray-700">
            ¿A qué hora empezaba su horario?
            <input type="time" value={extra.horaProgramada} onChange={(e) => setExtra({ ...extra, horaProgramada: e.target.value })} className="mt-1 block rounded-md border border-gray-300 px-2 py-1.5" required />
          </label>
          <button type="submit" disabled={trabajando} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
            ✅ Llegó ahora
          </button>
        </form>
      </details>
    </div>
  );
}

const PERIODOS = [
  { clave: "7", texto: "Últimos 7 días", dias: 7 },
  { clave: "30", texto: "Últimos 30 días", dias: 30 },
  { clave: "90", texto: "Últimos 90 días", dias: 90 },
];

function PanelInforme({ profesionales }) {
  const hoy = fechaDeHoyISO();
  const [periodo, setPeriodo] = useState("30");
  const [ingresos, setIngresos] = useState(null);
  const [error, setError] = useState(null);
  const dias = PERIODOS.find((p) => p.clave === periodo).dias;
  const desde = sumarDias(hoy, -(dias - 1));

  const cargar = useCallback(async () => {
    setError(null);
    try {
      setIngresos(await obtenerIngresosPorRango(desde, hoy));
    } catch (e) {
      setError(e.message);
    }
  }, [desde, hoy]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  // Días pasados con horario en la Agenda en los que nadie marcó el ingreso (según el horario cargado hoy en la Agenda).
  const sinMarcarPorProfesional = useMemo(() => {
    if (!ingresos) return {};
    const marcados = new Set(ingresos.map((i) => `${i.fecha}|${i.profesionalId}|${i.turno}`));
    const cuenta = {};
    for (let d = desde; d < hoy; d = sumarDias(d, 1)) {
      for (const e of turnosEsperadosDeFecha(profesionales, d)) {
        if (!marcados.has(`${d}|${e.profesionalId}|${e.turno}`)) cuenta[e.profesionalId] = (cuenta[e.profesionalId] || 0) + 1;
      }
    }
    return cuenta;
  }, [ingresos, profesionales, desde, hoy]);

  const resumen = useMemo(() => resumenPorProfesional(ingresos || []), [ingresos]);
  const total = useMemo(() => {
    const t = { total: 0, aTiempo: 0, justo: 0, tarde: 0, noVino: 0 };
    for (const r of resumen) for (const k of Object.keys(t)) t[k] += r[k];
    return t;
  }, [resumen]);

  async function quitar(i) {
    if (!window.confirm(`¿Quitar el registro de ${i.profesional} del ${textoFecha(i.fecha)} (${i.turno})? No se puede deshacer.`)) return;
    try {
      await deshacerIngreso(i.id);
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  const colorCumplimiento = (p) => (p === null ? "text-gray-400" : p >= 80 ? "text-emerald-700" : p >= 50 ? "text-amber-700" : "text-red-700");

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-gray-600">
          Cumple quien llega con al menos <strong>{MARGEN_MIN} minutos de anticipación</strong> al comienzo de su horario. “Justo” es llegar antes de la hora pero con menos margen;
          “tarde” es llegar después.
        </p>
        <div className="flex overflow-hidden rounded-lg border border-brand-tan">
          {PERIODOS.map((p) => (
            <button key={p.clave} onClick={() => setPeriodo(p.clave)} className={`px-3 py-1.5 text-sm font-medium ${periodo === p.clave ? "bg-brand-brown text-white" : "bg-white text-brand-brown hover:bg-brand-tan/30"}`}>
              {p.texto}
            </button>
          ))}
        </div>
      </div>
      {error && <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
      {!ingresos && !error && <p className="mt-4 text-sm text-gray-500">Cargando…</p>}

      {ingresos && (
        <>
          {ingresos.length === 0 ? (
            <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Todavía no hay ingresos marcados en este período.</p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-xl border border-brand-tan/60 bg-white">
              <table className="w-full min-w-[40rem] text-sm">
                <thead className="bg-brand-cream text-xs uppercase tracking-wide text-brand-brown">
                  <tr>
                    <th className="px-3 py-2 text-left">Profesional</th>
                    <th className="px-3 py-2 text-right">Marcados</th>
                    <th className="px-3 py-2 text-right">Con tiempo</th>
                    <th className="px-3 py-2 text-right">Justo</th>
                    <th className="px-3 py-2 text-right">Tarde</th>
                    <th className="px-3 py-2 text-right">No vino</th>
                    <th className="px-3 py-2 text-right">Sin marcar</th>
                    <th className="px-3 py-2 text-right">Llega en promedio</th>
                    <th className="px-3 py-2 text-right">Cumplimiento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-tan/30 tabular-nums">
                  {resumen.map((r) => (
                    <tr key={r.profesionalId}>
                      <td className="px-3 py-2 font-semibold text-gray-900">{r.nombre}</td>
                      <td className="px-3 py-2 text-right">{r.total}</td>
                      <td className="px-3 py-2 text-right text-emerald-700">{r.aTiempo}</td>
                      <td className="px-3 py-2 text-right text-amber-700">{r.justo}</td>
                      <td className="px-3 py-2 text-right text-red-700">{r.tarde}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{r.noVino}</td>
                      <td className="px-3 py-2 text-right text-gray-500">{sinMarcarPorProfesional[r.profesionalId] || 0}</td>
                      <td className="px-3 py-2 text-right">
                        {r.promedioAntes === null ? "—" : r.promedioAntes >= 0 ? `${r.promedioAntes} min antes` : `${-r.promedioAntes} min tarde`}
                      </td>
                      <td className={`px-3 py-2 text-right font-bold ${colorCumplimiento(r.cumplimiento)}`}>{r.cumplimiento === null ? "—" : `${r.cumplimiento}%`}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-brand-cream/60 font-semibold tabular-nums">
                  <tr>
                    <td className="px-3 py-2">Total</td>
                    <td className="px-3 py-2 text-right">{total.total}</td>
                    <td className="px-3 py-2 text-right">{total.aTiempo}</td>
                    <td className="px-3 py-2 text-right">{total.justo}</td>
                    <td className="px-3 py-2 text-right">{total.tarde}</td>
                    <td className="px-3 py-2 text-right">{total.noVino}</td>
                    <td className="px-3 py-2 text-right">{Object.values(sinMarcarPorProfesional).reduce((s, n) => s + n, 0)}</td>
                    <td className="px-3 py-2" />
                    <td className="px-3 py-2 text-right">{total.total ? `${Math.round((total.aTiempo / total.total) * 100)}%` : "—"}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <p className="mt-2 text-xs text-gray-500">
            “Sin marcar” cuenta los días pasados en los que el profesional tenía horario en la Agenda y nadie marcó su ingreso (según el horario que hoy está cargado en la Agenda).
            El cumplimiento es el porcentaje de ingresos marcados en los que llegó con tiempo.
          </p>

          {ingresos.length > 0 && (
            <>
              <h2 className="mt-6 text-sm font-bold uppercase tracking-wide text-gray-600">Detalle</h2>
              <div className="mt-2 max-h-[32rem] overflow-auto rounded-xl border border-brand-tan/60 bg-white">
                <table className="w-full min-w-[40rem] text-sm">
                  <thead className="sticky top-0 bg-brand-cream text-xs uppercase tracking-wide text-brand-brown">
                    <tr>
                      <th className="px-3 py-2 text-left">Día</th>
                      <th className="px-3 py-2 text-left">Profesional</th>
                      <th className="px-3 py-2 text-left">Turno</th>
                      <th className="px-3 py-2 text-right">Empezaba</th>
                      <th className="px-3 py-2 text-right">Llegó</th>
                      <th className="px-3 py-2 text-left">Resultado</th>
                      <th className="px-3 py-2 text-left">Lo marcó</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-tan/30 tabular-nums">
                    {ingresos.map((i) => {
                      const r = clasificarIngreso(i);
                      return (
                        <tr key={i.id}>
                          <td className="px-3 py-1.5">{textoFecha(i.fecha)}</td>
                          <td className="px-3 py-1.5 font-medium">{i.profesional}</td>
                          <td className="px-3 py-1.5">{i.turno}</td>
                          <td className="px-3 py-1.5 text-right">{i.horaProgramada}</td>
                          <td className="px-3 py-1.5 text-right">{i.horaLlegada || "—"}</td>
                          <td className="px-3 py-1.5">
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ESTILOS[r.clave].chip}`}>{r.clave === "no-vino" ? "No vino" : r.texto}</span>
                            {i.nota && <span className="ml-1 text-xs text-gray-500">· {i.nota}</span>}
                          </td>
                          <td className="px-3 py-1.5 text-xs text-gray-600">
                            {i.marcadoPor}
                            {i.manual && <span className="ml-1 rounded bg-gray-100 px-1">a mano</span>}
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            <button onClick={() => quitar(i)} className="text-xs text-gray-400 hover:text-red-700">
                              Quitar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function IngresoProfesionalesContenido() {
  const { perfil, user } = useAuth();
  const esDuena = perfil?.rol === "Duena";
  const [pestana, setPestana] = useState("hoy");
  const [profesionales, setProfesionales] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    obtenerProfesionalesConHorario()
      .then(setProfesionales)
      .catch((e) => setError(e.message));
  }, []);

  const hoy = fechaDeHoyISO();
  const [a, m, d] = hoy.split("-").map(Number);
  const nombreDia = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][new Date(a, m - 1, d).getDay()];

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-brown/70">Recepción</p>
      <h1 className="font-heading text-3xl font-extrabold text-brand-brown">🕐 Ingreso de profesionales</h1>
      <p className="text-sm text-gray-600">
        Hoy es {nombreDia} {String(d).padStart(2, "0")}/{String(m).padStart(2, "0")}
      </p>

      {esDuena && (
        <div className="mt-3 flex w-fit overflow-hidden rounded-lg border border-brand-brown/40 text-sm">
          {[
            ["hoy", "Hoy"],
            ["informe", "📊 Informe de puntualidad"],
          ].map(([clave, texto]) => (
            <button key={clave} onClick={() => setPestana(clave)} className={`px-3 py-1.5 font-medium ${pestana === clave ? "bg-brand-green text-white" : "bg-white text-brand-brown hover:bg-brand-tan/30"}`}>
              {texto}
            </button>
          ))}
        </div>
      )}

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
      {!profesionales && !error && <p className="mt-4 text-sm text-gray-500">Cargando…</p>}
      {profesionales && (pestana === "hoy" || !esDuena ? <PanelHoy profesionales={profesionales} esDuena={esDuena} usuarioId={user?.id} /> : <PanelInforme profesionales={profesionales} />)}
    </main>
  );
}

export default function IngresoProfesionalesPage() {
  return (
    <SoloDuenaYSecretaria>
      <IngresoProfesionalesContenido />
    </SoloDuenaYSecretaria>
  );
}
