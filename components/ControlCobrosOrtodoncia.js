"use client";

import { useEffect, useMemo, useState } from "react";
import { fechaDeHoyISO } from "@/lib/agenda";
import { TIPOS_CONTROL, obtenerControlCobrosOrtodoncia } from "@/lib/data/controlCobrosOrtodoncia";

const NOMBRES_MES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function pesos(n) {
  return `$${Math.round(Number(n) || 0).toLocaleString("es-AR")}`;
}

function formatoDiaMes(fechaISO) {
  const [, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}`;
}

function nombreMes(mesISO) {
  const [anio, mes] = mesISO.split("-");
  return `${NOMBRES_MES[Number(mes) - 1]} ${anio}`;
}

function celdaCSV(valor) {
  const texto = String(valor ?? "");
  return /[;"\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

const ESTILO_TIPO = {
  [TIPOS_CONTROL.SIN_PAGO]: "bg-red-100 text-red-800",
  [TIPOS_CONTROL.DE_MENOS]: "bg-amber-100 text-amber-800",
  [TIPOS_CONTROL.DE_MAS]: "bg-violet-100 text-violet-800",
  [TIPOS_CONTROL.OK]: "bg-emerald-100 text-emerald-800",
  [TIPOS_CONTROL.POR_VENIR]: "bg-sky-100 text-sky-800",
  [TIPOS_CONTROL.NO_VINO]: "bg-gray-100 text-gray-700",
  [TIPOS_CONTROL.COBRO_SIN_VISITA]: "bg-orange-100 text-orange-800",
  [TIPOS_CONTROL.SIN_VALOR]: "bg-gray-100 text-gray-700",
};

function Tarjeta({ titulo, valor, detalle, color, activa, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`rounded-lg border px-4 py-3 text-left transition ${activa ? "border-brand-brown bg-brand-tan/30" : "border-gray-200 bg-white"} ${onClick ? "hover:bg-gray-50" : "cursor-default"}`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{titulo}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${color || "text-gray-900"}`}>{valor}</p>
      {detalle && <p className="mt-0.5 text-xs text-gray-500">{detalle}</p>}
    </button>
  );
}

// Control de cobros de Ortodoncia: turnos de Control del mes contra lo que debería cobrarse y lo registrado en caja.
export default function ControlCobrosOrtodoncia() {
  const [mes, setMes] = useState(fechaDeHoyISO().slice(0, 7));
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [tipo, setTipo] = useState("todos");
  const [ortodoncista, setOrtodoncista] = useState("todos");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    setCargando(true);
    setError(null);
    obtenerControlCobrosOrtodoncia(mes)
      .then(setDatos)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [mes]);

  const ortodoncistas = useMemo(() => (datos ? [...new Set(datos.filas.map((f) => f.ortodoncista))].sort((a, b) => a.localeCompare(b, "es")) : []), [datos]);
  const visibles = useMemo(() => {
    if (!datos) return [];
    const q = busqueda.trim().toLowerCase();
    return datos.filas
      .filter((f) => tipo === "todos" || f.tipo === tipo)
      .filter((f) => ortodoncista === "todos" || f.ortodoncista === ortodoncista)
      .filter((f) => !q || f.paciente.toLowerCase().includes(q));
  }, [datos, tipo, ortodoncista, busqueda]);

  function exportar() {
    const filas = [
      ["Paciente", "Ortodoncista", "Turnos de Control del mes", "Vino", "Debería cobrarse", "Cobrado en controles", "Diferencia", "Situación"],
      ...visibles.map((f) => [
        f.paciente, f.ortodoncista, f.turnos.map((t) => `${formatoDiaMes(t.fecha)} ${t.situacion}`).join(" | "),
        f.asistio, Math.round(f.esperado), Math.round(f.cobrado), Math.round(f.diferencia), f.tipo,
      ]),
    ];
    const url = URL.createObjectURL(new Blob(["﻿" + filas.map((l) => l.map(celdaCSV).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `control-cobros-ortodoncia-${mes}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const r = datos?.resumen;
  const alternar = (t) => setTipo(tipo === t ? "todos" : t);

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          Mes
          <input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1 text-sm" />
        </label>
        <p className="text-xs text-gray-500">
          Compara los turnos de <strong>Control</strong> de {nombreMes(mes)} con lo que debería cobrarse (valor de control de la ficha, con aumento si
          correspondía) y lo registrado en Caja Ortodoncia.
        </p>
      </div>

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
      {cargando || !r ? (
        <p className="mt-6 text-sm text-gray-500">Calculando...</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tarjeta
              titulo="Controles del mes"
              valor={r.turnosControl}
              detalle={`${r.asistieron} vinieron · ${r.porVenir} por venir`}
            />
            <Tarjeta
              titulo="Deberíamos tener"
              valor={pesos(r.esperadoAsistidos + r.esperadoPorVenir)}
              detalle={`${pesos(r.esperadoAsistidos)} de los que vinieron + ${pesos(r.esperadoPorVenir)} de los que faltan venir`}
            />
            <Tarjeta titulo="Cobrado en controles" valor={pesos(r.cobradoControles)} color="text-emerald-700" detalle="Registrado en Caja Ortodoncia este mes" />
            <Tarjeta
              titulo="Plata que no figura"
              valor={pesos(r.sinPago.monto + r.deMenos.monto)}
              color={r.sinPago.monto + r.deMenos.monto > 0 ? "text-red-700" : "text-emerald-700"}
              detalle={`${pesos(r.sinPago.monto)} de vinieron sin pago + ${pesos(r.deMenos.monto)} cobrados de menos`}
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tarjeta
              titulo={TIPOS_CONTROL.SIN_PAGO}
              valor={r.sinPago.cantidad}
              color="text-red-700"
              detalle={pesos(r.sinPago.monto)}
              activa={tipo === TIPOS_CONTROL.SIN_PAGO}
              onClick={() => alternar(TIPOS_CONTROL.SIN_PAGO)}
            />
            <Tarjeta
              titulo={TIPOS_CONTROL.DE_MENOS}
              valor={r.deMenos.cantidad}
              color="text-amber-700"
              detalle={pesos(r.deMenos.monto)}
              activa={tipo === TIPOS_CONTROL.DE_MENOS}
              onClick={() => alternar(TIPOS_CONTROL.DE_MENOS)}
            />
            <Tarjeta
              titulo={TIPOS_CONTROL.COBRO_SIN_VISITA}
              valor={r.cobroSinVisita.cantidad}
              color="text-orange-700"
              detalle={`${pesos(r.cobroSinVisita.monto)} · revisar si vinieron y falta marcarlo`}
              activa={tipo === TIPOS_CONTROL.COBRO_SIN_VISITA}
              onClick={() => alternar(TIPOS_CONTROL.COBRO_SIN_VISITA)}
            />
            <Tarjeta
              titulo={TIPOS_CONTROL.DE_MAS}
              valor={r.deMas.cantidad}
              color="text-violet-700"
              detalle={`${pesos(r.deMas.monto)} de más: suele ser un bracket o un cargo extra`}
              activa={tipo === TIPOS_CONTROL.DE_MAS}
              onClick={() => alternar(TIPOS_CONTROL.DE_MAS)}
            />
          </div>

          <ul className="mt-3 list-disc pl-5 text-xs text-gray-500">
            <li>
              <strong>Vino y no figura el pago:</strong> el paciente asistió a su Control y no hay cobro ni pago marcado ese mes en la grilla de Controles. Es lo
              primero para revisar: puede ser plata que no se registró.
            </li>
            <li>
              <strong>Cobrado de menos:</strong> el cobro de Control es menor al valor de su ficha (con aumento). Puede ser un descuento autorizado o un saldo a favor aplicado.
            </li>
            <li>
              <strong>Cobrado de más:</strong> se cobró más que el control. Normalmente es un bracket despegado o un cargo extra; se muestra para que se pueda revisar.
            </li>
            <li>
              Un pago adelantado de varios controles cubre los meses siguientes (queda marcado en la grilla), por eso esos pacientes no aparecen como &quot;sin pago&quot;.
              {r.sinValor > 0 && ` Hay ${r.sinValor} paciente${r.sinValor === 1 ? "" : "s"} sin valor de control cargado: no se puede calcular qué debería cobrarse.`}
            </li>
            {!r.mesCerrado && <li>El mes todavía no terminó: &quot;Deberíamos tener&quot; incluye lo que falta venir si todos asisten.</li>}
          </ul>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar paciente..." className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
              <option value="todos">Todas las situaciones</option>
              {Object.values(TIPOS_CONTROL).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <select value={ortodoncista} onChange={(e) => setOrtodoncista(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
              <option value="todos">Todos los ortodoncistas</option>
              {ortodoncistas.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <button onClick={exportar} className="ml-auto rounded-md border border-brand-brown/40 px-3 py-1.5 text-sm font-medium text-brand-brown hover:bg-brand-tan/30">
              ⬇️ Descargar Excel (CSV)
            </button>
          </div>

          <p className="mt-3 text-sm font-semibold text-gray-700">
            {visibles.length} paciente{visibles.length === 1 ? "" : "s"}
          </p>
          <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead>
                <tr className="bg-brand-brown text-white">
                  <th className="px-3 py-2 text-left font-semibold">Paciente</th>
                  <th className="px-3 py-2 text-left font-semibold">Turnos de Control</th>
                  <th className="px-3 py-2 text-right font-semibold">Debería cobrarse</th>
                  <th className="px-3 py-2 text-right font-semibold">Cobrado</th>
                  <th className="px-3 py-2 text-right font-semibold">Diferencia</th>
                  <th className="px-3 py-2 text-left font-semibold">Situación</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((f) => (
                  <tr key={f.id} className="border-t border-gray-100 align-top">
                    <td className="px-3 py-2">
                      <p className="font-medium text-gray-900">{f.paciente}</p>
                      <p className="text-xs text-gray-500">{f.ortodoncista}</p>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600">
                      {f.turnos.length === 0
                        ? "—"
                        : f.turnos.map((t) => (
                            <span key={t.fecha + t.hora} className="mr-1.5 inline-block">
                              {formatoDiaMes(t.fecha)} {t.hora} · {t.situacion}
                            </span>
                          ))}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-700">{f.esperado ? pesos(f.esperado) : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-700">
                      {f.cobrado || f.cobradoTotal ? pesos(f.cobrado || f.cobradoTotal) : f.coberturaPorGrilla ? <span className="text-xs text-gray-500">pagado antes</span> : "—"}
                    </td>
                    <td className={`px-3 py-2 text-right font-semibold tabular-nums ${f.tipo === TIPOS_CONTROL.SIN_PAGO || f.tipo === TIPOS_CONTROL.DE_MENOS ? "text-red-700" : "text-gray-500"}`}>
                      {f.diferencia ? pesos(f.diferencia) : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${ESTILO_TIPO[f.tipo]}`}>{f.tipo}</span>
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
