"use client";

import { useEffect, useState } from "react";
import SoloDuena from "@/components/SoloDuena";
import { fechaDeHoyISO, sumarDias } from "@/lib/agenda";
import { obtenerDetalleDelDia } from "@/lib/data/detalleDelDia";

const pesos = (n) => `$${Math.round(Number(n || 0)).toLocaleString("es-AR")}`;
const formatoFecha = (f) => (f ? f.split("-").reverse().join("/") : "—");

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const nombreDia = (f) => DIAS[new Date(`${f}T12:00:00`).getDay()];

const ESTILO_ALERTA = {
  alerta: "border-red-200 bg-red-50 text-red-800",
  revisar: "border-amber-200 bg-amber-50 text-amber-900",
  info: "border-sky-200 bg-sky-50 text-sky-900",
};
const ICONO_ALERTA = { alerta: "🔴", revisar: "🟡", info: "🔵" };

function celdaCSV(v) {
  const t = String(v ?? "");
  return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

function Tarjeta({ titulo, valor, detalle, tono }) {
  const color = tono === "mal" ? "border-red-300 bg-red-50" : tono === "ok" ? "border-emerald-200 bg-emerald-50" : "border-gray-200 bg-white";
  return (
    <div className={`rounded-lg border p-3 ${color}`}>
      <p className="text-xs font-medium uppercase text-gray-500">{titulo}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{valor}</p>
      {detalle && <p className="mt-0.5 text-xs text-gray-500">{detalle}</p>}
    </div>
  );
}

function Seccion({ titulo, subtitulo, children }) {
  return (
    <section className="mt-6">
      <h2 className="font-heading text-lg font-bold text-gray-900">{titulo}</h2>
      {subtitulo && <p className="mt-0.5 text-sm text-gray-500">{subtitulo}</p>}
      <div className="mt-2">{children}</div>
    </section>
  );
}

function FilaProfesional({ p }) {
  const [abierto, setAbierto] = useState(false);
  const color = p.cubierto ? "text-emerald-700" : p.diferencia > 0 ? "text-amber-700" : "text-red-700";
  return (
    <>
      <tr onClick={() => setAbierto((a) => !a)} className="cursor-pointer border-t border-gray-100 hover:bg-gray-50">
        <td className="px-3 py-2 font-medium text-gray-900">
          {abierto ? "▾" : "▸"} {p.nombre}
          {p.porcentaje != null && <span className="ml-1 text-xs font-normal text-gray-500">({p.porcentaje}%)</span>}
        </td>
        <td className="px-3 py-2 text-right tabular-nums">{pesos(p.cobrado)}</td>
        <td className="px-3 py-2 text-center text-gray-600">
          {p.cobrosLiquidados}/{p.cobros}
        </td>
        <td className="px-3 py-2 text-right tabular-nums text-gray-600">{pesos(p.baseHonorarios)}</td>
        <td className="px-3 py-2 text-right tabular-nums font-medium">{pesos(p.honorarios)}</td>
        <td className="px-3 py-2 text-right tabular-nums">
          {pesos(p.pagadoHoy)}
          {p.pagadoOS > 0 && <span className="block text-xs text-gray-500">+ obra social {pesos(p.pagadoOS)}</span>}
        </td>
        <td className={`px-3 py-2 text-right tabular-nums font-semibold ${color}`}>
          {pesos(p.diferencia)}
          {p.cubierto && <span className="block text-xs font-normal">✅ pagado</span>}
        </td>
      </tr>
      {abierto && (
        <tr className="bg-gray-50">
          <td colSpan={7} className="px-4 py-3 text-xs">
            {p.detalle.length > 0 && (
              <>
                <p className="font-semibold text-gray-700">Honorarios de hoy, línea por línea</p>
                <table className="mt-1 w-full">
                  <tbody>
                    {p.detalle.map((d, i) => (
                      <tr key={i} className="border-t border-gray-200">
                        <td className="py-1 pr-2">{d.paciente}</td>
                        <td className="py-1 pr-2 text-gray-600">{d.concepto}</td>
                        <td className="py-1 pr-2 text-right tabular-nums">{pesos(d.monto)}</td>
                        <td className="py-1 text-right tabular-nums font-medium">{d.sinHonorarios ? "sin honorarios" : pesos(d.montoHonorarios)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            <p className="mt-2 font-semibold text-gray-700">Pagos a {p.nombre} cargados hoy</p>
            {p.pagos.length === 0 && <p className="text-gray-500">No se le cargó ningún pago hoy.</p>}
            {p.pagos.map((pg) => (
              <div key={pg.id} className="mt-1 rounded border border-gray-200 bg-white px-2 py-1.5">
                <p>
                  <strong>{pesos(pg.monto)}</strong> · {pg.tipo} · {pg.medio_pago}
                  {pg.desde_reserva ? " · con la reserva" : ""}
                  {pg.observaciones ? ` · ${pg.observaciones}` : ""}
                </p>
                {pg.cubre.length > 0 ? (
                  <>
                    <p className="text-gray-600">
                      Cubre {pg.cubre.length} cobro{pg.cubre.length > 1 ? "s" : ""} por {pesos(pg.sumaCubierta)}
                      {pg.porcentajeSobreCubierto != null && ` → el pago es el ${pg.porcentajeSobreCubierto.toFixed(0)}% de lo cobrado`}
                    </p>
                    <ul className="ml-4 list-disc text-gray-500">
                      {pg.cubre.map((c, i) => (
                        <li key={i}>
                          {formatoFecha(c.fecha)} · {c.paciente} · {c.detalle} · {pesos(c.monto)}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="text-gray-500">No tiene cobros marcados (no se puede verificar a qué corresponde).</p>
                )}
              </div>
            ))}
            {p.honorariosOSPendientes > 0 && <p className="mt-2 text-gray-500">Honorarios de obra social que se liquidan a mes vencido: {pesos(p.honorariosOSPendientes)}.</p>}
          </td>
        </tr>
      )}
    </>
  );
}

function DetalleContenido() {
  const hoy = fechaDeHoyISO();
  const [fecha, setFecha] = useState(hoy);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [solo, setSolo] = useState("todos");

  useEffect(() => {
    let vigente = true;
    obtenerDetalleDelDia(fecha)
      .then((d) => {
        if (vigente) {
          setDatos(d);
          setError(null);
        }
      })
      .catch((e) => vigente && setError(e.message));
    return () => {
      vigente = false;
    };
  }, [fecha]);

  function cambiarFecha(f) {
    setDatos(null);
    setFecha(f);
  }

  function exportar() {
    const filas = [
      ["Hora", "Paciente", "Sistema", "Vino", "Atendió", "Qué se hizo", "Cobrado", "Medios", "Honorarios", "Liquidado", "Avisos"],
      ...datos.pacientes.map((p) => [
        p.hora || "", p.paciente, p.sistema, p.vino ? "Sí" : "No",
        [...new Set([...p.turnos.map((t) => t.profesional), ...p.cobros.map((c) => c.profesional)].filter(Boolean))].join(" / "),
        [...p.cobros.map((c) => c.detalle), ...p.os.map((o) => `${o.prestacion} (${o.obraSocial})`)].join(" | "),
        Math.round(p.cobrado), p.cobros.flatMap((c) => c.partes.map((x) => `${x.medio} ${Math.round(x.monto)}`)).join(" | "),
        Math.round(p.honorarios), p.cobros.length ? (p.pendientesLiquidar === 0 ? "Sí" : "Pendiente") : "",
        [...p.alertas.map((a) => a.texto), ...p.info].join(" | "),
      ]),
    ];
    const contenido = "﻿" + filas.map((l) => l.map(celdaCSV).join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([contenido], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `detalle-del-dia-${fecha}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const pacientesVisibles = (datos?.pacientes || []).filter((p) => {
    if (solo === "revisar") return p.alertas.length > 0;
    if (solo === "sincobro") return p.vino && p.cobros.length === 0 && p.os.length === 0;
    return true;
  });
  const cantidadAlertas = (datos?.alertas || []).filter((a) => a.nivel !== "info").length;

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">🔍 Detalle del día</h1>
      <p className="mt-1 text-sm text-gray-500">
        Solo para las dueñas. Sigue la plata paso por paso: quién vino, qué se hizo, cuánto pagó, cuánto le corresponde al profesional, cuánto se le pagó, y si lo cobrado
        coincide con el cierre de turno, el cierre diario y el balance.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button onClick={() => cambiarFecha(sumarDias(fecha, -1))} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
          ← Día anterior
        </button>
        <input type="date" value={fecha} max={hoy} onChange={(e) => e.target.value && cambiarFecha(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        <button onClick={() => cambiarFecha(sumarDias(fecha, 1))} disabled={fecha >= hoy} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-40">
          Día siguiente →
        </button>
        <button onClick={() => cambiarFecha(hoy)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
          Hoy
        </button>
        <span className="text-sm font-medium text-gray-700">
          {nombreDia(fecha)} {formatoFecha(fecha)}
        </span>
        {datos && (
          <button onClick={exportar} className="ml-auto rounded-md bg-brand-brown px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-brown-dark">
            ⬇ Descargar (Excel)
          </button>
        )}
      </div>

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
      {!datos && !error && <p className="mt-6 text-sm text-gray-500">Calculando...</p>}

      {datos && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tarjeta titulo="Vinieron" valor={datos.resumen.pacientesQueVinieron} detalle={`${datos.resumen.conCobro} con cobro o facturación`} />
            <Tarjeta
              titulo="Vinieron sin cobro"
              valor={datos.resumen.sinCobro}
              detalle={datos.resumen.sinCobro === 0 ? "Todos pagaron o están justificados" : "Revisar abajo"}
              tono={datos.resumen.sinCobro === 0 ? "ok" : "mal"}
            />
            <Tarjeta titulo="Cobrado en Caja" valor={pesos(datos.resumen.totalCobros)} detalle={datos.medios.filter((m) => datos.resumen.cobrosPorMedio[m === "Mercado Pago" ? "mercado_pago" : m === "Débito" ? "debito" : m === "Crédito" ? "credito" : m.toLowerCase()] > 0).map((m) => `${m} ${pesos(datos.resumen.cobrosPorMedio[m === "Mercado Pago" ? "mercado_pago" : m === "Débito" ? "debito" : m === "Crédito" ? "credito" : m.toLowerCase()])}`).join(" · ") || "—"} />
            <Tarjeta
              titulo="Para revisar"
              valor={cantidadAlertas}
              detalle={cantidadAlertas === 0 ? "Todo coincide" : "Cosas que no cierran"}
              tono={cantidadAlertas === 0 ? "ok" : "mal"}
            />
            <Tarjeta titulo="Honorarios de hoy" valor={pesos(datos.resumen.honorarios)} detalle="Copago/particular, según el % de cada profesional" />
            <Tarjeta titulo="Pagado a profesionales hoy" valor={pesos(datos.resumen.pagadoAProfesionales)} detalle="Pagos de tipo copago cargados hoy" />
            <Tarjeta titulo="Egresos del día" valor={pesos(datos.resumen.egresosCierre)} detalle="Pagos a profesionales + gastos del cierre" />
            <Tarjeta
              titulo="Cierres"
              valor={datos.resumen.cierresTurno > 0 ? `${datos.resumen.cierresTurno} turno${datos.resumen.cierresTurno > 1 ? "s" : ""}` : "Sin cerrar"}
              detalle={datos.resumen.cierreAprobado ? "Cierre diario aprobado" : "Cierre diario sin aprobar"}
            />
          </div>

          <Seccion titulo="Para revisar" subtitulo="Todo lo que no coincide o falta, de mayor a menor importancia.">
            {datos.alertas.length === 0 ? (
              <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">✅ No hay nada para revisar este día.</p>
            ) : (
              <ul className="space-y-1.5">
                {datos.alertas.map((a, i) => (
                  <li key={i} className={`rounded-md border px-3 py-1.5 text-sm ${ESTILO_ALERTA[a.nivel]}`}>
                    {ICONO_ALERTA[a.nivel]} {a.texto}
                  </li>
                ))}
              </ul>
            )}
          </Seccion>

          <Seccion titulo="Recorrido de la plata" subtitulo="Lo que entró, paso por paso, hasta el balance. Cada paso se compara con el anterior.">
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="bg-brand-brown text-white">
                    <th className="px-3 py-2 text-left font-semibold">Paso</th>
                    <th className="px-3 py-2 text-right font-semibold">Importe</th>
                    <th className="px-3 py-2 text-right font-semibold">Diferencia</th>
                    <th className="px-3 py-2 text-left font-semibold">¿Coincide?</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.cadena.map((c, i) => (
                    <tr key={i} className="border-t border-gray-100 align-top">
                      <td className="px-3 py-2 font-medium text-gray-900">{c.paso}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.valor == null ? "—" : pesos(c.valor)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${c.diferencia && Math.abs(c.diferencia) > 1 ? "font-semibold text-red-700" : "text-gray-400"}`}>
                        {c.diferencia == null ? "—" : pesos(c.diferencia)}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <span className={c.sinDato ? (c.ok ? "text-gray-500" : "text-amber-700") : c.ok ? "text-emerald-700" : "text-red-700"}>
                          {c.sinDato ? (c.ok ? "—" : "⚠️") : c.ok ? "✅" : "⚠️"} {c.detalle}
                        </span>
                        {c.detalleExtra && <span className="mt-0.5 block text-gray-400">{c.detalleExtra}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Seccion>

          <Seccion titulo="Por profesional" subtitulo="Lo que le corresponde por lo cobrado hoy contra lo que se le pagó. Tocá un profesional para ver el detalle línea por línea y los cobros que cubre cada pago.">
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full min-w-[820px] border-collapse text-sm">
                <thead>
                  <tr className="bg-brand-brown text-white">
                    <th className="px-3 py-2 text-left font-semibold">Profesional</th>
                    <th className="px-3 py-2 text-right font-semibold">Cobrado</th>
                    <th className="px-3 py-2 text-center font-semibold">Cobros liquidados</th>
                    <th className="px-3 py-2 text-right font-semibold">Base de honorarios</th>
                    <th className="px-3 py-2 text-right font-semibold">Le corresponde</th>
                    <th className="px-3 py-2 text-right font-semibold">Pagado hoy</th>
                    <th className="px-3 py-2 text-right font-semibold">Falta pagar</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.profesionales.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-4 text-center text-gray-500">
                        Sin movimientos de profesionales este día.
                      </td>
                    </tr>
                  )}
                  {datos.profesionales.map((p) => (
                    <FilaProfesional key={p.profesionalId} p={p} />
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              «Falta pagar» no tiene por qué dar cero: un pago de hoy puede cubrir cobros de otros días, y los honorarios de hoy se pueden pagar otro día. Lo que importa es que cada pago
              tenga sus cobros marcados y que equivalga al porcentaje del profesional.
            </p>
          </Seccion>

          <Seccion titulo="Por paciente" subtitulo="Cada paciente que vino o que pagó hoy, con lo que se hizo, lo que pagó y lo que le corresponde al profesional.">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
              {[["todos", `Todos (${datos.pacientes.length})`], ["revisar", "Con avisos"], ["sincobro", "Vinieron sin cobro"]].map(([k, et]) => (
                <button key={k} onClick={() => setSolo(k)} className={`rounded-full border px-3 py-1 text-xs font-medium ${solo === k ? "border-brand-brown bg-brand-tan/40 text-brand-brown" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}>
                  {et}
                </button>
              ))}
            </div>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full min-w-[980px] border-collapse text-sm">
                <thead>
                  <tr className="bg-brand-brown text-white">
                    <th className="px-3 py-2 text-left font-semibold">Hora</th>
                    <th className="px-3 py-2 text-left font-semibold">Paciente</th>
                    <th className="px-3 py-2 text-left font-semibold">Qué se hizo</th>
                    <th className="px-3 py-2 text-left font-semibold">Atendió</th>
                    <th className="px-3 py-2 text-right font-semibold">Pagó</th>
                    <th className="px-3 py-2 text-right font-semibold">Honorarios</th>
                    <th className="px-3 py-2 text-left font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {pacientesVisibles.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-4 text-center text-gray-500">
                        No hay pacientes para mostrar.
                      </td>
                    </tr>
                  )}
                  {pacientesVisibles.map((p) => {
                    const quien = [...new Set([...p.turnos.map((t) => t.profesional), ...p.cobros.map((c) => c.profesional)].filter(Boolean))];
                    const sinCobro = p.vino && p.cobros.length === 0 && p.os.length === 0;
                    return (
                      <tr key={p.clave} className={`border-t border-gray-100 align-top ${p.alertas.some((a) => a.nivel === "alerta") ? "bg-red-50/60" : p.alertas.length ? "bg-amber-50/50" : ""}`}>
                        <td className="whitespace-nowrap px-3 py-2 tabular-nums text-gray-600">{p.hora || "—"}</td>
                        <td className="px-3 py-2 font-medium text-gray-900">
                          {p.paciente}
                          <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">{p.sistema}</span>
                          {!p.vino && <span className="ml-1 rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">no figura que vino</span>}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-700">
                          {p.turnos.map((t, i) => (
                            <p key={i} className="text-gray-500">
                              Turno: {t.concepto}
                            </p>
                          ))}
                          {p.cobros.map((c) => (
                            <p key={c.id}>{c.detalle}</p>
                          ))}
                          {p.os.map((o, i) => (
                            <p key={i}>
                              {o.prestacion} <span className="text-gray-500">({o.obraSocial}, {pesos(o.valor)})</span>
                            </p>
                          ))}
                          {p.realizadas.length > 0 && <p className="text-gray-500">Cargado por el profesional: {p.realizadas.map((r) => r.prestacion + (r.cobrado ? "" : " (sin cobrar)")).join(", ")}</p>}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600">{quien.join(" / ") || "—"}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {p.cobros.length > 0 ? (
                            <>
                              <span className="font-medium">{pesos(p.cobrado)}</span>
                              <span className="block text-xs text-gray-500">{[...new Set(p.cobros.flatMap((c) => c.partes.map((x) => x.medio)))].join(" + ")}</span>
                            </>
                          ) : (
                            <span className={sinCobro ? "font-semibold text-red-700" : "text-gray-400"}>{sinCobro ? "Sin cobro" : "—"}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {p.honorarios > 0 ? (
                            <>
                              <span className="font-medium">{pesos(p.honorarios)}</span>
                              <span className="block text-xs text-gray-500">sobre {pesos(p.baseHonorarios)}</span>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {p.cobros.length > 0 && (
                            <p className={p.pendientesLiquidar === 0 ? "text-emerald-700" : "text-gray-600"}>
                              {p.pendientesLiquidar === 0 ? "✅ Liquidado al profesional" : `⏳ ${p.pendientesLiquidar} cobro${p.pendientesLiquidar > 1 ? "s" : ""} sin liquidar`}
                              {p.cobros.filter((c) => c.liquidado).map((c, i) => (
                                <span key={i} className="block text-gray-400">
                                  pagado el {formatoFecha(c.liquidado.fecha)}
                                </span>
                              ))}
                            </p>
                          )}
                          {p.alertas.map((a, i) => (
                            <p key={i} className={a.nivel === "alerta" ? "text-red-700" : "text-amber-700"}>
                              {ICONO_ALERTA[a.nivel]} {a.texto}
                            </p>
                          ))}
                          {p.info.map((t, i) => (
                            <p key={i} className="text-sky-700">
                              🔵 {t}
                            </p>
                          ))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Seccion>
        </>
      )}
    </main>
  );
}

export default function DetalleDelDiaPage() {
  return (
    <SoloDuena>
      <DetalleContenido />
    </SoloDuena>
  );
}
