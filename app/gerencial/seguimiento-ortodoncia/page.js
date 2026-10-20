"use client";

import { useEffect, useMemo, useState } from "react";
import SoloDuena from "@/components/SoloDuena";
import { fechaDeHoyISO, sumarDias } from "@/lib/agenda";
import {
  ESTADOS_ASISTENCIA,
  SEGMENTOS,
  obtenerAsistenciaTurnosOrtodoncia,
  obtenerSeguimientoOrtodoncia,
} from "@/lib/data/seguimientoOrtodoncia";

const NOMBRES_MES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function formatoFecha(fechaISO) {
  if (!fechaISO) return "—";
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}

function nombreMes(claveMes) {
  if (!claveMes) return "—";
  const [anio, mes] = claveMes.split("-");
  return `${NOMBRES_MES[Number(mes) - 1]} ${anio}`;
}

function celdaCSV(valor) {
  const texto = String(valor ?? "");
  return /[;"\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

function descargarCSV(nombre, filas) {
  const contenido = "﻿" + filas.map((l) => l.map(celdaCSV).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([contenido], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

const ESTILO_SEGMENTO = {
  [SEGMENTOS.AL_DIA]: "bg-emerald-100 text-emerald-800",
  [SEGMENTOS.SE_ALEJO]: "bg-amber-100 text-amber-800",
  [SEGMENTOS.SOLO_CUADERNO]: "bg-orange-100 text-orange-800",
  [SEGMENTOS.SIN_MOVIMIENTO]: "bg-red-100 text-red-800",
};

const ESTILO_ASISTENCIA = {
  [ESTADOS_ASISTENCIA.ASISTIO]: "bg-emerald-100 text-emerald-800",
  [ESTADOS_ASISTENCIA.NO_ASISTIO]: "bg-red-100 text-red-800",
  [ESTADOS_ASISTENCIA.SIN_MARCAR]: "bg-amber-100 text-amber-800",
  [ESTADOS_ASISTENCIA.POR_VENIR]: "bg-sky-100 text-sky-800",
};

function Tarjeta({ titulo, valor, detalle, activa, onClick, color }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-4 py-3 text-left transition ${
        activa ? "border-brand-brown bg-brand-tan/30" : "border-gray-200 bg-white hover:bg-gray-50"
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{titulo}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${color || "text-gray-900"}`}>{valor}</p>
      {detalle && <p className="mt-0.5 text-xs text-gray-500">{detalle}</p>}
    </button>
  );
}

function VistaSeguimiento() {
  const hoy = fechaDeHoyISO();
  const [pacientes, setPacientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [segmento, setSegmento] = useState("todos");
  const [ortodoncista, setOrtodoncista] = useState("todos");
  const [soloSinTurno, setSoloSinTurno] = useState(false);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    obtenerSeguimientoOrtodoncia()
      .then(setPacientes)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  const activos = useMemo(() => pacientes.filter((p) => p.estado === "Activo"), [pacientes]);
  const otrosEstados = useMemo(() => {
    const m = {};
    for (const p of pacientes) if (p.estado !== "Activo") m[p.estado] = (m[p.estado] || 0) + 1;
    return Object.entries(m);
  }, [pacientes]);
  const conteo = (s) => activos.filter((p) => p.segmento === s).length;
  const sinTurnoFuturo = (s) => activos.filter((p) => p.segmento === s && !p.proximoTurno).length;

  const ortodoncistas = useMemo(() => [...new Set(activos.map((p) => p.ortodoncista))].sort((a, b) => a.localeCompare(b, "es")), [activos]);

  const porOrtodoncista = useMemo(
    () =>
      ortodoncistas.map((nombre) => {
        const suyos = activos.filter((p) => p.ortodoncista === nombre);
        return {
          nombre,
          total: suyos.length,
          ...Object.fromEntries(Object.values(SEGMENTOS).map((s) => [s, suyos.filter((p) => p.segmento === s).length])),
        };
      }),
    [ortodoncistas, activos]
  );

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return activos
      .filter((p) => segmento === "todos" || p.segmento === segmento)
      .filter((p) => ortodoncista === "todos" || p.ortodoncista === ortodoncista)
      .filter((p) => !soloSinTurno || !p.proximoTurno)
      .filter((p) => !q || p.nombre.toLowerCase().includes(q))
      .sort((a, b) => (a.ultimoMovimiento || "").localeCompare(b.ultimoMovimiento || "") || a.nombre.localeCompare(b.nombre, "es"));
  }, [activos, segmento, ortodoncista, soloSinTurno, busqueda]);

  function exportar() {
    descargarCSV(`seguimiento-ortodoncia-${hoy}.csv`, [
      ["Paciente", "Ortodoncista", "Situación", "Última visita en la app", "Días desde la última visita", "Último mes pago (cuaderno)", "Próximo turno", "WhatsApp"],
      ...visibles.map((p) => [
        p.nombre, p.ortodoncista, p.segmento, formatoFecha(p.ultimaVisita), p.diasDesdeUltimaVisita ?? "",
        nombreMes(p.ultimoMesPago), formatoFecha(p.proximoTurno), p.whatsapp || "",
      ]),
    ]);
  }

  if (cargando) return <p className="mt-6 text-sm text-gray-500">Calculando...</p>;
  if (error) return <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>;

  return (
    <>
      <p className="mt-3 text-sm text-gray-600">
        <strong>{activos.length}</strong> pacientes activos
        {otrosEstados.length > 0 && <> · además: {otrosEstados.map(([e, n]) => `${n} ${e.toLowerCase()}`).join(", ")}</>}. Una visita
        cuenta si hay un cobro, un turno marcado como presente o un &quot;qué se hizo&quot; del ortodoncista. La app tiene visitas
        desde el 26/8; antes de eso solo está el cuaderno (último mes marcado &quot;Pago&quot;).
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tarjeta
          titulo={SEGMENTOS.AL_DIA}
          valor={conteo(SEGMENTOS.AL_DIA)}
          detalle="Vinieron o pagaron en los últimos 30 días"
          color="text-emerald-700"
          activa={segmento === SEGMENTOS.AL_DIA}
          onClick={() => setSegmento(segmento === SEGMENTOS.AL_DIA ? "todos" : SEGMENTOS.AL_DIA)}
        />
        <Tarjeta
          titulo={SEGMENTOS.SE_ALEJO}
          valor={conteo(SEGMENTOS.SE_ALEJO)}
          detalle={`Última visita hace más de 30 días · ${sinTurnoFuturo(SEGMENTOS.SE_ALEJO)} sin turno`}
          color="text-amber-700"
          activa={segmento === SEGMENTOS.SE_ALEJO}
          onClick={() => setSegmento(segmento === SEGMENTOS.SE_ALEJO ? "todos" : SEGMENTOS.SE_ALEJO)}
        />
        <Tarjeta
          titulo={SEGMENTOS.SOLO_CUADERNO}
          valor={conteo(SEGMENTOS.SOLO_CUADERNO)}
          detalle={`Pagaron en el cuaderno, nada en la app · ${sinTurnoFuturo(SEGMENTOS.SOLO_CUADERNO)} sin turno`}
          color="text-orange-700"
          activa={segmento === SEGMENTOS.SOLO_CUADERNO}
          onClick={() => setSegmento(segmento === SEGMENTOS.SOLO_CUADERNO ? "todos" : SEGMENTOS.SOLO_CUADERNO)}
        />
        <Tarjeta
          titulo={SEGMENTOS.SIN_MOVIMIENTO}
          valor={conteo(SEGMENTOS.SIN_MOVIMIENTO)}
          detalle={`Ni cuaderno ni app · ${sinTurnoFuturo(SEGMENTOS.SIN_MOVIMIENTO)} sin turno`}
          color="text-red-700"
          activa={segmento === SEGMENTOS.SIN_MOVIMIENTO}
          onClick={() => setSegmento(segmento === SEGMENTOS.SIN_MOVIMIENTO ? "todos" : SEGMENTOS.SIN_MOVIMIENTO)}
        />
      </div>

      <h2 className="mt-6 text-sm font-semibold text-gray-700">Por ortodoncista</h2>
      <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-[600px] border-collapse text-sm">
          <thead>
            <tr className="bg-brand-brown text-white">
              <th className="px-3 py-2 text-left font-semibold">Ortodoncista</th>
              <th className="px-3 py-2 text-right font-semibold">Activos</th>
              {Object.values(SEGMENTOS).map((s) => (
                <th key={s} className="px-3 py-2 text-right font-semibold">{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {porOrtodoncista.map((o) => (
              <tr key={o.nombre} className="border-t border-gray-100">
                <td className="px-3 py-2 font-medium text-gray-900">{o.nombre}</td>
                <td className="px-3 py-2 text-right tabular-nums">{o.total}</td>
                {Object.values(SEGMENTOS).map((s) => (
                  <td key={s} className="px-3 py-2 text-right tabular-nums text-gray-700">{o[s]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar paciente..."
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
        <select value={segmento} onChange={(e) => setSegmento(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
          <option value="todos">Todas las situaciones</option>
          {Object.values(SEGMENTOS).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={ortodoncista} onChange={(e) => setOrtodoncista(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
          <option value="todos">Todos los ortodoncistas</option>
          {ortodoncistas.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={soloSinTurno} onChange={(e) => setSoloSinTurno(e.target.checked)} />
          Solo sin turno a futuro
        </label>
        <button
          onClick={exportar}
          className="ml-auto rounded-md border border-brand-brown/40 px-3 py-1.5 text-sm font-medium text-brand-brown hover:bg-brand-tan/30"
        >
          ⬇️ Descargar Excel (CSV)
        </button>
      </div>

      <p className="mt-3 text-sm font-semibold text-gray-700">{visibles.length} paciente{visibles.length === 1 ? "" : "s"}</p>
      <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="bg-brand-brown text-white">
              <th className="px-3 py-2 text-left font-semibold">Paciente</th>
              <th className="px-3 py-2 text-left font-semibold">Ortodoncista</th>
              <th className="px-3 py-2 text-left font-semibold">Situación</th>
              <th className="px-3 py-2 text-left font-semibold">Última visita (app)</th>
              <th className="px-3 py-2 text-left font-semibold">Último mes pago (cuaderno)</th>
              <th className="px-3 py-2 text-left font-semibold">Próximo turno</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((p) => (
              <tr key={p.id} className="border-t border-gray-100">
                <td className="px-3 py-2 font-medium text-gray-900">{p.nombre}</td>
                <td className="px-3 py-2 text-gray-600">{p.ortodoncista}</td>
                <td className="px-3 py-2">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${ESTILO_SEGMENTO[p.segmento]}`}>{p.segmento}</span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 tabular-nums text-gray-600">
                  {p.ultimaVisita ? `${formatoFecha(p.ultimaVisita)} (hace ${p.diasDesdeUltimaVisita} d)` : "—"}
                </td>
                <td className="px-3 py-2 text-gray-600">{nombreMes(p.ultimoMesPago)}</td>
                <td className="whitespace-nowrap px-3 py-2 tabular-nums text-gray-600">{formatoFecha(p.proximoTurno)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function VistaAsistencia() {
  const hoy = fechaDeHoyISO();
  const [desde, setDesde] = useState(`${hoy.slice(0, 7)}-01`);
  const [hasta, setHasta] = useState(sumarDias(hoy, 14));
  const [datos, setDatos] = useState({ turnos: [], cancelados: 0 });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [situacion, setSituacion] = useState("todas");
  const [ortodoncista, setOrtodoncista] = useState("todos");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    setCargando(true);
    setError(null);
    obtenerAsistenciaTurnosOrtodoncia(desde, hasta)
      .then(setDatos)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [desde, hasta]);

  const { turnos, cancelados } = datos;
  const ortodoncistas = useMemo(() => [...new Set(turnos.map((t) => t.ortodoncista))].sort((a, b) => a.localeCompare(b, "es")), [turnos]);
  const conteo = (s) => turnos.filter((t) => t.situacion === s).length;
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return turnos
      .filter((t) => situacion === "todas" || t.situacion === situacion)
      .filter((t) => ortodoncista === "todos" || t.ortodoncista === ortodoncista)
      .filter((t) => !q || t.paciente.toLowerCase().includes(q));
  }, [turnos, situacion, ortodoncista, busqueda]);

  const atendidos = conteo(ESTADOS_ASISTENCIA.ASISTIO);
  const faltaron = conteo(ESTADOS_ASISTENCIA.NO_ASISTIO);
  const tasa = atendidos + faltaron > 0 ? Math.round((atendidos / (atendidos + faltaron)) * 100) : null;

  function atajo(d, h) {
    setDesde(d);
    setHasta(h);
  }

  function exportar() {
    descargarCSV(`asistencia-ortodoncia-${desde}-a-${hasta}.csv`, [
      ["Fecha", "Hora", "Paciente", "Ortodoncista", "Concepto", "Situación"],
      ...visibles.map((t) => [formatoFecha(t.fecha), t.hora, t.paciente, t.ortodoncista, t.concepto, t.situacion]),
    ]);
  }

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1 text-sm" />
        <span className="text-sm text-gray-500">a</span>
        <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1 text-sm" />
        <button onClick={() => atajo(`${hoy.slice(0, 7)}-01`, sumarDias(hoy, 14))} className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50">
          Este mes + 2 semanas
        </button>
        <button onClick={() => atajo(sumarDias(hoy, -30), hoy)} className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50">
          Últimos 30 días
        </button>
        <button onClick={() => atajo(hoy, sumarDias(hoy, 14))} className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50">
          Próximas 2 semanas
        </button>
        <button onClick={() => atajo("2026-08-24", sumarDias(hoy, 60))} className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50">
          Todo desde la app
        </button>
      </div>

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
      {cargando ? (
        <p className="mt-6 text-sm text-gray-500">Calculando...</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tarjeta titulo="Asistieron" valor={atendidos} color="text-emerald-700" activa={situacion === ESTADOS_ASISTENCIA.ASISTIO}
              onClick={() => setSituacion(situacion === ESTADOS_ASISTENCIA.ASISTIO ? "todas" : ESTADOS_ASISTENCIA.ASISTIO)}
              detalle={tasa !== null ? `${tasa}% de los que ya tenían que venir` : "Turnos en los que el paciente vino"} />
            <Tarjeta titulo="No asistieron" valor={faltaron} color="text-red-700" activa={situacion === ESTADOS_ASISTENCIA.NO_ASISTIO}
              onClick={() => setSituacion(situacion === ESTADOS_ASISTENCIA.NO_ASISTIO ? "todas" : ESTADOS_ASISTENCIA.NO_ASISTIO)}
              detalle="Marcados como “No asistió”" />
            <Tarjeta titulo="Sin marcar" valor={conteo(ESTADOS_ASISTENCIA.SIN_MARCAR)} color="text-amber-700" activa={situacion === ESTADOS_ASISTENCIA.SIN_MARCAR}
              onClick={() => setSituacion(situacion === ESTADOS_ASISTENCIA.SIN_MARCAR ? "todas" : ESTADOS_ASISTENCIA.SIN_MARCAR)}
              detalle="Ya pasó la fecha y nadie marcó si vino" />
            <Tarjeta titulo="Por venir" valor={conteo(ESTADOS_ASISTENCIA.POR_VENIR)} color="text-sky-700" activa={situacion === ESTADOS_ASISTENCIA.POR_VENIR}
              onClick={() => setSituacion(situacion === ESTADOS_ASISTENCIA.POR_VENIR ? "todas" : ESTADOS_ASISTENCIA.POR_VENIR)}
              detalle="Turnos agendados que faltan" />
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {turnos.length} turnos agendados en el rango. Además hubo {cancelados} cancelado{cancelados === 1 ? "" : "s"} o reprogramado{cancelados === 1 ? "" : "s"} (no cuentan).
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar paciente..." className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
            <select value={situacion} onChange={(e) => setSituacion(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
              <option value="todas">Todas las situaciones</option>
              {Object.values(ESTADOS_ASISTENCIA).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select value={ortodoncista} onChange={(e) => setOrtodoncista(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
              <option value="todos">Todos los ortodoncistas</option>
              {ortodoncistas.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
            <button onClick={exportar} className="ml-auto rounded-md border border-brand-brown/40 px-3 py-1.5 text-sm font-medium text-brand-brown hover:bg-brand-tan/30">
              ⬇️ Descargar Excel (CSV)
            </button>
          </div>

          <p className="mt-3 text-sm font-semibold text-gray-700">{visibles.length} turno{visibles.length === 1 ? "" : "s"}</p>
          <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full min-w-[700px] border-collapse text-sm">
              <thead>
                <tr className="bg-brand-brown text-white">
                  <th className="px-3 py-2 text-left font-semibold">Fecha</th>
                  <th className="px-3 py-2 text-left font-semibold">Hora</th>
                  <th className="px-3 py-2 text-left font-semibold">Paciente</th>
                  <th className="px-3 py-2 text-left font-semibold">Ortodoncista</th>
                  <th className="px-3 py-2 text-left font-semibold">Turno</th>
                  <th className="px-3 py-2 text-left font-semibold">Situación</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((t) => (
                  <tr key={t.id} className="border-t border-gray-100">
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-gray-800">{formatoFecha(t.fecha)}</td>
                    <td className="px-3 py-2 tabular-nums text-gray-600">{t.hora}</td>
                    <td className="px-3 py-2 font-medium text-gray-900">{t.paciente}</td>
                    <td className="px-3 py-2 text-gray-600">{t.ortodoncista}</td>
                    <td className="px-3 py-2 text-gray-600">{t.concepto}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${ESTILO_ASISTENCIA[t.situacion]}`}>{t.situacion}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

function PaginaSeguimiento() {
  const [vista, setVista] = useState("seguimiento");
  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">🦷 Seguimiento de Ortodoncia</h1>
      <p className="mt-0.5 text-sm text-gray-500">Solo para las dueñas: quién viene, quién se alejó y a qué turnos se asistió.</p>
      <div className="mt-4 flex overflow-hidden rounded-md border border-gray-300 text-sm sm:w-fit">
        <button
          onClick={() => setVista("seguimiento")}
          className={`px-4 py-1.5 ${vista === "seguimiento" ? "bg-brand-brown text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
        >
          Pacientes activos
        </button>
        <button
          onClick={() => setVista("asistencia")}
          className={`px-4 py-1.5 ${vista === "asistencia" ? "bg-brand-brown text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
        >
          Asistencia a los turnos
        </button>
      </div>
      {vista === "seguimiento" ? <VistaSeguimiento /> : <VistaAsistencia />}
    </main>
  );
}

export default function SeguimientoOrtodonciaPage() {
  return (
    <SoloDuena>
      <PaginaSeguimiento />
    </SoloDuena>
  );
}
