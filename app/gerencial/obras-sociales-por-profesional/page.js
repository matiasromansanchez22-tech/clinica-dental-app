"use client";

import { useEffect, useMemo, useState } from "react";
import SoloDuena from "@/components/SoloDuena";
import { fechaDeHoyISO } from "@/lib/agenda";
import { OBRAS_SOCIALES_ENTRE_RIOS } from "@/lib/data/facturacionObrasSociales";
import { honorariosDe, obtenerPrestacionesPorObraSocial, resumenParaLiquidar, totalOS } from "@/lib/data/pacientesPorObraSocial";

// Obras sociales por profesional, en versión simple: un mes, cada profesional en una "cortina" que se abre y muestra los pacientes que
// atendió por obra social, lo que paga la obra social y lo que le corresponde cobrar. Arriba, el resumen del mes en una frase.

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const pesos = (n) => `$${Math.round(n).toLocaleString("es-AR")}`;
const dm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const esEntreRios = (os) => OBRAS_SOCIALES_ENTRE_RIOS.some((x) => x.toLowerCase() === String(os).toLowerCase());

function rango(mes) {
  const [a, m] = mes.split("-").map(Number);
  return { desde: `${mes}-01`, hasta: `${mes}-${String(new Date(a, m, 0).getDate()).padStart(2, "0")}` };
}
function sumarMes(mes, n) {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(a, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
const nombreMes = (mes) => `${MESES[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`;

// Un renglón por paciente: lo que se le hizo, lo que paga la obra social y lo que le corresponde al profesional.
function pacientesDe(filas) {
  const mapa = new Map();
  for (const f of filas) {
    const clave = f.pacienteId ?? f.paciente;
    if (!mapa.has(clave)) mapa.set(clave, { paciente: f.paciente, obrasSociales: new Set(), prestaciones: [], valorOS: 0, honorarios: 0 });
    const p = mapa.get(clave);
    p.obrasSociales.add(f.obraSocial);
    p.prestaciones.push(`${dm(f.fecha)} ${f.prestacion}${f.cantidad > 1 ? ` ×${f.cantidad}` : ""}${f.sinHonorarios ? " (no se liquida)" : ""}`);
    p.valorOS += totalOS(f);
    p.honorarios += honorariosDe(f);
  }
  return [...mapa.values()].sort((a, b) => a.paciente.localeCompare(b.paciente, "es"));
}

function Profesional({ r, abierto, onAlternar }) {
  const pacientes = useMemo(() => pacientesDe(r.filas), [r]);
  return (
    <section className="overflow-hidden rounded-xl border border-brand-tan/70 bg-white">
      <button onClick={onAlternar} className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left hover:bg-brand-cream/60" aria-expanded={abierto}>
        <div>
          <p className="text-base font-bold text-gray-900">{r.nombre}</p>
          <p className="text-sm text-gray-600">
            <strong>{r.pacientes}</strong> paciente{r.pacientes === 1 ? "" : "s"} · {r.prestaciones} {r.prestaciones === 1 ? "prestación" : "prestaciones"}
          </p>
        </div>
        <div className="flex items-center gap-5 text-right">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-500">La obra social paga</p>
            <p className="font-heading text-lg font-extrabold text-brand-charcoal">{pesos(r.facturado)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Le corresponde ({r.porcentaje}%)</p>
            <p className="font-heading text-xl font-extrabold text-brand-green">{pesos(r.honorarios)}</p>
          </div>
          <span className="text-gray-400">{abierto ? "▲" : "▼"}</span>
        </div>
      </button>
      {abierto && (
        <div className="border-t border-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-brand-tan/40 text-left text-xs uppercase tracking-wide text-brand-brown">
                  <th className="px-4 py-2">Paciente</th>
                  <th className="px-2 py-2">Obra social</th>
                  <th className="px-2 py-2">Qué se le hizo</th>
                  <th className="px-2 py-2 text-right">Paga la OS</th>
                  <th className="px-4 py-2 text-right">Le corresponde</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {pacientes.map((p) => {
                  const os = [...p.obrasSociales];
                  return (
                    <tr key={p.paciente} className="align-top">
                      <td className="px-4 py-2 font-medium text-gray-900">{p.paciente}</td>
                      <td className="px-2 py-2 text-gray-700">
                        {os.join(", ")}
                        {os.some(esEntreRios) && <span className="ml-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-900">Entre Ríos</span>}
                      </td>
                      <td className="px-2 py-2 text-xs text-gray-600">{p.prestaciones.join(" · ")}</td>
                      <td className="px-2 py-2 text-right tabular-nums">{pesos(p.valorOS)}</td>
                      <td className="px-4 py-2 text-right font-semibold tabular-nums text-brand-green">{pesos(p.honorarios)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-brand-cream font-bold">
                  <td className="px-4 py-2" colSpan={3}>
                    Total de {r.nombre.split(" ")[0]}
                    {r.sinLiquidar > 0 && <span className="ml-2 text-xs font-normal text-gray-500">({pesos(r.sinLiquidar)} de ese total no se liquida, como las estampillas)</span>}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{pesos(r.facturado)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-brand-green">{pesos(r.honorarios)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function Contenido() {
  const hoy = fechaDeHoyISO();
  const mesActual = hoy.slice(0, 7);
  const [mes, setMes] = useState(mesActual);
  const [filas, setFilas] = useState(null);
  const [error, setError] = useState(null);
  const [abiertos, setAbiertos] = useState(() => new Set());
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let vigente = true;
    setFilas(null);
    setError(null);
    const { desde, hasta } = rango(mes);
    obtenerPrestacionesPorObraSocial(desde, hasta)
      .then((f) => vigente && setFilas(f))
      .catch((e) => vigente && setError(e.message));
    return () => {
      vigente = false;
    };
  }, [mes]);

  const profesionales = useMemo(() => (filas ? resumenParaLiquidar(filas) : []), [filas]);
  const totales = useMemo(() => {
    if (!filas) return null;
    return {
      pacientes: new Set(filas.map((f) => f.pacienteId ?? f.paciente)).size,
      prestaciones: filas.reduce((a, f) => a + f.cantidad, 0),
      os: filas.reduce((a, f) => a + totalOS(f), 0),
      honorarios: filas.reduce((a, f) => a + honorariosDe(f), 0),
    };
  }, [filas]);
  const cerrado = mes < mesActual;
  const frase = totales
    ? `${cerrado ? "Cerró" : "Va"} ${nombreMes(mes)} con ${totales.pacientes} paciente${totales.pacientes === 1 ? "" : "s"} atendido${totales.pacientes === 1 ? "" : "s"} por obra social (${totales.prestaciones} prestaciones). Las obras sociales pagan ${pesos(totales.os)} y corresponde liquidar ${pesos(totales.honorarios)} a los profesionales.`
    : "";

  const alternar = (id) =>
    setAbiertos((a) => {
      const n = new Set(a);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  async function copiar() {
    const lineas = [frase, "", ...profesionales.map((p) => `• ${p.nombre}: ${p.pacientes} paciente${p.pacientes === 1 ? "" : "s"} · la OS paga ${pesos(p.facturado)} · le corresponde ${pesos(p.honorarios)}`)];
    try {
      await navigator.clipboard.writeText(lineas.join("\n"));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      window.prompt("Copiá el resumen:", lineas.join("\n"));
    }
  }

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-brown/70">Gerencial</p>
      <h1 className="font-heading text-3xl font-extrabold text-brand-brown">🏥 Obras sociales por profesional</h1>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button onClick={() => setMes(sumarMes(mes, -1))} className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm hover:bg-gray-50" aria-label="Mes anterior">
          ←
        </button>
        <input type="month" value={mes} max={mesActual} onChange={(e) => e.target.value && setMes(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        <button disabled={mes >= mesActual} onClick={() => setMes(sumarMes(mes, 1))} className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-40" aria-label="Mes siguiente">
          →
        </button>
        <span className="text-sm font-semibold capitalize text-gray-700">{nombreMes(mes)}</span>
        {profesionales.length > 0 && (
          <div className="ml-auto flex gap-2 text-sm">
            <button onClick={() => setAbiertos(new Set(profesionales.map((p) => p.id)))} className="rounded-md border border-brand-brown/40 px-3 py-1.5 font-medium text-brand-brown hover:bg-brand-tan/30">
              Abrir todos
            </button>
            <button onClick={() => setAbiertos(new Set())} className="rounded-md border border-brand-brown/40 px-3 py-1.5 font-medium text-brand-brown hover:bg-brand-tan/30">
              Cerrar todos
            </button>
          </div>
        )}
      </div>

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
      {!filas && !error && <p className="mt-4 text-sm text-gray-500">Calculando…</p>}

      {filas && (
        <>
          {filas.length === 0 ? (
            <p className="mt-4 rounded-md border border-brand-tan bg-white px-4 py-3 text-sm text-gray-700">No hay atenciones por obra social en {nombreMes(mes)}.</p>
          ) : (
            <>
              <div className="mt-4 rounded-xl border border-brand-green/40 bg-emerald-50/60 px-4 py-3">
                <p className="text-[15px] leading-relaxed text-gray-900">{frase}</p>
                <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="font-heading text-2xl font-extrabold text-brand-charcoal">{totales.pacientes}</p>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">pacientes</p>
                  </div>
                  <div>
                    <p className="font-heading text-2xl font-extrabold text-brand-charcoal">{pesos(totales.os)}</p>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">pagan las obras sociales</p>
                  </div>
                  <div>
                    <p className="font-heading text-2xl font-extrabold text-brand-green">{pesos(totales.honorarios)}</p>
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">a liquidar a profesionales</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
                  <span>La obra social se liquida a mes vencido, cuando la clínica cobra del intermediario.</span>
                  <button onClick={copiar} className="rounded-md border border-brand-brown/40 bg-white px-3 py-1 text-sm font-medium text-brand-brown hover:bg-brand-tan/30">
                    {copiado ? "✓ Copiado" : "📋 Copiar resumen"}
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3">
                {profesionales.map((r) => (
                  <Profesional key={r.id} r={r} abierto={abiertos.has(r.id)} onAlternar={() => alternar(r.id)} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}

export default function ObrasSocialesPorProfesionalPage() {
  return (
    <SoloDuena>
      <Contenido />
    </SoloDuena>
  );
}
