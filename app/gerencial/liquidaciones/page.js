"use client";

import { useEffect, useMemo, useState } from "react";
import SoloDuenaYContador from "@/components/SoloDuenaYContador";
import { fechaDeHoyISO } from "@/lib/agenda";
import { obtenerHistorialPagos } from "@/lib/data/historialPagos";
import { obtenerLiquidacionesParcialesPendientes } from "@/lib/data/cobrosLiquidados";
import { obtenerCobradoSinAsignar, obtenerCobrosConEstadoDeLiquidacion } from "@/lib/data/estadoLiquidaciones";
import ComoSeCalculaHonorarios from "@/components/ComoSeCalculaHonorarios";
import { obtenerProduccionPorProfesional } from "@/lib/data/produccionProfesionales";

const NOMBRES_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function nombreMes(claveMes) {
  const [anio, mes] = claveMes.split("-");
  return `${NOMBRES_MES[Number(mes) - 1]} ${anio}`;
}

function formatoFecha(fechaISO) {
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}

function formatoPesos(n) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

function rangoDelMes(mesISO) {
  const [anio, mes] = mesISO.split("-").map(Number);
  const ultimoDia = new Date(anio, mes, 0).getDate();
  return { desde: `${mesISO}-01`, hasta: `${mesISO}-${String(ultimoDia).padStart(2, "0")}` };
}

function celdaCSV(valor) {
  const texto = String(valor ?? "");
  return /[;"\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

function descargarCSV(nombreArchivo, lineas) {
  // Punto y coma + BOM: así Excel en español lo abre directo en columnas y con tildes.
  const contenido = "﻿" + lineas.map((l) => l.map(celdaCSV).join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([contenido], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombreArchivo;
  a.click();
  URL.revokeObjectURL(url);
}

// Une, por profesional, lo que le correspondía en el mes (Producción) con lo que se le pagó (Historial de pagos).
function armarBalance(produccion, pagos, parciales) {
  const porProfesional = new Map();
  const entradaDe = (id, nombre) => {
    if (!porProfesional.has(id)) {
      porProfesional.set(id, { id, nombre, correspondia: 0, osPendiente: 0, pagos: [], pagado: 0, pagadoConDetalle: 0, parciales: [] });
    }
    return porProfesional.get(id);
  };
  for (const f of produccion) {
    // Los honorarios de obra social se liquidan a mes vencido: van aparte, no entran en el saldo del mes.
    const e = entradaDe(f.profesionalId, f.nombre);
    e.correspondia += f.honorariosCopago;
    e.osPendiente += f.honorariosOS;
  }
  for (const p of pagos) {
    const e = entradaDe(p.profesionalId, p.profesional);
    e.pagos.push(p);
    e.pagado += p.monto;
    if (p.cobrosCubiertos.length > 0) e.pagadoConDetalle += p.monto;
  }
  // Cobros que se le pagaron en parte y todavía falta completar (de cualquier mes).
  for (const c of parciales) {
    const e = porProfesional.get(c.profesionalId);
    if (e) e.parciales.push(c);
  }
  return [...porProfesional.values()]
    .filter((e) => e.correspondia > 0 || e.osPendiente > 0 || e.pagos.length > 0 || e.parciales.length > 0)
    .map((e) => ({ ...e, saldo: e.correspondia - e.pagado }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

function Cifra({ titulo, valor, ayuda, tono = "normal" }) {
  const color = tono === "alerta" ? "text-amber-700" : tono === "ok" ? "text-emerald-700" : "text-gray-900";
  return (
    <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{titulo}</p>
      <p className={`text-lg font-bold tabular-nums ${color}`}>{valor}</p>
      {ayuda && <p className="text-[11px] text-gray-500">{ayuda}</p>}
    </div>
  );
}

function textoSaldo(saldo) {
  if (Math.abs(saldo) < 500) return { valor: "$0", ayuda: "Al día", tono: "ok" };
  if (saldo > 0) return { valor: formatoPesos(saldo), ayuda: "Falta liquidarle", tono: "alerta" };
  return { valor: formatoPesos(-saldo), ayuda: "Se le pagó de más (o es de un mes anterior)", tono: "normal" };
}

function TarjetaProfesional({ e }) {
  const saldo = textoSaldo(e.saldo);
  const sinDetalle = e.pagado - e.pagadoConDetalle;
  return (
    <section className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4 break-inside-avoid">
      <h2 className="text-lg font-bold text-brand-brown">{e.nombre}</h2>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Cifra titulo="Le correspondía" valor={formatoPesos(e.correspondia)} ayuda="Honorarios de copago/particular y ortodoncia" />
        <Cifra titulo="Se le liquidó" valor={formatoPesos(e.pagado)} ayuda={`${e.pagos.length} pago${e.pagos.length === 1 ? "" : "s"}`} />
        <Cifra titulo="Saldo" valor={saldo.valor} ayuda={saldo.ayuda} tono={saldo.tono} />
        <Cifra titulo="Obra social (mes vencido)" valor={formatoPesos(e.osPendiente)} ayuda="Aparte, se liquida cuando se cobra" />
      </div>

      {e.pagos.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">No se le registró ningún pago en este mes.</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-md border border-gray-200 bg-white">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="bg-brand-brown text-white">
                <th className="px-3 py-2 text-left font-semibold">Fecha</th>
                <th className="px-3 py-2 text-left font-semibold">Qué se liquidó</th>
                <th className="px-3 py-2 text-left font-semibold">Pacientes que incluye</th>
                <th className="px-3 py-2 text-right font-semibold">Monto</th>
              </tr>
            </thead>
            <tbody>
              {e.pagos.map((p) => (
                <tr key={p.id} className="border-t border-gray-100 align-top">
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-gray-800">{formatoFecha(p.fecha)}</td>
                  <td className="px-3 py-2 text-gray-700">
                    {p.tipo}
                    <span className="block text-[11px] text-gray-500">
                      {p.medioPago} · {p.salioDe}
                    </span>
                    {p.observaciones && <span className="block text-[11px] text-gray-500">{p.observaciones}</span>}
                  </td>
                  <td className="px-3 py-2 text-gray-800">
                    {p.cobrosCubiertos.length === 0 ? (
                      <span className="text-xs text-gray-400">Sin detalle de pacientes</span>
                    ) : (
                      <>
                        {p.cobrosCubiertos.some((c) => c.tratamientoSaldado) && (
                          <span className="mb-0.5 block text-[11px] font-semibold text-emerald-700">Tratamiento saldado ✓</span>
                        )}
                        {p.cobrosCubiertos.map((c, i) => (
                          <span key={i} className="block text-xs">
                            <strong>{c.paciente}</strong> — {c.detalle} ({formatoFecha(c.fecha)}, {formatoPesos(c.monto)})
                            {c.parcial && (
                              <span className="font-semibold text-amber-700">
                                {" "}
                                · PARTE: se le pagó {formatoPesos(c.montoPagado ?? 0)} de {formatoPesos(c.honorarios ?? 0)}
                              </span>
                            )}
                          </span>
                        ))}
                      </>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-gray-900">{formatoPesos(p.monto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {e.parciales.length > 0 && (
        <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2">
          <p className="text-xs font-semibold text-amber-900">
            Pagos parciales: falta completar {formatoPesos(e.parciales.reduce((s, c) => s + c.falta, 0))}
          </p>
          {e.parciales.map((c) => (
            <p key={c.clave} className="mt-0.5 text-xs text-amber-900">
              <strong>{c.paciente}</strong> — {c.detalle} ({formatoFecha(c.fecha)}): se le pagó {formatoPesos(c.pagado)} de {formatoPesos(c.honorarios)} ·{" "}
              <strong>falta {formatoPesos(c.falta)}</strong>
            </p>
          ))}
        </div>
      )}
      {sinDetalle > 0 && (
        <p className="mt-2 text-xs text-gray-500">
          De lo liquidado, {formatoPesos(sinDetalle)} se cargó sin tildar los pacientes que cubría.
        </p>
      )}
    </section>
  );
}

const ESTADOS_FILTRO = [
  ["todos", "Todos"],
  ["pendiente", "Faltan liquidar"],
  ["parcial", "Parciales"],
  ["liquidado", "Liquidados"],
];
const ESTILO_ESTADO = {
  liquidado: "bg-emerald-100 text-emerald-800",
  parcial: "bg-amber-100 text-amber-800",
  pendiente: "bg-rose-100 text-rose-800",
};
const TEXTO_ESTADO = { liquidado: "Liquidado ✓", parcial: "Parcial", pendiente: "Falta liquidar" };

// Los dos bloques de la pestaña: los pacientes particulares y los de obra social.
const BLOQUES = [
  {
    id: "particular",
    titulo: "Pacientes particulares",
    ayuda: "Incluye ortodoncia y a los pacientes de obra social que pagaron como particulares.",
  },
  {
    id: "obra_social",
    titulo: "Pacientes de obra social",
    ayuda: "El copago que cobró la clínica al paciente. Lo que paga la obra social se liquida a mes vencido y se lleva aparte.",
  },
];

function sumar(lista, campo) {
  return lista.reduce((s, c) => s + c[campo], 0);
}

// Un bloque (particulares u obra social): sus totales y, por profesional, los pacientes con su estado.
function BloquePacientes({ bloque, cobros, estado, q }) {
  const porProfesional = useMemo(() => {
    const mapa = new Map();
    for (const c of cobros) {
      if (!mapa.has(c.profesionalId)) mapa.set(c.profesionalId, { id: c.profesionalId, nombre: c.profesional, cobros: [] });
      mapa.get(c.profesionalId).cobros.push(c);
    }
    return [...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [cobros]);

  const faltan = cobros.filter((c) => c.estado !== "liquidado");
  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-brand-brown pb-1">
        <h2 className="text-xl font-bold text-brand-brown">{bloque.titulo}</h2>
        <p className="text-sm text-gray-600">
          {cobros.length} cobro{cobros.length === 1 ? "" : "s"} · {faltan.length} sin liquidar por completo
        </p>
      </div>
      <p className="mt-1 text-xs text-gray-500">{bloque.ayuda}</p>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Cifra titulo="Le corresponde" valor={formatoPesos(sumar(cobros, "honorarios"))} />
        <Cifra titulo="Liquidado" valor={formatoPesos(sumar(cobros, "liquidado"))} tono="ok" />
        <Cifra titulo="Falta liquidar" valor={formatoPesos(sumar(cobros, "falta"))} tono={sumar(cobros, "falta") > 500 ? "alerta" : "ok"} />
      </div>

      {cobros.length === 0 && <p className="mt-4 text-sm text-gray-500">No hay cobros de este tipo en el mes.</p>}
      {porProfesional.map((g) => {
        const filas = g.cobros.filter((c) => (estado === "todos" || c.estado === estado) && (!q || c.paciente.toLowerCase().includes(q)));
        if (filas.length === 0) return null;
        return (
          <div key={g.id} className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3 break-inside-avoid">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-base font-bold text-gray-900">{g.nombre}</h3>
              <p className="text-xs text-gray-600">
                Le corresponde <strong>{formatoPesos(sumar(g.cobros, "honorarios"))}</strong> · Liquidado <strong>{formatoPesos(sumar(g.cobros, "liquidado"))}</strong> · Falta{" "}
                <strong className={sumar(g.cobros, "falta") > 500 ? "text-rose-700" : ""}>{formatoPesos(sumar(g.cobros, "falta"))}</strong>
              </p>
            </div>
            <div className="mt-2 overflow-x-auto rounded-md border border-gray-200 bg-white">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="bg-brand-brown text-white">
                    <th className="px-3 py-2 text-left font-semibold">Fecha</th>
                    <th className="px-3 py-2 text-left font-semibold">Paciente</th>
                    <th className="px-3 py-2 text-left font-semibold">Detalle</th>
                    <th className="px-3 py-2 text-right font-semibold">Cobró</th>
                    <th className="px-3 py-2 text-right font-semibold">Le corresponde</th>
                    <th className="px-3 py-2 text-left font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((c) => (
                    <tr key={c.clave} className="border-t border-gray-100 align-top">
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-gray-800">{formatoFecha(c.fecha)}</td>
                      <td className="px-3 py-2 font-medium text-gray-900">{c.paciente}</td>
                      <td className="px-3 py-2 text-xs text-gray-600">
                        {c.detalle}
                        <span className="block text-[11px] text-gray-400">{c.cobertura}</span>
                        {c.calculo && <span className="block text-[10px] leading-snug text-gray-500">{c.calculo}</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-gray-700">{formatoPesos(c.monto)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-gray-900">{formatoPesos(c.honorarios)}</td>
                      <td className="px-3 py-2 text-xs">
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ESTILO_ESTADO[c.estado]}`}>{TEXTO_ESTADO[c.estado]}</span>
                        {c.estado === "liquidado" && c.fechaLiquidacion && <span className="block text-gray-500">el {formatoFecha(c.fechaLiquidacion)}</span>}
                        {c.estado !== "pendiente" && Math.abs(c.honorarios - c.calculado) > 500 && (
                          <span className="mt-0.5 block font-semibold text-red-700">
                            ⚠ Se liquidó sobre {formatoPesos(c.honorarios)}; hoy le corresponde {formatoPesos(c.calculado)} ({c.calculado > c.honorarios ? "faltan" : "sobran"}{" "}
                            {formatoPesos(Math.abs(c.calculado - c.honorarios))})
                          </span>
                        )}
                        {c.estado === "parcial" && (
                          <span className="block text-amber-700">
                            se le pagó {formatoPesos(c.liquidado)} · falta {formatoPesos(c.falta)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </section>
  );
}

// Control de cada profesional contra Producción, con los dos bloques juntos.
function ControlContraProduccion({ balance, cobros }) {
  const filas = useMemo(() => {
    const mapa = new Map();
    for (const c of cobros) {
      if (!mapa.has(c.profesionalId)) mapa.set(c.profesionalId, { id: c.profesionalId, nombre: c.profesional, hon: 0, falta: 0 });
      const e = mapa.get(c.profesionalId);
      e.hon += c.honorarios;
      e.falta += c.falta;
    }
    return [...mapa.values()]
      .map((e) => {
        const b = balance.find((x) => x.id === e.id);
        const sinTildar = b ? b.pagado - b.pagadoConDetalle : 0;
        return { ...e, produccion: b?.correspondia ?? 0, pagado: b?.pagado ?? 0, sinTildar, faltaReal: Math.max(0, e.falta - sinTildar) };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [balance, cobros]);

  if (filas.length === 0) return null;
  return (
    <section className="mt-6">
      <h2 className="text-lg font-bold text-brand-brown">¿Coincide todo? Control por profesional</h2>
      <p className="text-xs text-gray-500">
        Suma los pacientes particulares y de obra social de cada profesional y los compara con Producción y con lo que se le pagó en el mes.
      </p>
      <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="bg-brand-brown text-white">
              <th className="px-3 py-2 text-left font-semibold">Profesional</th>
              <th className="px-3 py-2 text-right font-semibold">Según Producción</th>
              <th className="px-3 py-2 text-right font-semibold">Suma por pacientes</th>
              <th className="px-3 py-2 text-right font-semibold">Se le pagó</th>
              <th className="px-3 py-2 text-right font-semibold">…sin tildar pacientes</th>
              <th className="px-3 py-2 text-right font-semibold">Falta liquidar</th>
              <th className="px-3 py-2 text-right font-semibold">Falta real (aprox.)</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const dif = Math.abs(f.produccion - f.hon);
              return (
                <tr key={f.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-medium text-gray-900">{f.nombre}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatoPesos(f.produccion)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums ${dif > 1000 ? "font-semibold text-amber-700" : "text-emerald-700"}`}>
                    {formatoPesos(f.hon)}
                    <span className="block text-[11px] font-normal">{dif > 1000 ? `difiere ${formatoPesos(dif)}` : "coincide ✓"}</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatoPesos(f.pagado)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-gray-600">{formatoPesos(f.sinTildar)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatoPesos(f.falta)}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-gray-900">{formatoPesos(f.faltaReal)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-1 text-[11px] text-gray-500">
        «Falta real» descuenta lo que se pagó sin tildar pacientes, suponiendo que corresponde a estos cobros. Es una aproximación para los pagos anteriores al tildado obligatorio.
      </p>
    </section>
  );
}

// Los pacientes del mes en dos bloques (particulares y obra social), cada uno con su estado: liquidado, parcial o pendiente.
function PestanaPacientes({ balance, cobros, profesionalElegido, estado, setEstado, busqueda, setBusqueda }) {
  const q = busqueda.trim().toLowerCase();
  const delProfesional = useMemo(
    () => cobros.filter((c) => profesionalElegido === "todos" || c.profesionalId === profesionalElegido),
    [cobros, profesionalElegido]
  );
  const cuenta = (e) => delProfesional.filter((c) => c.estado === e).length;

  return (
    <>
      <p className="mt-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
        Cada cobro del mes con su estado <strong>de hoy</strong>, separado en pacientes particulares y de obra social. Los pagos cargados antes de que fuera
        obligatorio tildar pacientes no tienen detalle, por eso esos cobros figuran como &quot;Falta liquidar&quot;; el control de abajo muestra cuánto se pagó
        sin tildar. El &quot;Le corresponde&quot; es el valor anotado al tildar el pago o, si todavía no se tildó, una estimación con el % del profesional.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3 print:hidden">
        <div className="flex flex-wrap overflow-hidden rounded-md border border-gray-300 text-sm">
          {ESTADOS_FILTRO.map(([clave, texto]) => (
            <button
              key={clave}
              onClick={() => setEstado(clave)}
              className={`px-3 py-1.5 ${estado === clave ? "bg-brand-brown text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
            >
              {texto} ({clave === "todos" ? delProfesional.length : cuenta(clave)})
            </button>
          ))}
        </div>
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar paciente..."
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Cifra titulo="Le corresponde (total)" valor={formatoPesos(sumar(delProfesional, "honorarios"))} ayuda={`${delProfesional.length} cobros`} />
        <Cifra
          titulo="Ya liquidado"
          valor={formatoPesos(sumar(delProfesional, "liquidado"))}
          ayuda={`${cuenta("liquidado")} liquidados · ${cuenta("parcial")} parciales`}
          tono="ok"
        />
        <Cifra
          titulo="Falta liquidar"
          valor={formatoPesos(sumar(delProfesional, "falta"))}
          ayuda={`${cuenta("pendiente") + cuenta("parcial")} cobros`}
          tono={sumar(delProfesional, "falta") > 500 ? "alerta" : "ok"}
        />
        <Cifra
          titulo="Se pagó en el mes"
          valor={formatoPesos(balance.filter((b) => profesionalElegido === "todos" || b.id === profesionalElegido).reduce((s, b) => s + b.pagado, 0))}
          ayuda="Según los pagos registrados"
        />
      </div>

      {BLOQUES.map((b) => (
        <BloquePacientes key={b.id} bloque={b} cobros={delProfesional.filter((c) => c.grupo === b.id)} estado={estado} q={q} />
      ))}

      <ControlContraProduccion balance={balance.filter((x) => profesionalElegido === "todos" || x.id === profesionalElegido)} cobros={delProfesional} />
    </>
  );
}

function Contenido() {
  const hoy = fechaDeHoyISO();
  const [mes, setMes] = useState(hoy.slice(0, 7));
  const [profesionalElegido, setProfesionalElegido] = useState("todos");
  const [balance, setBalance] = useState([]);
  const [cobros, setCobros] = useState([]);
  const [sinAsignar, setSinAsignar] = useState([]);
  const [pestana, setPestana] = useState("resumen"); // "resumen" | "pacientes"
  const [estadoFiltro, setEstadoFiltro] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const { desde, hasta } = rangoDelMes(mes);
    let vigente = true;
    setCargando(true);
    setError(null);
    Promise.all([
      obtenerProduccionPorProfesional(desde, hasta),
      obtenerHistorialPagos(desde, hasta),
      // Si todavía no se corrió la migración de pagos parciales, la pantalla se ve igual, sin esa parte.
      obtenerLiquidacionesParcialesPendientes().catch(() => []),
      obtenerCobrosConEstadoDeLiquidacion(desde, hasta).catch(() => []),
      obtenerCobradoSinAsignar(desde, hasta).catch(() => []),
    ])
      .then(([produccion, pagos, parciales, cobrosDelMes, sinAsignarDelMes]) => {
        if (!vigente) return;
        setBalance(armarBalance(produccion, pagos, parciales));
        setCobros(cobrosDelMes);
        setSinAsignar(sinAsignarDelMes);
      })
      .catch((e) => vigente && setError(e.message))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [mes]);

  const visibles = useMemo(
    () => balance.filter((e) => profesionalElegido === "todos" || e.id === profesionalElegido),
    [balance, profesionalElegido]
  );
  const totales = useMemo(
    () => ({
      correspondia: visibles.reduce((s, e) => s + e.correspondia, 0),
      pagado: visibles.reduce((s, e) => s + e.pagado, 0),
      osPendiente: visibles.reduce((s, e) => s + e.osPendiente, 0),
    }),
    [visibles]
  );
  const saldoTotal = textoSaldo(totales.correspondia - totales.pagado);

  function descargarPacientes() {
    const lineas = [["Mes", "Profesional", "Tipo de paciente", "Fecha del cobro", "Paciente", "Detalle", "Cobertura", "Cobró", "Le corresponde", "Estado", "Liquidado", "Falta", "Fecha de liquidación"]];
    for (const c of cobros) {
      if (profesionalElegido !== "todos" && c.profesionalId !== profesionalElegido) continue;
      lineas.push([nombreMes(mes), c.profesional, c.grupo === "obra_social" ? "Obra social" : "Particular", formatoFecha(c.fecha), c.paciente, c.detalle, c.cobertura, c.monto, c.honorarios, TEXTO_ESTADO[c.estado], c.liquidado, c.falta, c.fechaLiquidacion ? formatoFecha(c.fechaLiquidacion) : ""]);
    }
    descargarCSV(`pacientes-liquidados-${mes}.csv`, lineas);
  }

  function descargar() {
    if (pestana === "pacientes") return descargarPacientes();
    const lineas = [["Mes", "Profesional", "Fecha del pago", "Tipo", "Medio", "Salió de", "Monto del pago", "Paciente", "Detalle", "Fecha del cobro", "Monto cobrado", "Estado", "Le correspondía", "Se le pagó por este paciente"]];
    for (const e of visibles) {
      for (const p of e.pagos) {
        const base = [nombreMes(mes), e.nombre, formatoFecha(p.fecha), p.tipo, p.medioPago, p.salioDe, p.monto];
        if (p.cobrosCubiertos.length === 0) lineas.push([...base, "(sin detalle de pacientes)", "", "", "", "", "", ""]);
        else
          for (const c of p.cobrosCubiertos)
            lineas.push([...base, c.paciente, c.detalle, formatoFecha(c.fecha), c.monto, c.parcial ? "Parcial" : "Total", c.honorarios ?? "", c.montoPagado ?? ""]);
      }
    }
    descargarCSV(`liquidaciones-profesionales-${mes}.csv`, lineas);
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">🧾 Liquidaciones por profesional</h1>
      <p className="mt-0.5 text-sm text-gray-500">
        Por cada profesional: lo que le correspondía en el mes, lo que se le liquidó (cada pago con los pacientes que
        incluye) y el saldo. Para que un pago muestre sus pacientes, hay que tildarlos al registrar el pago.
      </p>
      <ComoSeCalculaHonorarios />
      {sinAsignar.length > 0 && (
        <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          <p className="font-semibold">
            ⚠ Cobrado por adelantado sin tratamiento identificado: {formatoPesos(sinAsignar.reduce((a, c) => a + c.monto, 0))} ({sinAsignar.length}{" "}
            {sinAsignar.length === 1 ? "cuota" : "cuotas"})
          </p>
          <p className="text-xs">No se le liquida a nadie hasta que se cargue el turno del tratamiento al que corresponde. Cargá ese turno y el honorario se asigna solo.</p>
          <ul className="mt-1 list-disc pl-5 text-xs">
            {sinAsignar.map((c, i) => (
              <li key={i}>
                {c.paciente} — {formatoPesos(c.monto)} ({c.fecha ? formatoFecha(c.fecha) : "—"})
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex overflow-hidden rounded-md border border-gray-300 text-sm print:hidden sm:inline-flex">
        {[
          ["resumen", "Balance por profesional"],
          ["pacientes", "Pacientes liquidados y pendientes"],
        ].map(([clave, texto]) => (
          <button
            key={clave}
            onClick={() => setPestana(clave)}
            className={`px-3 py-1.5 ${pestana === clave ? "bg-brand-brown text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
          >
            {texto}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 print:hidden">
        <input
          type="month"
          value={mes}
          onChange={(e) => e.target.value && setMes(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
        <select
          value={profesionalElegido}
          onChange={(e) => setProfesionalElegido(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="todos">Todos los profesionales</option>
          {balance.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </select>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => window.print()}
            disabled={cargando || visibles.length === 0}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 disabled:opacity-50"
          >
            🖨 Imprimir
          </button>
          <button
            onClick={descargar}
            disabled={cargando || (pestana === "resumen" ? visibles.length === 0 : cobros.length === 0)}
            className="rounded-md bg-brand-brown px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            ⬇ Descargar para Excel
          </button>
        </div>
      </div>

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      {cargando ? (
        <p className="mt-6 text-sm text-gray-500">Cargando...</p>
      ) : pestana === "pacientes" ? (
        <PestanaPacientes
          balance={balance}
          cobros={cobros}
          profesionalElegido={profesionalElegido}
          estado={estadoFiltro}
          setEstado={setEstadoFiltro}
          busqueda={busqueda}
          setBusqueda={setBusqueda}
        />
      ) : visibles.length === 0 ? (
        <p className="mt-6 text-sm text-gray-500">No hay honorarios ni pagos registrados en {nombreMes(mes)}.</p>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-brand-brown pb-1">
            <h2 className="text-xl font-bold text-brand-brown">{nombreMes(mes)}</h2>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Cifra titulo="Le correspondía (total)" valor={formatoPesos(totales.correspondia)} />
            <Cifra titulo="Se liquidó (total)" valor={formatoPesos(totales.pagado)} />
            <Cifra titulo="Saldo (total)" valor={saldoTotal.valor} ayuda={saldoTotal.ayuda} tono={saldoTotal.tono} />
            <Cifra titulo="Obra social (mes vencido)" valor={formatoPesos(totales.osPendiente)} />
          </div>
          {visibles.map((e) => (
            <TarjetaProfesional key={e.id} e={e} />
          ))}
        </>
      )}
    </main>
  );
}

export default function LiquidacionesPage() {
  return (
    <SoloDuenaYContador>
      <Contenido />
    </SoloDuenaYContador>
  );
}
