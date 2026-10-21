"use client";

import { useEffect, useMemo, useState } from "react";
import { fechaDeHoyISO } from "@/lib/agenda";
import {
  ESTADOS_INSTALACION,
  INICIO_APP_INSTALACIONES,
  RESULTADOS_REVISION,
  guardarRevisionInstalacion,
  obtenerControlInstalacionesOrtodoncia,
} from "@/lib/data/controlInstalacionesOrtodoncia";

function pesos(n) {
  return `$${Math.round(Number(n) || 0).toLocaleString("es-AR")}`;
}

function formatoFecha(fechaISO) {
  if (!fechaISO) return "—";
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}

function celdaCSV(valor) {
  const texto = String(valor ?? "");
  return /[;"\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

const ESTILO_ESTADO = {
  [ESTADOS_INSTALACION.SIN_PAGO]: "bg-red-100 text-red-800",
  [ESTADOS_INSTALACION.SEGUNDA_CUOTA]: "bg-amber-100 text-amber-800",
  [ESTADOS_INSTALACION.PRIMERA_CUOTA]: "bg-sky-100 text-sky-800",
  [ESTADOS_INSTALACION.DE_MENOS]: "bg-orange-100 text-orange-800",
  [ESTADOS_INSTALACION.COMPLETA]: "bg-emerald-100 text-emerald-800",
  [ESTADOS_INSTALACION.COMPLETA_MENOS]: "bg-violet-100 text-violet-800",
  [ESTADOS_INSTALACION.AGENDADA]: "bg-gray-100 text-gray-700",
  [ESTADOS_INSTALACION.SIN_REFERENCIA]: "bg-gray-100 text-gray-700",
  [ESTADOS_INSTALACION.REVISADA]: "bg-gray-200 text-gray-700",
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

// Control de instalaciones: qué pagó cada paciente instalado contra el precio de lista.
export default function ControlInstalacionesOrtodoncia() {
  const [desde, setDesde] = useState(INICIO_APP_INSTALACIONES);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [estado, setEstado] = useState("todos");
  const [ortodoncista, setOrtodoncista] = useState("todos");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    setCargando(true);
    setError(null);
    obtenerControlInstalacionesOrtodoncia(desde)
      .then(setDatos)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [desde]);

  const ortodoncistas = useMemo(() => (datos ? [...new Set(datos.filas.map((f) => f.ortodoncista))].sort((a, b) => a.localeCompare(b, "es")) : []), [datos]);
  const visibles = useMemo(() => {
    if (!datos) return [];
    const q = busqueda.trim().toLowerCase();
    return datos.filas
      .filter((f) => estado === "todos" || f.estado === estado)
      .filter((f) => ortodoncista === "todos" || f.ortodoncista === ortodoncista)
      .filter((f) => !q || f.paciente.toLowerCase().includes(q));
  }, [datos, estado, ortodoncista, busqueda]);

  function exportar() {
    const filas = [
      ["Paciente", "Ortodoncista", "Instalación", "Hecha", "Brackets", "Forma de pago", "Precio de lista", "Pagado", "Falta", "Pagos", "Situación"],
      ...visibles.map((f) => [
        f.paciente, f.ortodoncista, formatoFecha(f.fechaInstalacion), f.hecha ? "Sí" : "Agendada", f.tipoBrackets || "", f.formaPago || "",
        Math.round(f.referencia || 0), Math.round(f.pagado), Math.round(f.falta),
        f.pagos.map((p) => `${formatoFecha(p.fecha)} ${Math.round(p.importe)}`).join(" | "), f.estado,
      ]),
    ];
    const url = URL.createObjectURL(new Blob(["﻿" + filas.map((l) => l.map(celdaCSV).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "control-instalaciones-ortodoncia.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function revisar(id, resultado) {
    setError(null);
    try {
      const guardada = await guardarRevisionInstalacion(id, resultado, null);
      // Se recarga para que las tarjetas y la situación reflejen la revisión.
      setDatos(await obtenerControlInstalacionesOrtodoncia(desde));
      return guardada;
    } catch (e) {
      setError(e.message.includes("revision_instalaciones") ? "Falta activar las revisiones (migración 162)." : e.message);
    }
  }

  const r = datos?.resumen;
  const alternar = (e) => setEstado(estado === e ? "todos" : e);
  const hoy = fechaDeHoyISO();

  return (
    <>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          Instalaciones desde
          <input type="date" value={desde} max={hoy} onChange={(e) => e.target.value && setDesde(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1 text-sm" />
        </label>
        <button onClick={() => setDesde(INICIO_APP_INSTALACIONES)} className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50">
          Todo desde que arrancó la app
        </button>
        <button onClick={() => setDesde(`${hoy.slice(0, 7)}-01`)} className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50">
          Este mes
        </button>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        Para cada paciente que se instaló (o tiene la instalación agendada): lo que pagó de la instalación contra el precio de lista de su tipo de brackets y forma de pago.
      </p>

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
      {cargando || !r ? (
        <p className="mt-6 text-sm text-gray-500">Calculando...</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tarjeta titulo="Instalaciones hechas" valor={r.instalaciones} detalle={`${r.agendadas} más agendadas por venir`} />
            <Tarjeta
              titulo="Pagado de las instalaciones"
              valor={pesos(r.pagadoTotal)}
              color="text-emerald-700"
              detalle={`Precio de lista: ${pesos(r.referenciaTotal)} (los que tienen brackets y forma de pago cargados)`}
            />
            <Tarjeta
              titulo={ESTADOS_INSTALACION.SIN_PAGO}
              valor={r.sinPago}
              color={r.sinPago > 0 ? "text-red-700" : "text-emerald-700"}
              detalle="Lo primero para revisar"
              activa={estado === ESTADOS_INSTALACION.SIN_PAGO}
              onClick={() => alternar(ESTADOS_INSTALACION.SIN_PAGO)}
            />
            <Tarjeta
              titulo={ESTADOS_INSTALACION.SEGUNDA_CUOTA}
              valor={r.segundaCuota.cantidad}
              color="text-amber-700"
              detalle={`${pesos(r.segundaCuota.monto)} por cobrar (pasaron más de 30 días)`}
              activa={estado === ESTADOS_INSTALACION.SEGUNDA_CUOTA}
              onClick={() => alternar(ESTADOS_INSTALACION.SEGUNDA_CUOTA)}
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tarjeta
              titulo={ESTADOS_INSTALACION.DE_MENOS}
              valor={r.deMenos.cantidad}
              color="text-orange-700"
              detalle={`${pesos(r.deMenos.monto)} menos que el precio de lista (contado)`}
              activa={estado === ESTADOS_INSTALACION.DE_MENOS}
              onClick={() => alternar(ESTADOS_INSTALACION.DE_MENOS)}
            />
            <Tarjeta
              titulo={ESTADOS_INSTALACION.COMPLETA_MENOS}
              valor={r.completaMenos.cantidad}
              color="text-violet-700"
              detalle={`${pesos(r.completaMenos.monto)} menos que el precio de lista actual`}
              activa={estado === ESTADOS_INSTALACION.COMPLETA_MENOS}
              onClick={() => alternar(ESTADOS_INSTALACION.COMPLETA_MENOS)}
            />
            <Tarjeta titulo="Revisadas por las dueñas" valor={r.revisadas} color="text-gray-700" detalle="Anotadas como ya instaladas, no instaladas o pagadas por otro lado" activa={estado === ESTADOS_INSTALACION.REVISADA} onClick={() => alternar(ESTADOS_INSTALACION.REVISADA)} />
            <Tarjeta titulo={ESTADOS_INSTALACION.COMPLETA} valor={r.completas} color="text-emerald-700" activa={estado === ESTADOS_INSTALACION.COMPLETA} onClick={() => alternar(ESTADOS_INSTALACION.COMPLETA)} />
            <Tarjeta
              titulo="Datos que faltan en la ficha"
              valor={r.sinFormaDePago + r.sinTipoBrackets}
              color="text-gray-700"
              detalle={`${r.sinFormaDePago} sin forma de pago · ${r.sinTipoBrackets} sin tipo de brackets`}
            />
          </div>

          <ul className="mt-3 list-disc pl-5 text-xs text-gray-500">
            <li>
              <strong>Instalada y sin pago registrado:</strong> hay una instalación hecha (turno marcado como presente o fecha de instalación en la ficha) y no hay ningún cobro de
              instalación ni pago adelantado. Puede ser plata que no se registró, o que se cobró bajo otro concepto.
            </li>
            <li>
              <strong>2ª cuota pendiente:</strong> la ficha es en 2 cuotas, hay un solo pago y pasaron más de 30 días. <strong>Completa, pero por menos del precio de lista:</strong> pagó las
              dos cuotas, pero el total es menor al precio actual; puede ser un precio anterior o un descuento.
            </li>
            <li>
              Quedan afuera {datos.continuaciones} paciente{datos.continuaciones === 1 ? "" : "s"} de continuación de otra clínica (pagan la continuación) y {datos.anteriores} que ya estaban
              instalados antes de la app y volvieron por otra arcada. El precio de lista cambia con el tiempo, por eso no todo lo marcado &quot;por menos&quot; es un error.
            </li>
          </ul>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar paciente..." className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
            <select value={estado} onChange={(e) => setEstado(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
              <option value="todos">Todas las situaciones</option>
              {Object.values(ESTADOS_INSTALACION).map((x) => (
                <option key={x} value={x}>
                  {x}
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
            <table className="w-full min-w-[860px] border-collapse text-sm">
              <thead>
                <tr className="bg-brand-brown text-white">
                  <th className="px-3 py-2 text-left font-semibold">Paciente</th>
                  <th className="px-3 py-2 text-left font-semibold">Instalación</th>
                  <th className="px-3 py-2 text-left font-semibold">Brackets / pago</th>
                  <th className="px-3 py-2 text-right font-semibold">Precio de lista</th>
                  <th className="px-3 py-2 text-left font-semibold">Pagos registrados</th>
                  <th className="px-3 py-2 text-right font-semibold">Falta</th>
                  <th className="px-3 py-2 text-left font-semibold">Situación</th>
                  <th className="px-3 py-2 text-left font-semibold">Revisión</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((f) => (
                  <tr key={f.id} className="border-t border-gray-100 align-top">
                    <td className="px-3 py-2">
                      <p className="font-medium text-gray-900">{f.paciente}</p>
                      <p className="text-xs text-gray-500">{f.ortodoncista}</p>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-700">
                      {formatoFecha(f.fechaInstalacion)}
                      <span className="block text-gray-500">{f.hecha ? (f.diasDesdeInstalacion !== null ? `hace ${f.diasDesdeInstalacion} d` : "hecha") : "agendada"}</span>
                      {f.hecha && f.evidencia.length > 0 && <span className="block max-w-[11rem] whitespace-normal text-[11px] text-gray-400">Figura instalada por: {f.evidencia.join(" y ")}</span>}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700">
                      {f.tipoBrackets || <span className="text-amber-700">sin brackets</span>}
                      <span className="block">{f.formaPago || <span className="text-amber-700">sin forma de pago</span>}</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-gray-700">{f.referencia ? pesos(f.referencia) : "—"}</td>
                    <td className="px-3 py-2 text-xs text-gray-700">
                      {f.pagos.length === 0
                        ? "—"
                        : f.pagos.map((p, i) => (
                            <span key={i} className="block tabular-nums">
                              {formatoFecha(p.fecha)} · {pesos(p.importe)} {p.concepto === "Pago adelantado" ? "(adelanto)" : ""}
                            </span>
                          ))}
                      {f.pagos.length > 1 && <span className="block font-semibold">Total {pesos(f.pagado)}</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-700">{f.falta ? pesos(f.falta) : "—"}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${ESTILO_ESTADO[f.estado]}`}>{f.estado}</span>
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={f.revision?.resultado || ""}
                        onChange={(e) => revisar(f.id, e.target.value)}
                        title="Si el control marca algo que en realidad está bien, anotá por qué: deja de contar como alerta"
                        className="w-44 rounded-md border border-gray-300 px-1.5 py-1 text-xs"
                      >
                        <option value="">(sin revisar)</option>
                        {RESULTADOS_REVISION.map((x) => (
                          <option key={x} value={x}>
                            {x}
                          </option>
                        ))}
                      </select>
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
