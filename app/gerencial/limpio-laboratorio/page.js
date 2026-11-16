"use client";

import { useEffect, useMemo, useState } from "react";
import SoloDuena from "@/components/SoloDuena";
import { obtenerTrabajosLaboratorio } from "@/lib/data/laboratorio";
import { obtenerTrabajosLaboratorioPagadosIds } from "@/lib/data/gastos";
import { lineaLimpio, obtenerFinanzasDeTrabajos } from "@/lib/data/limpioLaboratorio";

const pesos = (n) => (n === null || n === undefined ? "—" : `$${Math.round(n).toLocaleString("es-AR")}`);
const fechaCorta = (iso) => (iso ? iso.split("-").reverse().slice(0, 2).join("/") : "");

function Tarjeta({ titulo, valor, pie, destacada }) {
  return (
    <div className={`flex flex-col gap-1 rounded-xl border px-4 py-3 ${destacada ? "border-brand-brown bg-brand-brown text-brand-cream" : "border-brand-tan/60 bg-white"}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${destacada ? "text-brand-tan" : "text-brand-brown/70"}`}>{titulo}</p>
      <p className={`font-heading text-2xl font-extrabold leading-none ${destacada ? "text-white" : "text-brand-charcoal"}`}>{valor}</p>
      {pie && <p className={`text-xs ${destacada ? "text-brand-tan" : "text-gray-500"}`}>{pie}</p>}
    </div>
  );
}

function Chip({ children, tono = "gris" }) {
  const clases = {
    gris: "bg-gray-100 text-gray-700",
    rojo: "bg-red-100 text-red-800",
    ambar: "bg-amber-100 text-amber-900",
    verde: "bg-emerald-100 text-emerald-800",
  };
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${clases[tono]}`}>{children}</span>;
}

function LimpioContenido() {
  const [trabajos, setTrabajos] = useState(null);
  const [finanzas, setFinanzas] = useState({});
  const [pagadosIds, setPagadosIds] = useState(new Set());
  const [error, setError] = useState(null);
  const [mecanico, setMecanico] = useState("");
  const [estado, setEstado] = useState("todos");

  useEffect(() => {
    (async () => {
      try {
        const lista = await obtenerTrabajosLaboratorio();
        setTrabajos(lista);
        const [fin, pagados] = await Promise.all([obtenerFinanzasDeTrabajos(lista), obtenerTrabajosLaboratorioPagadosIds().catch(() => [])]);
        setFinanzas(fin);
        setPagadosIds(new Set(pagados));
      } catch (e) {
        setError(e.message);
      }
    })();
  }, []);

  const mecanicos = useMemo(() => [...new Set((trabajos || []).map((t) => t.laboratorio || "Sin asignar"))].sort(), [trabajos]);

  const filas = useMemo(() => {
    return (trabajos || [])
      .filter((t) => (mecanico ? (t.laboratorio || "Sin asignar") === mecanico : true))
      .filter((t) => (estado === "entregados" ? t.estado === "Entregado" : estado === "curso" ? t.estado !== "Entregado" : true))
      .map((t) => {
        const f = finanzas[t.id] || { pactado: null, cobrado: null, falta: null, plan: null, origen: null, aviso: null, presupuesto: null };
        const costo = Number(t.valor) || 0;
        return { t, f, costo, limpio: lineaLimpio(f, costo), esOrto: t.tipoPaciente === "Ortodoncia" };
      })
      .sort((a, b) => b.t.fechaInicio.localeCompare(a.t.fechaInicio));
  }, [trabajos, finanzas, mecanico, estado]);

  // Totales: solo con los trabajos que tienen todos los datos (precio pactado, lo cobrado y el costo del mecánico).
  const resumen = useMemo(() => {
    const r = { completos: 0, total: filas.length, pactado: 0, cobrado: 0, falta: 0, costo: 0 };
    for (const x of filas) {
      if (x.f.pactado !== null && x.f.cobrado !== null && x.costo > 0) {
        r.completos++;
        r.pactado += x.f.pactado;
        r.cobrado += x.f.cobrado;
        r.falta += x.f.falta || 0;
        r.costo += x.costo;
      }
    }
    return r;
  }, [filas]);

  const porMecanico = useMemo(() => {
    const m = {};
    for (const x of filas) {
      const k = x.t.laboratorio || "Sin asignar";
      const e = (m[k] ||= { nombre: k, trabajos: 0, costo: 0, pagado: 0, sinCosto: 0 });
      e.trabajos++;
      if (x.costo > 0) {
        e.costo += x.costo;
        if (pagadosIds.has(x.t.id)) e.pagado += x.costo;
      } else e.sinCosto++;
    }
    return Object.values(m).sort((a, b) => b.costo - a.costo);
  }, [filas, pagadosIds]);

  if (error) return <main className="mx-auto max-w-6xl p-6"><div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div></main>;

  return (
    <main className="mx-auto max-w-[96rem] p-4 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-brown/70">Gerencial</p>
      <h1 className="font-heading text-3xl font-extrabold text-brand-brown">🧾 Laboratorio: lo que paga el paciente y lo que queda limpio</h1>
      <p className="mt-1 max-w-3xl text-sm text-gray-600">
        Por cada trabajo: lo que se pactó con el paciente en el presupuesto, lo que ya pagó en sus cuotas, lo que cobra el mecánico y lo que queda. El “queda limpio” es{" "}
        <strong>antes de los honorarios del profesional</strong>.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <select value={mecanico} onChange={(e) => setMecanico(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
          <option value="">Todos los mecánicos</option>
          {mecanicos.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
        <div className="flex overflow-hidden rounded-lg border border-brand-tan text-sm">
          {[
            ["todos", "Todos"],
            ["curso", "En curso"],
            ["entregados", "Entregados"],
          ].map(([clave, texto]) => (
            <button key={clave} onClick={() => setEstado(clave)} className={`px-3 py-1.5 font-medium ${estado === clave ? "bg-brand-brown text-white" : "bg-white text-brand-brown hover:bg-brand-tan/30"}`}>
              {texto}
            </button>
          ))}
        </div>
      </div>

      {!trabajos ? (
        <p className="mt-6 text-sm text-gray-500">Cargando…</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
            <Tarjeta titulo="Pactado con pacientes" valor={pesos(resumen.pactado)} />
            <Tarjeta titulo="Cobrado hasta hoy" valor={pesos(resumen.cobrado)} pie={`falta cobrar ${pesos(resumen.falta)}`} />
            <Tarjeta titulo="Cobran los mecánicos" valor={pesos(resumen.costo)} />
            <Tarjeta titulo="Queda limpio hoy" valor={pesos(resumen.cobrado - resumen.costo)} pie="cobrado − mecánico" destacada />
            <Tarjeta titulo="Quedará limpio" valor={pesos(resumen.pactado - resumen.costo)} pie="si terminan de pagar" destacada />
            <Tarjeta
              titulo="Trabajos con todos los datos"
              valor={`${resumen.completos} de ${resumen.total}`}
              pie="los demás no suman: les falta costo o presupuesto"
            />
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-brand-tan/60 bg-white">
            <table className="w-full min-w-[64rem] text-sm">
              <thead className="bg-brand-cream text-xs uppercase tracking-wide text-brand-brown">
                <tr>
                  <th className="px-3 py-2 text-left">Paciente y trabajo</th>
                  <th className="px-3 py-2 text-left">Mecánico</th>
                  <th className="px-3 py-2 text-right">Pactado</th>
                  <th className="px-3 py-2 text-right">Cobrado</th>
                  <th className="px-3 py-2 text-right">Falta cobrar</th>
                  <th className="px-3 py-2 text-right">Cobra el mecánico</th>
                  <th className="px-3 py-2 text-right">Limpio hoy</th>
                  <th className="px-3 py-2 text-right">Limpio final</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-tan/30 tabular-nums">
                {filas.map(({ t, f, costo, limpio, esOrto }) => (
                  <tr key={t.id} className="align-top">
                    <td className="px-3 py-2">
                      <p className="font-semibold text-gray-900">{t.pacienteNombre}</p>
                      <p className="text-xs text-gray-600">
                        {t.tipoTrabajo} · {fechaCorta(t.fechaInicio)} · {t.estado}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {esOrto && <Chip>Ortodoncia: no se calcula</Chip>}
                        {!esOrto && !f.origen && <Chip tono="rojo">No encontré presupuesto ni cobro</Chip>}
                        {!esOrto && f.origen && costo === 0 && <Chip tono="ambar">Falta el costo del mecánico</Chip>}
                        {f.aviso && <Chip tono="ambar">{f.aviso}</Chip>}
                        {f.presupuesto && <Chip>{f.presupuesto}</Chip>}
                        {f.plan && <Chip tono="verde">{f.plan}</Chip>}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-gray-700">{t.laboratorio || "—"}</td>
                    <td className="px-3 py-2 text-right">{pesos(f.pactado)}</td>
                    <td className="px-3 py-2 text-right">{pesos(f.cobrado)}</td>
                    <td className={`px-3 py-2 text-right ${f.falta > 0 ? "font-semibold text-amber-700" : ""}`}>{pesos(f.falta)}</td>
                    <td className="px-3 py-2 text-right">
                      {costo > 0 ? pesos(costo) : "—"}
                      {costo > 0 && <p className="text-[11px] text-gray-500">{pagadosIds.has(t.id) ? "ya pagado" : "sin pagar"}</p>}
                    </td>
                    <td className={`px-3 py-2 text-right font-semibold ${limpio.hoy === null ? "text-gray-400" : limpio.hoy >= 0 ? "text-emerald-700" : "text-red-700"}`}>{pesos(limpio.hoy)}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${limpio.final === null ? "text-gray-400" : limpio.final >= 0 ? "text-emerald-700" : "text-red-700"}`}>{pesos(limpio.final)}</td>
                  </tr>
                ))}
                {filas.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-4 text-center text-gray-500">No hay trabajos con ese filtro.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-2 max-w-4xl text-xs text-gray-500">
            “Cobrado” reparte el pago del plan en proporción: si el plan va pagado al 60 %, a cada trabajo del presupuesto se le toma el 60 % de su importe. “Limpio hoy” es lo cobrado menos lo que
            cobra el mecánico; “limpio final”, lo pactado menos lo que cobra el mecánico. Los trabajos marcados en amarillo conviene revisarlos.
          </p>

          <h2 className="mt-6 font-heading text-lg font-bold text-brand-brown">Por mecánico</h2>
          <div className="mt-2 overflow-x-auto rounded-xl border border-brand-tan/60 bg-white">
            <table className="w-full min-w-[34rem] text-sm">
              <thead className="bg-brand-cream text-xs uppercase tracking-wide text-brand-brown">
                <tr>
                  <th className="px-3 py-2 text-left">Mecánico</th>
                  <th className="px-3 py-2 text-right">Trabajos</th>
                  <th className="px-3 py-2 text-right">Cobra en total</th>
                  <th className="px-3 py-2 text-right">Ya se le pagó</th>
                  <th className="px-3 py-2 text-right">Se le debe</th>
                  <th className="px-3 py-2 text-right">Sin costo cargado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-tan/30 tabular-nums">
                {porMecanico.map((m) => (
                  <tr key={m.nombre}>
                    <td className="px-3 py-2 font-semibold text-gray-900">{m.nombre}</td>
                    <td className="px-3 py-2 text-right">{m.trabajos}</td>
                    <td className="px-3 py-2 text-right">{pesos(m.costo)}</td>
                    <td className="px-3 py-2 text-right text-emerald-700">{pesos(m.pagado)}</td>
                    <td className={`px-3 py-2 text-right font-semibold ${m.costo - m.pagado > 0 ? "text-amber-700" : ""}`}>{pesos(m.costo - m.pagado)}</td>
                    <td className={`px-3 py-2 text-right ${m.sinCosto > 0 ? "font-semibold text-red-700" : "text-gray-500"}`}>{m.sinCosto}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}

export default function LimpioLaboratorioPage() {
  return (
    <SoloDuena>
      <LimpioContenido />
    </SoloDuena>
  );
}
