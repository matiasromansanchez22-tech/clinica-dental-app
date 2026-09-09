"use client";

import { useEffect, useState } from "react";
import SoloDuena from "@/components/SoloDuena";
import { fechaDeHoyISO } from "@/lib/agenda";
import { obtenerMetaMes, guardarMetaMes, obtenerMetasHistorial } from "@/lib/data/metas";
import { obtenerResumenMensual, obtenerTendenciaMensual } from "@/lib/data/estadisticas";

const NOMBRES_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function formatoPesos(n) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

function formatoNumero(n) {
  return Math.round(n).toLocaleString("es-AR");
}

function TarjetaMeta({ etiqueta, valorActual, objetivo, formato, proyeccion }) {
  const tieneMeta = objetivo !== null && objetivo !== undefined && Number(objetivo) > 0;
  const porcentaje = tieneMeta ? Math.min(100, (valorActual / objetivo) * 100) : 0;
  const alcanzado = tieneMeta && valorActual >= objetivo;

  return (
    <div
      className={`rounded-lg border-2 px-4 py-3 ${alcanzado ? "border-emerald-400 bg-emerald-50" : "border-gray-200 bg-white"}`}
    >
      <p className="text-xs font-semibold uppercase text-gray-500">{etiqueta}</p>
      <p className={`mt-1 text-2xl font-bold ${alcanzado ? "text-emerald-700" : "text-gray-900"}`}>
        {formato(valorActual)}
      </p>
      {tieneMeta ? (
        <>
          <p className="text-xs text-gray-500">de {formato(objetivo)}</p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className={`h-full rounded-full ${alcanzado ? "bg-emerald-500" : "bg-brand-brown"}`}
              style={{ width: `${porcentaje}%` }}
            />
          </div>
          <p className="mt-1 text-xs font-medium text-gray-600">
            {porcentaje.toFixed(0)}% alcanzado{alcanzado ? " 🎉" : ""}
          </p>
          {proyeccion !== null && !alcanzado && (
            <p className={`mt-1 text-xs ${proyeccion >= objetivo ? "text-emerald-600" : "text-amber-600"}`}>
              Al ritmo actual, terminarías el mes en {formato(proyeccion)}
              {proyeccion >= objetivo ? " — llegarías a la meta" : ` — faltarían ${formato(objetivo - proyeccion)}`}
            </p>
          )}
        </>
      ) : (
        <p className="mt-1 text-xs text-gray-400">Sin meta definida para este mes.</p>
      )}
    </div>
  );
}

function FormularioMetas({ meta, guardando, onGuardar, onCancelar }) {
  const [ingresosObjetivo, setIngresosObjetivo] = useState(meta?.ingresosObjetivo ?? "");
  const [balanceObjetivo, setBalanceObjetivo] = useState(meta?.balanceObjetivo ?? "");
  const [pacientesNuevosObjetivo, setPacientesNuevosObjetivo] = useState(meta?.pacientesNuevosObjetivo ?? "");
  const [observaciones, setObservaciones] = useState(meta?.observaciones || "");

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <p className="mb-3 text-sm font-semibold text-gray-700">Definir metas de este mes</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Meta de ingresos ($)
          <input
            type="number"
            value={ingresosObjetivo}
            onChange={(e) => setIngresosObjetivo(e.target.value)}
            placeholder="Ej. 5000000"
            className="rounded-md border border-gray-300 px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Meta de balance / ganancia ($)
          <input
            type="number"
            value={balanceObjetivo}
            onChange={(e) => setBalanceObjetivo(e.target.value)}
            placeholder="Ej. 1500000"
            className="rounded-md border border-gray-300 px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Meta de pacientes nuevos
          <input
            type="number"
            value={pacientesNuevosObjetivo}
            onChange={(e) => setPacientesNuevosObjetivo(e.target.value)}
            placeholder="Ej. 20"
            className="rounded-md border border-gray-300 px-2 py-1.5"
          />
        </label>
      </div>
      <label className="mt-3 flex flex-col gap-1 text-sm text-gray-700">
        Observaciones (opcional)
        <textarea
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
          rows={2}
          className="rounded-md border border-gray-300 px-2 py-1.5"
        />
      </label>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancelar}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={guardando}
          onClick={() => onGuardar({ ingresosObjetivo, balanceObjetivo, pacientesNuevosObjetivo, observaciones })}
          className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
        >
          {guardando ? "Guardando..." : "Guardar metas"}
        </button>
      </div>
    </div>
  );
}

function MetasContenido() {
  const hoy = fechaDeHoyISO();
  const mesActual = hoy.slice(0, 7);
  const [mesElegido, setMesElegido] = useState(mesActual);
  const [resumen, setResumen] = useState(null);
  const [meta, setMeta] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const [anio, mesNum] = mesElegido.split("-").map(Number);
  const esFuturo = mesElegido > mesActual;
  const esMesActual = mesElegido === mesActual;

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      const [resumenM, metaM, tendencia, historialMetas] = await Promise.all([
        esFuturo ? Promise.resolve(null) : obtenerResumenMensual(anio, mesNum),
        obtenerMetaMes(anio, mesNum),
        obtenerTendenciaMensual(6),
        obtenerMetasHistorial(6),
      ]);
      setResumen(resumenM);
      setMeta(metaM);
      setHistorial(
        tendencia.map((t) => ({ ...t, meta: historialMetas.find((h) => h.anio === t.anio && h.mes === t.mes) }))
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
    setEditando(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesElegido]);

  async function guardarMetas(datos) {
    setGuardando(true);
    try {
      const nuevaMeta = await guardarMetaMes(anio, mesNum, datos);
      setMeta(nuevaMeta);
      setEditando(false);
      const historialMetas = await obtenerMetasHistorial(6);
      setHistorial((h) => h.map((t) => ({ ...t, meta: historialMetas.find((m) => m.anio === t.anio && m.mes === t.mes) })));
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  const diaDelMes = esMesActual ? new Date().getDate() : null;
  const diasDelMes = new Date(anio, mesNum, 0).getDate();

  function proyeccionDe(valorActual) {
    if (!esMesActual || !diaDelMes) return null;
    return (valorActual / diaDelMes) * diasDelMes;
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">🎯 Metas y Seguimiento</h1>
      <p className="mt-1 text-sm text-gray-500">
        Definí un objetivo de ingresos, balance y pacientes nuevos para el mes, y vas viendo en vivo cómo venís
        contra esa meta.
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase text-gray-500">
          {NOMBRES_MES[mesNum - 1]} {anio}
        </h2>
        <div className="flex items-center gap-2 text-sm">
          <input
            type="month"
            value={mesElegido}
            onChange={(e) => setMesElegido(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1"
          />
          {mesElegido !== mesActual && (
            <button onClick={() => setMesElegido(mesActual)} className="text-xs text-brand-brown hover:underline">
              Volver a este mes
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      {cargando && <p className="mt-4 text-sm text-gray-500">Cargando...</p>}

      {!cargando && esFuturo && (
        <p className="mt-4 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500">
          Este mes todavía no arrancó — podés dejar la meta cargada para cuando llegue.
        </p>
      )}

      {!cargando && !esFuturo && resumen && (
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <TarjetaMeta
            etiqueta="Ingresos del mes"
            valorActual={resumen.balance.ingresosTotal}
            objetivo={meta?.ingresosObjetivo}
            formato={formatoPesos}
            proyeccion={proyeccionDe(resumen.balance.ingresosTotal)}
          />
          <TarjetaMeta
            etiqueta="Balance del mes"
            valorActual={resumen.balance.balance}
            objetivo={meta?.balanceObjetivo}
            formato={formatoPesos}
            proyeccion={proyeccionDe(resumen.balance.balance)}
          />
          <TarjetaMeta
            etiqueta="Pacientes nuevos"
            valorActual={resumen.pacientesNuevosTotal}
            objetivo={meta?.pacientesNuevosObjetivo}
            formato={formatoNumero}
            proyeccion={proyeccionDe(resumen.pacientesNuevosTotal)}
          />
        </div>
      )}

      {!cargando && (
        <div className="mt-4">
          {editando ? (
            <FormularioMetas
              meta={meta}
              guardando={guardando}
              onGuardar={guardarMetas}
              onCancelar={() => setEditando(false)}
            />
          ) : (
            <button
              onClick={() => setEditando(true)}
              className="rounded-md border border-brand-brown/40 px-4 py-2 text-sm font-medium text-brand-brown hover:bg-brand-tan/30"
            >
              🎯 {meta?.ingresosObjetivo || meta?.balanceObjetivo || meta?.pacientesNuevosObjetivo ? "Editar" : "Definir"} metas
              de {NOMBRES_MES[mesNum - 1]}
            </button>
          )}
        </div>
      )}

      <h2 className="mt-8 mb-2 text-sm font-semibold uppercase text-gray-500">Últimos 6 meses</h2>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-brand-brown text-white">
              <th className="px-3 py-2 text-left font-semibold">Mes</th>
              <th className="px-3 py-2 text-right font-semibold">Ingresos</th>
              <th className="px-3 py-2 text-right font-semibold">Meta ingresos</th>
              <th className="px-3 py-2 text-right font-semibold">Balance</th>
              <th className="px-3 py-2 text-right font-semibold">Meta balance</th>
              <th className="px-3 py-2 text-right font-semibold">Pacientes nuevos</th>
              <th className="px-3 py-2 text-right font-semibold">Meta pacientes</th>
            </tr>
          </thead>
          <tbody>
            {historial.map((h) => (
              <tr key={`${h.anio}-${h.mes}`} className="border-t border-gray-100">
                <td className="px-3 py-2 font-medium text-gray-900">
                  {NOMBRES_MES[h.mes - 1]} {h.anio}
                </td>
                <td className="px-3 py-2 text-right text-gray-600">{formatoPesos(h.balance.ingresosTotal)}</td>
                <td className="px-3 py-2 text-right text-gray-400">
                  {h.meta?.ingresosObjetivo ? formatoPesos(h.meta.ingresosObjetivo) : "—"}
                </td>
                <td className="px-3 py-2 text-right text-gray-600">{formatoPesos(h.balance.balance)}</td>
                <td className="px-3 py-2 text-right text-gray-400">
                  {h.meta?.balanceObjetivo ? formatoPesos(h.meta.balanceObjetivo) : "—"}
                </td>
                <td className="px-3 py-2 text-right text-gray-600">{h.pacientesNuevosTotal}</td>
                <td className="px-3 py-2 text-right text-gray-400">
                  {h.meta?.pacientesNuevosObjetivo ? h.meta.pacientesNuevosObjetivo : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

export default function MetasPage() {
  return (
    <SoloDuena>
      <MetasContenido />
    </SoloDuena>
  );
}
