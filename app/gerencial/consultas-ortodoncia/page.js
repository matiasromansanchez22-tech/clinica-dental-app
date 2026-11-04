"use client";

import { useEffect, useMemo, useState } from "react";
import SoloDuena from "@/components/SoloDuena";
import { fechaDeHoyISO } from "@/lib/agenda";
import { DIAS_PARA_CONTACTAR, SITUACIONES, obtenerResumenConsultas } from "@/lib/data/resumenConsultasOrtodoncia";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const nombreMes = (mes) => `${MESES[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`;
const formatoFecha = (f) => (f ? f.split("-").reverse().join("/") : "—");
const pesos = (n) => `$${Math.round(Number(n) || 0).toLocaleString("es-AR")}`;

function sumarMeses(mes, delta) {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(a, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const ESTILO_SITUACION = {
  [SITUACIONES.VINO]: "bg-emerald-100 text-emerald-800",
  [SITUACIONES.POR_VENIR]: "bg-sky-100 text-sky-800",
  [SITUACIONES.SIN_MARCAR]: "bg-amber-100 text-amber-800",
  [SITUACIONES.CANCELO]: "bg-gray-100 text-gray-600",
};
const ESTILO_RESULTADO = {
  Instaló: "text-emerald-700 font-semibold",
  "Instalación agendada": "text-emerald-700",
  "Ya está en tratamiento": "text-emerald-700",
  "Quiere instalar": "text-emerald-600",
  "Lo está pensando": "text-violet-700",
  "Mensaje enviado": "text-sky-700",
  "Sin respuesta": "text-amber-700",
  "Por contactar": "text-red-700 font-semibold",
  "No va a hacer ortodoncia": "text-gray-500",
};

function Cifra({ titulo, valor, ayuda, tono }) {
  const color = tono === "mal" ? "border-red-300 bg-red-50" : tono === "ok" ? "border-emerald-200 bg-emerald-50" : tono === "aviso" ? "border-amber-300 bg-amber-50" : "border-gray-200 bg-white";
  return (
    <div className={`rounded-lg border px-3 py-2 ${color}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{titulo}</p>
      <p className="text-xl font-bold tabular-nums text-gray-900">{valor}</p>
      {ayuda && <p className="text-[11px] text-gray-500">{ayuda}</p>}
    </div>
  );
}

function celdaCSV(v) {
  const t = String(v ?? "");
  return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

function ContenidoConsultas() {
  const hoy = fechaDeHoyISO();
  const [mes, setMes] = useState(hoy.slice(0, 7));
  const [estado, setEstado] = useState({ mes: null, datos: null, error: null });
  const [filtro, setFiltro] = useState("todas");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    let activo = true;
    obtenerResumenConsultas(mes)
      .then((datos) => activo && setEstado({ mes, datos, error: null }))
      .catch((e) => activo && setEstado({ mes, datos: null, error: e.message }));
    return () => {
      activo = false;
    };
  }, [mes]);

  const cargando = estado.mes !== mes;
  const datos = cargando ? null : estado.datos;

  const FILTROS = [
    ["todas", "Todas"],
    ["vinieron", "Vinieron"],
    ["atrasadas", "Falta contactar"],
    ["sinCaja", "Sin registrar en Caja"],
    ["pendientes", "Con seguimiento abierto"],
    ["noVinieron", "No vinieron"],
  ];

  const visibles = useMemo(() => {
    if (!datos) return [];
    const q = busqueda.trim().toLowerCase();
    return datos.consultas.filter((c) => {
      if (q && !c.nombre.toLowerCase().includes(q)) return false;
      switch (filtro) {
        case "vinieron":
          return c.situacion === SITUACIONES.VINO;
        case "atrasadas":
          return c.atrasado;
        case "sinCaja":
          return c.sinRegistrarEnCaja;
        case "pendientes":
          return c.situacion === SITUACIONES.VINO && ["Por contactar", "Mensaje enviado", "Sin respuesta", "Lo está pensando", "Quiere instalar"].includes(c.resultado);
        case "noVinieron":
          return c.situacion !== SITUACIONES.VINO && c.situacion !== SITUACIONES.POR_VENIR;
        default:
          return true;
      }
    });
  }, [datos, filtro, busqueda]);

  function descargar() {
    const lineas = [["Mes", "Paciente", "WhatsApp", "Ortodoncista", "Fecha de la consulta", "Situación", "Registrada en Caja", "Importe", "Resultado", "Instalación (fecha)", "Último contacto", "Días desde la consulta", "Nota"]];
    for (const c of datos.consultas)
      lineas.push([
        nombreMes(mes), c.nombre, c.whatsapp, c.ortodoncista, formatoFecha(c.fechaConsulta), c.situacion,
        c.registrada ? (c.gratis ? "Sí (gratis)" : "Sí (paga)") : "No", c.registrada ? c.importe : "", c.resultado || "",
        formatoFecha(c.instalo || c.instalacionAgendada), formatoFecha(c.fechaUltimoContacto), c.diasDesde ?? "", c.nota,
      ]);
    const contenido = "﻿" + lineas.map((l) => l.map(celdaCSV).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([contenido], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `consultas-ortodoncia-${mes}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const t = datos?.totales;
  const e = datos?.embudo;
  const conversion = e && e.vinieron ? Math.round(((e.instalaron + e.agendaron) / e.vinieron) * 100) : 0;
  const esPromo = mes === "2026-11";

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">📊 Consultas de ortodoncia</h1>
      <p className="mt-0.5 text-sm text-gray-500">
        Cuántas consultas hubo en el mes, si quedaron registradas en Caja, qué pasó después (instaló, agendó, lo piensa) y a quién falta contactar.
        {esPromo && " Noviembre 2026: consultas gratis."}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2 print:hidden">
        <button onClick={() => setMes(sumarMeses(mes, -1))} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50">
          ← Mes anterior
        </button>
        <span className="min-w-[9rem] text-center font-heading text-lg font-bold capitalize text-brand-brown">{nombreMes(mes)}</span>
        <button onClick={() => setMes(sumarMeses(mes, 1))} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50">
          Mes siguiente →
        </button>
        {mes !== hoy.slice(0, 7) && (
          <button onClick={() => setMes(hoy.slice(0, 7))} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50">
            Este mes
          </button>
        )}
        <button onClick={descargar} disabled={!datos || datos.consultas.length === 0} className="ml-auto rounded-md bg-brand-brown px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
          ⬇ Descargar para Excel
        </button>
      </div>

      {estado.error && <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{estado.error}</div>}
      {cargando && <p className="mt-4 text-sm text-gray-500">Calculando...</p>}

      {datos && (
        <>
          {(t.sinRegistrarEnCaja > 0 || t.atrasadas > 0 || t.sinMarcar > 0) && (
            <div className="mt-4 space-y-1.5">
              {t.sinRegistrarEnCaja > 0 && (
                <button onClick={() => setFiltro("sinCaja")} className="block w-full rounded-md border border-red-300 bg-red-50 px-3 py-2 text-left text-sm text-red-900">
                  ⚠ <strong>{t.sinRegistrarEnCaja}</strong> {t.sinRegistrarEnCaja === 1 ? "consulta vino y no está registrada" : "consultas vinieron y no están registradas"} en Caja. Hay que cargarlas
                  (aunque sean gratis, en $0) para llevar la cuenta.
                </button>
              )}
              {t.atrasadas > 0 && (
                <button onClick={() => setFiltro("atrasadas")} className="block w-full rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-left text-sm text-amber-900">
                  ⚠ <strong>{t.atrasadas}</strong> {t.atrasadas === 1 ? "paciente vino y hace" : "pacientes vinieron y hace"} {DIAS_PARA_CONTACTAR} días o más que nadie los contacta.
                </button>
              )}
              {t.sinMarcar > 0 && (
                <button onClick={() => setFiltro("noVinieron")} className="block w-full rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-left text-sm text-amber-900">
                  ⚠ <strong>{t.sinMarcar}</strong> {t.sinMarcar === 1 ? "turno de consulta pasó" : "turnos de consulta pasaron"} sin marcar si el paciente vino. Revisar la agenda.
                </button>
              )}
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Cifra titulo="Pacientes con consulta" valor={t.pacientes} ayuda={`${t.porVenir} todavía por venir`} />
            <Cifra titulo="Vinieron" valor={t.vinieron} ayuda={t.pacientes - t.porVenir > 0 ? `${Math.round((t.vinieron / (t.pacientes - t.porVenir)) * 100)}% de las que ya pasaron` : ""} tono="ok" />
            <Cifra titulo="No vinieron o canceló" valor={t.sinMarcar + t.cancelaron} ayuda={`${t.sinMarcar} sin marcar · ${t.cancelaron} canceló o reprogramó`} />
            <Cifra titulo="Registradas en Caja" valor={`${t.gratis + t.pagas} de ${t.vinieron}`} ayuda={`${t.gratis} gratis · ${t.pagas} pagas`} tono={t.sinRegistrarEnCaja ? "mal" : "ok"} />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Cifra titulo="Consultas gratis" valor={t.gratis} ayuda={`Valor regalado: ${pesos(t.valorRegalado)} (a ${pesos(datos.precioNormal)} c/u)`} />
            <Cifra titulo="Instalaron" valor={e.instalaron} ayuda="Con cobro de instalación" tono="ok" />
            <Cifra titulo="Instalación agendada o ya en tratamiento" valor={e.agendaron} tono="ok" />
            <Cifra titulo="Conversión" valor={`${conversion}%`} ayuda={`${e.instalaron + e.agendaron} de ${e.vinieron} que vinieron`} />
          </div>

          <section className="mt-6">
            <h2 className="text-lg font-bold text-brand-brown">¿Qué pasó con los que vinieron?</h2>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {[
                ["Instaló", e.instalaron, "bg-emerald-100 text-emerald-900"],
                ["Instalación agendada", e.agendaron, "bg-emerald-50 text-emerald-900"],
                ["Quiere instalar", e.quiereInstalar, "bg-emerald-50 text-emerald-800"],
                ["Lo está pensando", e.loPiensa, "bg-violet-50 text-violet-900"],
                ["Mensaje enviado", e.mensajeEnviado, "bg-sky-50 text-sky-900"],
                ["Sin respuesta", e.sinRespuesta, "bg-amber-50 text-amber-900"],
                ["Por contactar", e.porContactar, e.porContactar ? "bg-red-100 text-red-900" : "bg-gray-50 text-gray-700"],
              ].map(([texto, n, clase]) => (
                <div key={texto} className={`rounded-lg px-3 py-2 ${clase}`}>
                  <p className="text-2xl font-bold tabular-nums">{n}</p>
                  <p className="text-[11px] font-medium">{texto}</p>
                </div>
              ))}
            </div>
            {e.noVaAHacer > 0 && <p className="mt-1 text-xs text-gray-500">{e.noVaAHacer} dijo que no va a hacer ortodoncia.</p>}
          </section>

          {datos.porOrtodoncista.length > 0 && (
            <section className="mt-6">
              <h2 className="text-lg font-bold text-brand-brown">Por ortodoncista</h2>
              <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200 bg-white">
                <table className="w-full min-w-[480px] border-collapse text-sm">
                  <thead>
                    <tr className="bg-brand-brown text-white">
                      <th className="px-3 py-2 text-left font-semibold">Ortodoncista</th>
                      <th className="px-3 py-2 text-right font-semibold">Consultas</th>
                      <th className="px-3 py-2 text-right font-semibold">Vinieron</th>
                      <th className="px-3 py-2 text-right font-semibold">Instalaron</th>
                      <th className="px-3 py-2 text-right font-semibold">Agendadas o en tratamiento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.porOrtodoncista.map((o) => (
                      <tr key={o.nombre} className="border-t border-gray-100">
                        <td className="px-3 py-2 font-medium text-gray-900">{o.nombre}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{o.agendadas}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{o.vinieron}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{o.instalaron}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{o.agendaron}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="mt-6">
            <h2 className="text-lg font-bold text-brand-brown">Cada paciente</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 print:hidden">
              <div className="flex flex-wrap overflow-hidden rounded-md border border-gray-300 text-sm">
                {FILTROS.map(([clave, texto]) => (
                  <button key={clave} onClick={() => setFiltro(clave)} className={`px-3 py-1.5 ${filtro === clave ? "bg-brand-brown text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}>
                    {texto}
                  </button>
                ))}
              </div>
              <input
                value={busqueda}
                onChange={(ev) => setBusqueda(ev.target.value)}
                placeholder="Buscar paciente..."
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
              <span className="text-xs text-gray-500">{visibles.length} pacientes</span>
            </div>
            <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200 bg-white">
              <table className="w-full min-w-[820px] border-collapse text-sm">
                <thead>
                  <tr className="bg-brand-brown text-white">
                    <th className="px-3 py-2 text-left font-semibold">Fecha</th>
                    <th className="px-3 py-2 text-left font-semibold">Paciente</th>
                    <th className="px-3 py-2 text-left font-semibold">Ortodoncista</th>
                    <th className="px-3 py-2 text-left font-semibold">Consulta</th>
                    <th className="px-3 py-2 text-left font-semibold">En Caja</th>
                    <th className="px-3 py-2 text-left font-semibold">Qué pasó</th>
                    <th className="px-3 py-2 text-left font-semibold">Último contacto</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-4 text-center text-gray-500">
                        No hay pacientes con este filtro.
                      </td>
                    </tr>
                  )}
                  {visibles.map((c) => (
                    <tr key={c.pacienteId} className={`border-t border-gray-100 align-top ${c.atrasado ? "bg-amber-50" : ""}`}>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-gray-800">{formatoFecha(c.fechaConsulta)}</td>
                      <td className="px-3 py-2 font-medium text-gray-900">
                        {c.nombre}
                        {c.whatsapp ? <span className="block text-[11px] font-normal text-gray-500">{c.whatsapp}</span> : <span className="block text-[11px] font-normal text-red-600">sin WhatsApp</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{c.ortodoncista}</td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ESTILO_SITUACION[c.situacion]}`}>{c.situacion}</span>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {c.registrada ? (
                          <span className="text-emerald-700">{c.gratis ? "✓ Gratis ($0)" : `✓ ${pesos(c.importe)}`}</span>
                        ) : c.situacion === SITUACIONES.VINO ? (
                          <span className="font-semibold text-red-700">⚠ Sin registrar</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className={`px-3 py-2 text-xs ${c.resultado ? ESTILO_RESULTADO[c.resultado] || "" : "text-gray-400"}`}>
                        {c.resultado || "—"}
                        {c.instalo && <span className="block font-normal text-gray-500">el {formatoFecha(c.instalo)}</span>}
                        {!c.instalo && c.instalacionAgendada && <span className="block font-normal text-gray-500">para el {formatoFecha(c.instalacionAgendada)}</span>}
                        {c.atrasado && <span className="block font-semibold text-amber-800">hace {c.diasDesde} días sin contactar</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600">
                        {c.fechaUltimoContacto ? formatoFecha(c.fechaUltimoContacto) : "—"}
                        {c.nota && <span className="block text-[11px] text-gray-500">{c.nota}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              El seguimiento de cada paciente (mensajes, si lo piensa, si no va a hacer) se carga en Ortodoncia → Consultas. Esta pantalla solo lo suma y lo controla.
            </p>
          </section>
        </>
      )}
    </main>
  );
}

export default function ConsultasOrtodonciaPage() {
  return (
    <SoloDuena>
      <ContenidoConsultas />
    </SoloDuena>
  );
}
