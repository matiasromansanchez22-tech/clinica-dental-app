"use client";

import { useEffect, useMemo, useState } from "react";
import SoloDuena from "@/components/SoloDuena";
import { fechaDeHoyISO } from "@/lib/agenda";
import { esMesDePrueba } from "@/lib/mesesDePrueba";
import {
  PORCENTAJE_COMUNES_POR_DEFECTO,
  calcularBalanceEspecialidades,
  datosDelMes,
  guardarPorcentajeComunesOrtodoncia,
  obtenerDatosBalanceEspecialidades,
  obtenerPorcentajeComunesOrtodoncia,
} from "@/lib/data/balanceEspecialidades";

const NOMBRES_MES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function pesos(n) {
  const r = Math.round(n);
  return (r < 0 ? "-$" : "$") + Math.abs(r).toLocaleString("es-AR");
}

function rangoDelMes(mesISO) {
  const [anio, mes] = mesISO.split("-").map(Number);
  return { desde: `${mesISO}-01`, hasta: `${mesISO}-${String(new Date(anio, mes, 0).getDate()).padStart(2, "0")}` };
}

function descargarCSV(nombre, filas) {
  const celda = (v) => {
    const t = String(v ?? "");
    return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const url = URL.createObjectURL(new Blob(["﻿" + filas.map((l) => l.map(celda).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

function Fila({ etiqueta, general, ortodoncia, comunes, total, negrita, tono, sangria, ayuda }) {
  const color = (n) => (tono === "resultado" ? (n < 0 ? "text-red-700" : "text-emerald-700") : "text-gray-800");
  const celda = (valor) =>
    valor === null || valor === undefined ? (
      <td className="px-3 py-2 text-right text-gray-300">—</td>
    ) : (
      <td className={`px-3 py-2 text-right tabular-nums ${negrita ? "font-semibold" : ""} ${color(valor)}`}>{pesos(valor)}</td>
    );
  return (
    <tr className={`border-t border-gray-100 ${negrita ? "bg-gray-50" : ""}`}>
      <td className={`px-3 py-2 ${negrita ? "font-semibold text-gray-900" : "text-gray-700"} ${sangria ? "pl-6" : ""}`} title={ayuda}>
        {etiqueta}
      </td>
      {celda(general)}
      {celda(ortodoncia)}
      {celda(comunes)}
      {celda(total)}
    </tr>
  );
}

function TablaBalance({ b }) {
  const c = b.columnas;
  const total = (campo) => c.general[campo] + c.ortodoncia[campo] + c.comunes[campo];
  return (
    <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="bg-brand-brown text-white">
            <th className="px-3 py-2 text-left font-semibold"></th>
            <th className="px-3 py-2 text-right font-semibold">Odontología General</th>
            <th className="px-3 py-2 text-right font-semibold">Ortodoncia</th>
            <th className="px-3 py-2 text-right font-semibold">Comunes</th>
            <th className="px-3 py-2 text-right font-semibold">Total clínica</th>
          </tr>
        </thead>
        <tbody>
          <Fila etiqueta="Cobros a pacientes" general={c.general.ingresosPacientes} ortodoncia={c.ortodoncia.ingresosPacientes} comunes={null} total={total("ingresosPacientes")} sangria />
          <Fila etiqueta="Reembolsos de ASOR" general={c.general.ingresosAsor} ortodoncia={null} comunes={null} total={c.general.ingresosAsor} sangria />
          <Fila etiqueta="Otros ingresos (Scanner, etc.)" general={null} ortodoncia={null} comunes={c.comunes.ingresosOtros} total={c.comunes.ingresosOtros} sangria />
          <Fila etiqueta="Ingresos" general={b.ingresos.general} ortodoncia={b.ingresos.ortodoncia} comunes={b.ingresos.comunes} total={b.ingresos.general + b.ingresos.ortodoncia + b.ingresos.comunes} negrita />
          <Fila etiqueta="Honorarios a profesionales" general={-c.general.honorarios} ortodoncia={-c.ortodoncia.honorarios} comunes={null} total={-total("honorarios")} sangria />
          <Fila etiqueta="Gastos propios de la especialidad" general={-c.general.gastosPropios} ortodoncia={-c.ortodoncia.gastosPropios} comunes={null} total={-total("gastosPropios")} sangria />
          <Fila etiqueta="Gastos comunes del mes (sin reserva)" general={null} ortodoncia={null} comunes={-c.comunes.gastosComunes} total={-c.comunes.gastosComunes} sangria />
          <Fila
            etiqueta="Resultado del mes"
            ayuda="Igual al Balance Mensual: ingresos menos lo que sale de la plata del mes, sin lo pagado con la reserva"
            general={b.resultadoMes.general}
            ortodoncia={b.resultadoMes.ortodoncia}
            comunes={b.resultadoMes.comunes}
            total={b.resultadoMesTotal}
            negrita
            tono="resultado"
          />
          <Fila etiqueta="Honorarios pagados con la reserva" general={-c.general.reservaHonorarios} ortodoncia={-c.ortodoncia.reservaHonorarios} comunes={null} total={-total("reservaHonorarios")} sangria />
          <Fila etiqueta="Gastos propios pagados con la reserva" general={-c.general.reservaGastosPropios} ortodoncia={-c.ortodoncia.reservaGastosPropios} comunes={null} total={-total("reservaGastosPropios")} sangria />
          <Fila
            etiqueta={`Gastos comunes repartidos (${b.porcentajeOrtodoncia}% Ortodoncia)`}
            ayuda="Alquiler, sueldos, marketing, insumos, etc. (del mes y de la reserva) menos los otros ingresos, repartidos según el porcentaje elegido"
            general={-b.reparto.general}
            ortodoncia={-b.reparto.ortodoncia}
            comunes={null}
            total={-b.comunesNeto}
            sangria
          />
          <Fila etiqueta="Resultado final" general={b.resultadoFinal.general} ortodoncia={b.resultadoFinal.ortodoncia} comunes={null} total={b.resultadoFinalTotal} negrita tono="resultado" />
        </tbody>
      </table>
    </div>
  );
}

function PaginaBalanceEspecialidades() {
  const hoy = fechaDeHoyISO();
  const [modo, setModo] = useState("mes");
  const [mes, setMes] = useState(hoy.slice(0, 7));
  const [anio, setAnio] = useState(Number(hoy.slice(0, 4)));
  const [porcentaje, setPorcentaje] = useState(PORCENTAJE_COMUNES_POR_DEFECTO);
  const [porcentajeEditado, setPorcentajeEditado] = useState(String(PORCENTAJE_COMUNES_POR_DEFECTO));
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    obtenerPorcentajeComunesOrtodoncia()
      .then((p) => {
        setPorcentaje(p);
        setPorcentajeEditado(String(p));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const { desde, hasta } = modo === "mes" ? rangoDelMes(mes) : { desde: `${anio}-01-01`, hasta: `${anio}-12-31` };
    setCargando(true);
    setError(null);
    obtenerDatosBalanceEspecialidades(desde, hasta)
      .then(setDatos)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [modo, mes, anio]);

  async function guardarPorcentaje() {
    const valor = Number(porcentajeEditado);
    if (Number.isNaN(valor) || valor < 0 || valor > 100) {
      setError("El porcentaje tiene que estar entre 0 y 100.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await guardarPorcentajeComunesOrtodoncia(valor);
      setPorcentaje(valor);
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  const balance = useMemo(() => (datos ? calcularBalanceEspecialidades(datos, porcentaje) : null), [datos, porcentaje]);

  // Año: una fila por mes. Los meses de prueba se muestran pero no suman en el total del año.
  const meses = useMemo(() => {
    if (!datos || modo !== "anio") return [];
    return Array.from({ length: 12 }, (_, i) => {
      const clave = `${anio}-${String(i + 1).padStart(2, "0")}`;
      const b = calcularBalanceEspecialidades(datosDelMes(datos, clave), porcentaje);
      return { clave, nombre: NOMBRES_MES[i], prueba: esMesDePrueba(anio, i + 1), b };
    }).filter((m) => m.b.ingresos.general + m.b.ingresos.ortodoncia + m.b.ingresos.comunes !== 0 || m.b.comunesNeto !== 0);
  }, [datos, modo, anio, porcentaje]);

  const totalAnio = useMemo(() => {
    const reales = meses.filter((m) => !m.prueba);
    const suma = (f) => reales.reduce((acc, m) => acc + f(m.b), 0);
    return {
      ingresosGeneral: suma((b) => b.ingresos.general),
      ingresosOrtodoncia: suma((b) => b.ingresos.ortodoncia),
      finalGeneral: suma((b) => b.resultadoFinal.general),
      finalOrtodoncia: suma((b) => b.resultadoFinal.ortodoncia),
      final: suma((b) => b.resultadoFinalTotal),
    };
  }, [meses]);

  function exportar() {
    if (!balance) return;
    const c = balance.columnas;
    descargarCSV(`balance-especialidades-${modo === "mes" ? mes : anio}.csv`, [
      ["Concepto", "Odontología General", "Ortodoncia", "Comunes", "Total clínica"],
      ["Ingresos", Math.round(balance.ingresos.general), Math.round(balance.ingresos.ortodoncia), Math.round(balance.ingresos.comunes), Math.round(balance.ingresos.general + balance.ingresos.ortodoncia + balance.ingresos.comunes)],
      ["Honorarios a profesionales", -Math.round(c.general.honorarios), -Math.round(c.ortodoncia.honorarios), "", -Math.round(c.general.honorarios + c.ortodoncia.honorarios)],
      ["Gastos propios", -Math.round(c.general.gastosPropios), -Math.round(c.ortodoncia.gastosPropios), "", -Math.round(c.general.gastosPropios + c.ortodoncia.gastosPropios)],
      ["Gastos comunes del mes", "", "", -Math.round(c.comunes.gastosComunes), -Math.round(c.comunes.gastosComunes)],
      ["Resultado del mes", Math.round(balance.resultadoMes.general), Math.round(balance.resultadoMes.ortodoncia), Math.round(balance.resultadoMes.comunes), Math.round(balance.resultadoMesTotal)],
      ["Pagado con la reserva (propio)", -Math.round(c.general.reservaHonorarios + c.general.reservaGastosPropios), -Math.round(c.ortodoncia.reservaHonorarios + c.ortodoncia.reservaGastosPropios), "", ""],
      [`Gastos comunes repartidos (${balance.porcentajeOrtodoncia}% Ortodoncia)`, -Math.round(balance.reparto.general), -Math.round(balance.reparto.ortodoncia), "", -Math.round(balance.comunesNeto)],
      ["Resultado final", Math.round(balance.resultadoFinal.general), Math.round(balance.resultadoFinal.ortodoncia), "", Math.round(balance.resultadoFinalTotal)],
    ]);
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">⚖️ Balance por especialidad</h1>
      <p className="mt-0.5 text-sm text-gray-500">
        Odontología General y Ortodoncia por separado: ingresos, honorarios, gastos propios y su parte de los gastos comunes. Solo para
        las dueñas.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded-md border border-gray-300 text-sm">
          <button onClick={() => setModo("mes")} className={`px-4 py-1.5 ${modo === "mes" ? "bg-brand-brown text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}>
            Mensual
          </button>
          <button onClick={() => setModo("anio")} className={`px-4 py-1.5 ${modo === "anio" ? "bg-brand-brown text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}>
            Anual
          </button>
        </div>
        {modo === "mes" ? (
          <input type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1 text-sm" />
        ) : (
          <select value={anio} onChange={(e) => setAnio(Number(e.target.value))} className="rounded-md border border-gray-300 px-2 py-1 text-sm">
            {[2025, 2026, 2027].map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        )}
        <label className="ml-auto flex items-center gap-2 text-sm text-gray-700" title="Alquiler, sueldos, marketing, insumos, etc. Lo que carga General es el resto">
          Gastos comunes que carga Ortodoncia
          <input
            type="number"
            min={0}
            max={100}
            value={porcentajeEditado}
            onChange={(e) => setPorcentajeEditado(e.target.value)}
            className="w-16 rounded-md border border-gray-300 px-2 py-1 text-right text-sm"
          />
          %
          <button
            onClick={guardarPorcentaje}
            disabled={guardando || Number(porcentajeEditado) === porcentaje}
            className="rounded-md border border-brand-brown/40 px-2 py-1 text-xs font-medium text-brand-brown hover:bg-brand-tan/30 disabled:opacity-50"
          >
            {guardando ? "..." : "Guardar"}
          </button>
        </label>
        <button onClick={exportar} disabled={!balance} className="rounded-md border border-brand-brown/40 px-3 py-1.5 text-sm font-medium text-brand-brown hover:bg-brand-tan/30 disabled:opacity-50">
          ⬇️ Descargar Excel (CSV)
        </button>
      </div>

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
      {modo === "mes" && esMesDePrueba(Number(mes.slice(0, 4)), Number(mes.slice(5))) && (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">Este mes se usó para probar la app.</div>
      )}

      {cargando || !balance ? (
        <p className="mt-6 text-sm text-gray-500">Calculando...</p>
      ) : modo === "mes" ? (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Resultado final — Ortodoncia</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${balance.resultadoFinal.ortodoncia < 0 ? "text-red-700" : "text-emerald-700"}`}>{pesos(balance.resultadoFinal.ortodoncia)}</p>
              <p className="mt-0.5 text-xs text-gray-500">Ingresos {pesos(balance.ingresos.ortodoncia)}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Resultado final — Odontología General</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${balance.resultadoFinal.general < 0 ? "text-red-700" : "text-emerald-700"}`}>{pesos(balance.resultadoFinal.general)}</p>
              <p className="mt-0.5 text-xs text-gray-500">Ingresos {pesos(balance.ingresos.general)}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Resultado final — toda la clínica</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${balance.resultadoFinalTotal < 0 ? "text-red-700" : "text-emerald-700"}`}>{pesos(balance.resultadoFinalTotal)}</p>
              <p className="mt-0.5 text-xs text-gray-500">Gastos comunes del mes: {pesos(balance.comunesNeto)}</p>
            </div>
          </div>

          <TablaBalance b={balance} />

          {balance.categoriasComunes.length > 0 && (
            <>
              <h2 className="mt-6 text-sm font-semibold text-gray-700">Qué hay en los gastos comunes</h2>
              <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full min-w-[360px] border-collapse text-sm">
                  <tbody>
                    {balance.categoriasComunes.map((cat) => (
                      <tr key={cat.categoria} className="border-t border-gray-100 first:border-t-0">
                        <td className="px-3 py-1.5 text-gray-700">{cat.categoria}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-gray-800">{pesos(cat.monto)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="bg-brand-brown text-white">
                  <th className="px-3 py-2 text-left font-semibold">Mes</th>
                  <th className="px-3 py-2 text-right font-semibold">Ingresos General</th>
                  <th className="px-3 py-2 text-right font-semibold">Resultado final General</th>
                  <th className="px-3 py-2 text-right font-semibold">Ingresos Ortodoncia</th>
                  <th className="px-3 py-2 text-right font-semibold">Resultado final Ortodoncia</th>
                  <th className="px-3 py-2 text-right font-semibold">Total clínica</th>
                </tr>
              </thead>
              <tbody>
                {meses.map((m) => (
                  <tr key={m.clave} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-medium text-gray-900">
                      {m.nombre}
                      {m.prueba && <span className="ml-1.5 rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-700">prueba</span>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{pesos(m.b.ingresos.general)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${m.b.resultadoFinal.general < 0 ? "text-red-700" : "text-emerald-700"}`}>{pesos(m.b.resultadoFinal.general)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{pesos(m.b.ingresos.ortodoncia)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${m.b.resultadoFinal.ortodoncia < 0 ? "text-red-700" : "text-emerald-700"}`}>{pesos(m.b.resultadoFinal.ortodoncia)}</td>
                    <td className={`px-3 py-2 text-right font-semibold tabular-nums ${m.b.resultadoFinalTotal < 0 ? "text-red-700" : "text-emerald-700"}`}>{pesos(m.b.resultadoFinalTotal)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                  <td className="px-3 py-2">Total {anio} (sin meses de prueba)</td>
                  <td className="px-3 py-2 text-right tabular-nums">{pesos(totalAnio.ingresosGeneral)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{pesos(totalAnio.finalGeneral)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{pesos(totalAnio.ingresosOrtodoncia)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{pesos(totalAnio.finalOrtodoncia)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{pesos(totalAnio.final)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-gray-500">El detalle de cada mes se ve en la vista Mensual. Los meses de prueba se muestran pero no suman en el total.</p>
        </>
      )}

      <ul className="mt-6 list-disc pl-5 text-xs text-gray-500">
        <li>
          <strong>Resultado del mes</strong> es lo mismo que el Balance Mensual. <strong>Resultado final</strong> además descuenta lo
          pagado con la reserva (alquiler, sueldos, laboratorio, etc.) y reparte los gastos comunes entre las dos especialidades.
        </li>
        <li>
          Los honorarios se asignan según la especialidad del profesional (Ortodoncia → Ortodoncia, el resto → General). Los gastos
          cargados como &quot;General&quot; u &quot;Ortodoncia&quot; son de cada una; los que no tienen especialidad son comunes. Para que el balance sea
          fiel conviene cargar la especialidad en cada gasto.
        </li>
        <li>Los reembolsos de ASOR se cuentan en General; los otros ingresos (Scanner, etc.) se cuentan como comunes.</li>
      </ul>
    </main>
  );
}

export default function BalanceEspecialidadesPage() {
  return (
    <SoloDuena>
      <PaginaBalanceEspecialidades />
    </SoloDuena>
  );
}
