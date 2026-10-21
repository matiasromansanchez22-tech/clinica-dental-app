"use client";

import { useEffect, useMemo, useState } from "react";
import SoloDuena from "@/components/SoloDuena";
import ControlCobrosOrtodoncia from "@/components/ControlCobrosOrtodoncia";
import { fechaDeHoyISO, sumarDias } from "@/lib/agenda";
import {
  ESTADOS_ASISTENCIA,
  ESTADOS_MES,
  SEGMENTOS,
  estadoEnElMes,
  obtenerAsistenciaTurnosOrtodoncia,
  obtenerEvolucionMensualOrtodoncia,
  obtenerSeguimientoOrtodoncia,
} from "@/lib/data/seguimientoOrtodoncia";
import { esMesDePrueba } from "@/lib/mesesDePrueba";

const NOMBRES_MES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function formatoFecha(fechaISO) {
  if (!fechaISO) return "—";
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}

function formatoDiaMes(fechaISO) {
  const [, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}`;
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

const ESTILO_ESTADO_MES = {
  [ESTADOS_MES.ASISTIO]: "bg-emerald-100 text-emerald-800",
  [ESTADOS_MES.FALTA_ASISTIR]: "bg-sky-100 text-sky-800",
  [ESTADOS_MES.TURNO_SIN_ASISTIR]: "bg-amber-100 text-amber-800",
  [ESTADOS_MES.SIN_TURNO]: "bg-red-100 text-red-800",
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

function VistaMes() {
  const hoy = fechaDeHoyISO();
  const [pacientes, setPacientes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [mes, setMes] = useState(hoy.slice(0, 7));
  const [estadoElegido, setEstadoElegido] = useState("todos");
  const [segmento, setSegmento] = useState("todos");
  const [ortodoncista, setOrtodoncista] = useState("todos");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    obtenerSeguimientoOrtodoncia()
      .then(setPacientes)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  // Cada paciente activo, con su estado en el mes elegido.
  const activos = useMemo(
    () => pacientes.filter((p) => p.estado === "Activo").map((p) => ({ ...p, estadoMes: estadoEnElMes(p, mes) })),
    [pacientes, mes]
  );
  const otrosEstados = useMemo(() => {
    const m = {};
    for (const p of pacientes) if (p.estado !== "Activo") m[p.estado] = (m[p.estado] || 0) + 1;
    return Object.entries(m);
  }, [pacientes]);
  const conteo = (e) => activos.filter((p) => p.estadoMes === e).length;
  const sinTurno = activos.filter((p) => p.estadoMes === ESTADOS_MES.SIN_TURNO);
  const sinTurnoPorSegmento = (s) => sinTurno.filter((p) => p.segmento === s).length;

  const ortodoncistas = useMemo(() => [...new Set(activos.map((p) => p.ortodoncista))].sort((a, b) => a.localeCompare(b, "es")), [activos]);
  const porOrtodoncista = useMemo(
    () =>
      ortodoncistas.map((nombre) => {
        const suyos = activos.filter((p) => p.ortodoncista === nombre);
        return {
          nombre,
          total: suyos.length,
          ...Object.fromEntries(Object.values(ESTADOS_MES).map((e) => [e, suyos.filter((p) => p.estadoMes === e).length])),
        };
      }),
    [ortodoncistas, activos]
  );

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return activos
      .filter((p) => estadoElegido === "todos" || p.estadoMes === estadoElegido)
      .filter((p) => segmento === "todos" || p.segmento === segmento)
      .filter((p) => ortodoncista === "todos" || p.ortodoncista === ortodoncista)
      .filter((p) => !q || p.nombre.toLowerCase().includes(q))
      .sort((a, b) => {
        const ordenEstados = Object.values(ESTADOS_MES);
        return (
          ordenEstados.indexOf(a.estadoMes) - ordenEstados.indexOf(b.estadoMes) ||
          (b.ultimoMovimiento || "").localeCompare(a.ultimoMovimiento || "") ||
          a.nombre.localeCompare(b.nombre, "es")
        );
      });
  }, [activos, estadoElegido, segmento, ortodoncista, busqueda]);

  function turnosDelMes(p) {
    return p.turnos.filter((t) => t.fecha.slice(0, 7) === mes).sort((a, b) => a.fecha.localeCompare(b.fecha));
  }

  function exportar() {
    descargarCSV(`ortodoncia-${mes}.csv`, [
      ["Paciente", "Ortodoncista", `Estado en ${nombreMes(mes)}`, "Turnos del mes", "Última visita en la app", "Último mes pago (cuaderno)", "Situación general", "Próximo turno"],
      ...visibles.map((p) => [
        p.nombre, p.ortodoncista, p.estadoMes,
        turnosDelMes(p).map((t) => `${formatoDiaMes(t.fecha)} (${t.situacion})`).join(" | "),
        formatoFecha(p.ultimaVisita), nombreMes(p.ultimoMesPago), p.segmento, formatoFecha(p.proximoTurno),
      ]),
    ]);
  }

  if (cargando) return <p className="mt-6 text-sm text-gray-500">Calculando...</p>;
  if (error) return <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>;

  const alternar = (e) => setEstadoElegido(estadoElegido === e ? "todos" : e);

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          Mes
          <input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1 text-sm" />
        </label>
        <p className="text-sm text-gray-600">
          <strong>{activos.length}</strong> pacientes activos
          {otrosEstados.length > 0 && <> · además: {otrosEstados.map(([e, n]) => `${n} ${e.toLowerCase()}`).join(", ")}</>}
        </p>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        Cada paciente cuenta en un solo grupo del mes. Una visita es un cobro, un turno marcado como presente o un &quot;qué se hizo&quot;
        del ortodoncista. La app tiene visitas desde el 26/8; antes de eso solo está el cuaderno.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tarjeta
          titulo={ESTADOS_MES.ASISTIO}
          valor={conteo(ESTADOS_MES.ASISTIO)}
          detalle={`Vinieron o pagaron en ${nombreMes(mes)}`}
          color="text-emerald-700"
          activa={estadoElegido === ESTADOS_MES.ASISTIO}
          onClick={() => alternar(ESTADOS_MES.ASISTIO)}
        />
        <Tarjeta
          titulo={ESTADOS_MES.FALTA_ASISTIR}
          valor={conteo(ESTADOS_MES.FALTA_ASISTIR)}
          detalle="Turno de hoy o futuro, todavía no vinieron"
          color="text-sky-700"
          activa={estadoElegido === ESTADOS_MES.FALTA_ASISTIR}
          onClick={() => alternar(ESTADOS_MES.FALTA_ASISTIR)}
        />
        <Tarjeta
          titulo={ESTADOS_MES.TURNO_SIN_ASISTIR}
          valor={conteo(ESTADOS_MES.TURNO_SIN_ASISTIR)}
          detalle="Tenían turno en el mes y no figuran como presentes"
          color="text-amber-700"
          activa={estadoElegido === ESTADOS_MES.TURNO_SIN_ASISTIR}
          onClick={() => alternar(ESTADOS_MES.TURNO_SIN_ASISTIR)}
        />
        <Tarjeta
          titulo={ESTADOS_MES.SIN_TURNO}
          valor={conteo(ESTADOS_MES.SIN_TURNO)}
          detalle={`${sinTurnoPorSegmento(SEGMENTOS.AL_DIA)} vinieron hace poco · ${sinTurnoPorSegmento(SEGMENTOS.SE_ALEJO)} se alejaron · ${sinTurnoPorSegmento(SEGMENTOS.SOLO_CUADERNO)} solo cuaderno · ${sinTurnoPorSegmento(SEGMENTOS.SIN_MOVIMIENTO)} sin movimiento`}
          color="text-red-700"
          activa={estadoElegido === ESTADOS_MES.SIN_TURNO}
          onClick={() => alternar(ESTADOS_MES.SIN_TURNO)}
        />
      </div>

      <h2 className="mt-6 text-sm font-semibold text-gray-700">Por ortodoncista — {nombreMes(mes)}</h2>
      <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="bg-brand-brown text-white">
              <th className="px-3 py-2 text-left font-semibold">Ortodoncista</th>
              <th className="px-3 py-2 text-right font-semibold">Activos</th>
              {Object.values(ESTADOS_MES).map((e) => (
                <th key={e} className="px-3 py-2 text-right font-semibold">{e}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {porOrtodoncista.map((o) => (
              <tr key={o.nombre} className="border-t border-gray-100">
                <td className="px-3 py-2 font-medium text-gray-900">{o.nombre}</td>
                <td className="px-3 py-2 text-right tabular-nums">{o.total}</td>
                {Object.values(ESTADOS_MES).map((e) => (
                  <td key={e} className="px-3 py-2 text-right tabular-nums text-gray-700">{o[e]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar paciente..." className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        <select value={estadoElegido} onChange={(e) => setEstadoElegido(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
          <option value="todos">Todos los grupos</option>
          {Object.values(ESTADOS_MES).map((e) => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>
        <select value={ortodoncista} onChange={(e) => setOrtodoncista(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
          <option value="todos">Todos los ortodoncistas</option>
          {ortodoncistas.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <select value={segmento} onChange={(e) => setSegmento(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" title="Hace cuánto no vienen">
          <option value="todos">Cualquier antigüedad</option>
          {Object.values(SEGMENTOS).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button onClick={exportar} className="ml-auto rounded-md border border-brand-brown/40 px-3 py-1.5 text-sm font-medium text-brand-brown hover:bg-brand-tan/30">
          ⬇️ Descargar Excel (CSV)
        </button>
      </div>

      <p className="mt-3 text-sm font-semibold text-gray-700">{visibles.length} paciente{visibles.length === 1 ? "" : "s"}</p>
      <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-[820px] border-collapse text-sm">
          <thead>
            <tr className="bg-brand-brown text-white">
              <th className="px-3 py-2 text-left font-semibold">Paciente</th>
              <th className="px-3 py-2 text-left font-semibold">Ortodoncista</th>
              <th className="px-3 py-2 text-left font-semibold">En {nombreMes(mes)}</th>
              <th className="px-3 py-2 text-left font-semibold">Turnos del mes</th>
              <th className="px-3 py-2 text-left font-semibold">Última visita (app)</th>
              <th className="px-3 py-2 text-left font-semibold">Antigüedad</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((p) => (
              <tr key={p.id} className="border-t border-gray-100">
                <td className="px-3 py-2 font-medium text-gray-900">{p.nombre}</td>
                <td className="px-3 py-2 text-gray-600">{p.ortodoncista}</td>
                <td className="px-3 py-2">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${ESTILO_ESTADO_MES[p.estadoMes]}`}>{p.estadoMes}</span>
                </td>
                <td className="px-3 py-2 text-xs text-gray-600">
                  {turnosDelMes(p).length === 0
                    ? "—"
                    : turnosDelMes(p).map((t) => (
                        <span key={t.fecha + t.situacion} className="mr-1 inline-block">
                          {formatoDiaMes(t.fecha)} <span className={`rounded px-1 py-0.5 ${ESTILO_ASISTENCIA[t.situacion]}`}>{t.situacion}</span>
                        </span>
                      ))}
                </td>
                <td className="whitespace-nowrap px-3 py-2 tabular-nums text-gray-600">
                  {p.ultimaVisita ? `${formatoFecha(p.ultimaVisita)} (hace ${p.diasDesdeUltimaVisita} d)` : p.ultimoMesPago ? `Cuaderno: ${nombreMes(p.ultimoMesPago)}` : "—"}
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${ESTILO_SEGMENTO[p.segmento]}`}>{p.segmento}</span>
                </td>
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

function formatoPesos(n) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

function VistaEvolucion() {
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    obtenerEvolucionMensualOrtodoncia()
      .then(setFilas)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  function etiquetaMes(f) {
    const [anio, mes] = f.mes.split("-");
    return `${NOMBRES_MES[Number(mes) - 1]} ${anio}`;
  }

  function exportar() {
    descargarCSV("evolucion-mensual-ortodoncia.csv", [
      ["Mes", "Pacientes con control pagado (cuaderno + app)", "Controles cobrados en la app", "Pacientes que pagaron control (app)", "Plata de controles", "Plata de instalaciones y continuaciones", "Otros cobros", "Total Ortodoncia", "Turnos asistidos", "No asistieron", "% asistencia", "Pacientes que vinieron"],
      ...filas.map((f) => [
        etiquetaMes(f) + (f.esParcial ? " (parcial)" : ""),
        f.pacientesControlPagado,
        f.tieneDatosApp ? f.controlesCobrados : "", f.tieneDatosApp ? f.pacientesQuePagaronControl : "",
        f.tieneDatosApp ? Math.round(f.plataControles) : "", f.tieneDatosApp ? Math.round(f.plataInstalaciones) : "",
        f.tieneDatosApp ? Math.round(f.plataOtros) : "", f.tieneDatosApp ? Math.round(f.plataTotal) : "",
        f.tieneDatosApp ? f.asistieron : "", f.tieneDatosApp ? f.noAsistieron : "", f.tasaAsistencia ?? "",
        f.tieneDatosApp ? f.pacientesQueVinieron : "",
      ]),
    ]);
  }

  if (cargando) return <p className="mt-6 text-sm text-gray-500">Calculando...</p>;
  if (error) return <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>;

  const maximo = Math.max(1, ...filas.map((f) => f.pacientesControlPagado));
  const sinDato = <span className="text-gray-300">—</span>;

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600">
          Mes a mes: cuántos pacientes pagan el control, cuánta plata entra a Ortodoncia y cómo es la asistencia.
        </p>
        <button onClick={exportar} className="rounded-md border border-brand-brown/40 px-3 py-1.5 text-sm font-medium text-brand-brown hover:bg-brand-tan/30">
          ⬇️ Descargar Excel (CSV)
        </button>
      </div>

      <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-[1000px] border-collapse text-sm">
          <thead>
            <tr className="bg-brand-brown text-white">
              <th className="px-3 py-2 text-left font-semibold">Mes</th>
              <th className="px-3 py-2 text-left font-semibold" title="Pacientes con el mes marcado como pago en la grilla de Controles (cuaderno + lo cobrado en la app)">
                Pacientes con control pagado
              </th>
              <th className="px-3 py-2 text-right font-semibold">Controles cobrados (app)</th>
              <th className="px-3 py-2 text-right font-semibold">Plata de controles</th>
              <th className="px-3 py-2 text-right font-semibold">Instalaciones y continuaciones</th>
              <th className="px-3 py-2 text-right font-semibold">Otros cobros</th>
              <th className="px-3 py-2 text-right font-semibold">Total Ortodoncia</th>
              <th className="px-3 py-2 text-right font-semibold">Turnos asistidos</th>
              <th className="px-3 py-2 text-right font-semibold">No asistieron</th>
              <th className="px-3 py-2 text-right font-semibold">% asistencia</th>
              <th className="px-3 py-2 text-right font-semibold">Pacientes que vinieron</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.mes} className="border-t border-gray-100">
                <td className="whitespace-nowrap px-3 py-2 font-medium text-gray-900">
                  {etiquetaMes(f)}
                  {f.esParcial && <span className="ml-1.5 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-800">parcial</span>}
                  {esMesDePrueba(Number(f.mes.slice(0, 4)), Number(f.mes.slice(5))) && (
                    <span className="ml-1.5 rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-700" title="Mes de prueba de la app">prueba</span>
                  )}
                  {f.mes === "2026-08" && <span className="ml-1.5 text-[10px] text-gray-500">(app desde 26/8)</span>}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="w-8 text-right font-semibold tabular-nums">{f.pacientesControlPagado}</span>
                    <span className="h-2 rounded bg-brand-brown/60" style={{ width: `${Math.round((f.pacientesControlPagado / maximo) * 90)}px` }} />
                  </div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{f.tieneDatosApp ? f.controlesCobrados : sinDato}</td>
                <td className="px-3 py-2 text-right tabular-nums">{f.tieneDatosApp ? formatoPesos(f.plataControles) : sinDato}</td>
                <td className="px-3 py-2 text-right tabular-nums">{f.tieneDatosApp ? formatoPesos(f.plataInstalaciones) : sinDato}</td>
                <td className="px-3 py-2 text-right tabular-nums">{f.tieneDatosApp ? formatoPesos(f.plataOtros) : sinDato}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">{f.tieneDatosApp ? formatoPesos(f.plataTotal) : sinDato}</td>
                <td className="px-3 py-2 text-right tabular-nums">{f.tieneDatosApp ? f.asistieron : sinDato}</td>
                <td className="px-3 py-2 text-right tabular-nums">{f.tieneDatosApp ? f.noAsistieron : sinDato}</td>
                <td className="px-3 py-2 text-right tabular-nums">{f.tasaAsistencia !== null ? `${f.tasaAsistencia}%` : sinDato}</td>
                <td className="px-3 py-2 text-right tabular-nums">{f.tieneDatosApp ? f.pacientesQueVinieron : sinDato}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="mt-3 list-disc pl-5 text-xs text-gray-500">
        <li>
          <strong>Pacientes con control pagado</strong> sale de la grilla de Controles: incluye el cuaderno (junio y julio, agosto en parte)
          y lo que se cobró en la app. Es la única columna que tiene historia antes del 26/8.
        </li>
        <li>La plata y los turnos son de la app: empiezan a fines de agosto, así que agosto está incompleto. Septiembre fue mes de prueba.</li>
        <li>El mes en curso es parcial (hasta hoy), no se puede comparar de igual a igual con los meses cerrados.</li>
        <li>
          <strong>Total Ortodoncia</strong> incluye controles, instalaciones, continuaciones, consultas, reposiciones y pagos adelantados
          (la plata que entró ese mes a la caja de Ortodoncia).
        </li>
      </ul>
    </>
  );
}

function PaginaSeguimiento() {
  const [vista, setVista] = useState("mes");
  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">🦷 Seguimiento de Ortodoncia</h1>
      <p className="mt-0.5 text-sm text-gray-500">Solo para las dueñas: quién ya vino este mes, a quién le falta venir y a quién hay que escribirle.</p>
      <div className="mt-4 flex overflow-hidden rounded-md border border-gray-300 text-sm sm:w-fit">
        <button
          onClick={() => setVista("mes")}
          className={`px-4 py-1.5 ${vista === "mes" ? "bg-brand-brown text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
        >
          Pacientes del mes
        </button>
        <button
          onClick={() => setVista("asistencia")}
          className={`px-4 py-1.5 ${vista === "asistencia" ? "bg-brand-brown text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
        >
          Asistencia a los turnos
        </button>
        <button
          onClick={() => setVista("evolucion")}
          className={`px-4 py-1.5 ${vista === "evolucion" ? "bg-brand-brown text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
        >
          Evolución mes a mes
        </button>
        <button
          onClick={() => setVista("cobros")}
          className={`px-4 py-1.5 ${vista === "cobros" ? "bg-brand-brown text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
        >
          💰 Control de cobros
        </button>
      </div>
      {vista === "mes" ? <VistaMes /> : vista === "asistencia" ? <VistaAsistencia /> : vista === "cobros" ? <ControlCobrosOrtodoncia /> : <VistaEvolucion />}
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
