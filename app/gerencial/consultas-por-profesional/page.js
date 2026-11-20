"use client";

import { useEffect, useMemo, useState } from "react";
import SoloDuena from "@/components/SoloDuena";
import { fechaDeHoyISO } from "@/lib/agenda";
import { PORCENTAJE_CONSULTAS, obtenerConsultasDelPeriodo, resumenPorProfesional } from "@/lib/data/consultasPorProfesional";

// Consultas por profesional, en versión simple: un mes, una "cortina" por profesional con TODAS las consultas cobradas, lo que le
// corresponde (15% del valor de la consulta), si ya se le liquidó y con qué tratamiento siguió cada paciente después de la consulta.

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const pesos = (n) => `$${Math.round(n).toLocaleString("es-AR")}`;
const dm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

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

const ESTILO_DESPUES = {
  empezo: "text-emerald-800",
  aceptado: "text-emerald-800",
  presupuesto: "text-amber-800",
  no: "text-gray-500",
};
const ICONO_DESPUES = { empezo: "✅", aceptado: "🟢", presupuesto: "🟡", no: "⚪" };

function Estado({ c }) {
  if (c.estado === "liquidada") {
    return (
      <div>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">Liquidada{c.fechaLiquidacion ? ` ${dm(c.fechaLiquidacion)}` : ""}</span>
        {c.pagado !== null && <p className="mt-0.5 text-[11px] text-gray-500">Se pagó {pesos(c.pagado)}</p>}
        {c.deMas > 0 && <p className="mt-0.5 text-[11px] font-semibold text-amber-700">Pagada de más: {pesos(c.deMas)}</p>}
      </div>
    );
  }
  if (c.estado === "parcial") return <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">Pago parcial ({pesos(c.pagado)})</span>;
  return (
    <div>
      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">Sin liquidar</span>
      {c.marcadaSinHonorarios && <p className="mt-0.5 text-[11px] font-semibold text-amber-700">Se cobró marcada «sin honorarios»</p>}
    </div>
  );
}

function Profesional({ r, abierto, onAlternar }) {
  return (
    <section className="overflow-hidden rounded-xl border border-brand-tan/70 bg-white">
      <button onClick={onAlternar} className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left hover:bg-brand-cream/60" aria-expanded={abierto}>
        <div>
          <p className="text-base font-bold text-gray-900">{r.nombre}</p>
          <p className="text-sm text-gray-600">
            <strong>{r.cantidad}</strong> {r.cantidad === 1 ? "consulta" : "consultas"} · empezaron tratamiento <strong>{r.empezaron}</strong>
          </p>
        </div>
        <div className="flex items-center gap-5 text-right">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Cobrado</p>
            <p className="font-heading text-lg font-extrabold text-brand-charcoal">{pesos(r.cobrado)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Le falta cobrar ({PORCENTAJE_CONSULTAS}%)</p>
            <p className="font-heading text-xl font-extrabold text-brand-green">{pesos(r.falta)}</p>
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
                  <th className="px-4 py-2">Fecha</th>
                  <th className="px-2 py-2">Paciente</th>
                  <th className="px-2 py-2">Con qué siguió después de la consulta</th>
                  <th className="px-2 py-2 text-right">Cobrado</th>
                  <th className="px-2 py-2 text-right">{PORCENTAJE_CONSULTAS}%</th>
                  <th className="px-4 py-2">Liquidación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {r.filas.map((c) => (
                  <tr key={c.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-2 text-gray-600">{dm(c.fecha)}</td>
                    <td className="px-2 py-2">
                      <p className="font-medium text-gray-900">{c.paciente}</p>
                      <p className="text-[11px] text-gray-500">{c.tipo}</p>
                    </td>
                    <td className={`px-2 py-2 text-xs ${ESTILO_DESPUES[c.despues.estado]}`}>
                      {ICONO_DESPUES[c.despues.estado]} {c.despues.texto}
                      {c.despues.indicado && c.despues.estado !== "empezo" && <p className="text-[11px] text-gray-500">Se había indicado: {c.despues.indicado}</p>}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">{pesos(c.cobrado)}</td>
                    <td className="px-2 py-2 text-right font-semibold tabular-nums text-brand-green">{pesos(c.corresponde)}</td>
                    <td className="px-4 py-2">
                      <Estado c={c} />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-brand-cream font-bold">
                  <td className="px-4 py-2" colSpan={3}>
                    Total de {r.nombre.split(" ")[0]}
                    {r.sinHonorarios > 0 && <span className="ml-2 text-xs font-normal text-amber-700">({r.sinHonorarios} marcadas «sin honorarios»: {pesos(r.montoSinHonorarios)})</span>}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">{pesos(r.cobrado)}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-brand-green">{pesos(r.corresponde)}</td>
                  <td className="px-4 py-2 text-xs font-semibold text-gray-700">Falta: {pesos(r.falta)}</td>
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
  const mesActual = fechaDeHoyISO().slice(0, 7);
  const [mes, setMes] = useState(mesActual);
  const [consultas, setConsultas] = useState(null);
  const [error, setError] = useState(null);
  const [abiertos, setAbiertos] = useState(() => new Set());
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let vigente = true;
    setConsultas(null);
    setError(null);
    const { desde, hasta } = rango(mes);
    obtenerConsultasDelPeriodo(desde, hasta)
      .then((f) => vigente && setConsultas(f))
      .catch((e) => vigente && setError(e.message));
    return () => {
      vigente = false;
    };
  }, [mes]);

  const profesionales = useMemo(() => (consultas ? resumenPorProfesional(consultas) : []), [consultas]);
  const t = useMemo(() => {
    if (!consultas) return null;
    return {
      cantidad: consultas.length,
      cobrado: consultas.reduce((a, c) => a + c.cobrado, 0),
      corresponde: consultas.reduce((a, c) => a + c.corresponde, 0),
      falta: consultas.reduce((a, c) => a + c.falta, 0),
      empezaron: consultas.filter((c) => c.despues.estado === "empezo" || c.despues.estado === "aceptado").length,
      deMas: consultas.reduce((a, c) => a + c.deMas, 0),
      sinHon: consultas.filter((c) => c.marcadaSinHonorarios && c.estado === "sin").length,
    };
  }, [consultas]);
  const cerrado = mes < mesActual;
  const frase = t
    ? `${cerrado ? "Cerró" : "Va"} ${nombreMes(mes)} con ${t.cantidad} consulta${t.cantidad === 1 ? "" : "s"} cobrada${t.cantidad === 1 ? "" : "s"} (${pesos(t.cobrado)}). ${t.empezaron === 1 ? "1 paciente empezó" : `${t.empezaron} pacientes empezaron`} tratamiento después. Al ${PORCENTAJE_CONSULTAS}% les corresponde a los profesionales ${pesos(t.corresponde)}: falta liquidar ${pesos(t.falta)}.`
    : "";

  const alternar = (id) =>
    setAbiertos((a) => {
      const n = new Set(a);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  async function copiar() {
    const lineas = [frase, "", ...profesionales.map((p) => `• ${p.nombre}: ${p.cantidad} consulta${p.cantidad === 1 ? "" : "s"} · cobrado ${pesos(p.cobrado)} · falta liquidar ${pesos(p.falta)}`)];
    try {
      await navigator.clipboard.writeText(lineas.join("\n"));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      window.prompt("Copiá el resumen:", lineas.join("\n"));
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-brown/70">Gerencial</p>
      <h1 className="font-heading text-3xl font-extrabold text-brand-brown">🩺 Consultas por profesional</h1>

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
      {!consultas && !error && <p className="mt-4 text-sm text-gray-500">Calculando…</p>}

      {consultas && consultas.length === 0 && <p className="mt-4 rounded-md border border-brand-tan bg-white px-4 py-3 text-sm text-gray-700">No hay consultas cobradas en {nombreMes(mes)}.</p>}

      {consultas && consultas.length > 0 && (
        <>
          <div className="mt-4 rounded-xl border border-brand-green/40 bg-emerald-50/60 px-4 py-3">
            <p className="text-[15px] leading-relaxed text-gray-900">{frase}</p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
              <div>
                <p className="font-heading text-2xl font-extrabold text-brand-charcoal">{t.cantidad}</p>
                <p className="text-[11px] uppercase tracking-wide text-gray-500">consultas</p>
              </div>
              <div>
                <p className="font-heading text-2xl font-extrabold text-brand-charcoal">{t.empezaron}</p>
                <p className="text-[11px] uppercase tracking-wide text-gray-500">empezaron tratamiento</p>
              </div>
              <div>
                <p className="font-heading text-2xl font-extrabold text-brand-charcoal">{pesos(t.corresponde)}</p>
                <p className="text-[11px] uppercase tracking-wide text-gray-500">corresponde ({PORCENTAJE_CONSULTAS}%)</p>
              </div>
              <div>
                <p className="font-heading text-2xl font-extrabold text-brand-green">{pesos(t.falta)}</p>
                <p className="text-[11px] uppercase tracking-wide text-gray-500">falta liquidar</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
              <span>
                {t.sinHon > 0 ? `${t.sinHon} consultas se cobraron marcadas «sin honorarios» (la liquidación de la app no las toma). ` : ""}
                {t.deMas > 0 ? `Se pagó de más ${pesos(t.deMas)} en consultas ya liquidadas.` : ""}
              </span>
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
    </main>
  );
}

export default function ConsultasPorProfesionalPage() {
  return (
    <SoloDuena>
      <Contenido />
    </SoloDuena>
  );
}
