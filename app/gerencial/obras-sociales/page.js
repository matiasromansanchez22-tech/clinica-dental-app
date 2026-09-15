"use client";

import { useEffect, useMemo, useState } from "react";
import SoloDuenaYContador from "@/components/SoloDuenaYContador";
import { fechaDeHoyISO } from "@/lib/agenda";
import {
  actualizarEstadoFicha,
  actualizarEstadoFichaMasivo,
  agruparBalanceObrasSocialesPorProfesional,
  CATEGORIAS_FICHA,
  ESTADOS_FICHA,
  obtenerFacturacionObrasSociales,
} from "@/lib/data/facturacionObrasSociales";

const NOMBRES_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function formatoMes(mesISO) {
  const [anio, mes] = mesISO.split("-").map(Number);
  return `${NOMBRES_MES[mes - 1]} ${anio}`;
}

function primerYUltimoDiaDelMes(fechaISO) {
  const [anio, mes] = fechaISO.split("-").map(Number);
  const primero = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const ultimoDia = new Date(anio, mes, 0).getDate();
  const ultimo = `${anio}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
  return { primero, ultimo };
}

function colorEstado(estado) {
  if (estado === "Liquidada") return "text-emerald-600";
  if (estado === "Entregada") return "text-sky-600";
  if (estado === "Rechazada") return "text-red-600";
  return "text-amber-600";
}

function ControlObrasSocialesContenido() {
  const hoy = fechaDeHoyISO();
  const [fechaInicio, setFechaInicio] = useState(() => primerYUltimoDiaDelMes(hoy).primero);
  const [fechaFin, setFechaFin] = useState(() => primerYUltimoDiaDelMes(hoy).ultimo);
  const [fichas, setFichas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [filtroObraSocial, setFiltroObraSocial] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [seleccionadas, setSeleccionadas] = useState(new Set());

  async function recargar() {
    setCargando(true);
    try {
      const data = await obtenerFacturacionObrasSociales(fechaInicio, fechaFin);
      setFichas(data);
      setSeleccionadas(new Set());
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaInicio, fechaFin]);

  function irAEsteMes() {
    const { primero, ultimo } = primerYUltimoDiaDelMes(hoy);
    setFechaInicio(primero);
    setFechaFin(ultimo);
  }

  const obrasSociales = useMemo(() => [...new Set(fichas.map((f) => f.obraSocial))].sort(), [fichas]);

  const filasFiltradas = useMemo(() => {
    return fichas
      .filter((f) => !filtroObraSocial || f.obraSocial === filtroObraSocial)
      .filter((f) => !filtroCategoria || f.categoria === filtroCategoria)
      .filter((f) => !filtroEstado || f.estadoFicha === filtroEstado);
  }, [fichas, filtroObraSocial, filtroCategoria, filtroEstado]);

  // Agrupa por obra social, pero separando "Prótesis" aparte cuando la hay
  // (ASOR liquida esas fichas en una transferencia distinta a la de
  // prestaciones comunes de la misma obra social — ej. IAPOS).
  const resumenPorObraSocial = useMemo(() => {
    const mapa = {};
    for (const f of filasFiltradas) {
      const etiqueta = f.categoria === "Prótesis" ? `${f.obraSocial} — Prótesis` : f.obraSocial;
      if (!mapa[etiqueta]) mapa[etiqueta] = { etiqueta, cantidad: 0, total: 0 };
      mapa[etiqueta].cantidad += 1;
      mapa[etiqueta].total += f.valorOS;
    }
    return Object.values(mapa).sort((a, b) => b.total - a.total);
  }, [filasFiltradas]);

  // Balance por profesional y mes: siempre sobre TODAS las fichas del
  // período elegido (sin el filtro de obra social/estado de la tabla de
  // abajo, que es para revisar el detalle), así responde "cuánto le
  // corresponde cobrar a cada uno" sin importar cómo esté filtrada la tabla.
  const [mostrarBalance, setMostrarBalance] = useState(true);
  const balancePorProfesional = useMemo(() => agruparBalanceObrasSocialesPorProfesional(fichas), [fichas]);

  const totalGeneral = filasFiltradas.reduce((acc, f) => acc + f.valorOS, 0);

  async function cambiarEstado(id, estado) {
    try {
      await actualizarEstadoFicha(id, estado);
      setFichas((fs) => fs.map((f) => (f.id === id ? { ...f, estadoFicha: estado } : f)));
    } catch (e) {
      setError(e.message);
    }
  }

  function alternarSeleccion(id) {
    setSeleccionadas((s) => {
      const nuevo = new Set(s);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  }

  function seleccionarTodasFiltradas() {
    setSeleccionadas(new Set(filasFiltradas.map((f) => f.id)));
  }

  async function aplicarEstadoMasivo(estado) {
    if (seleccionadas.size === 0) return;
    try {
      const ids = [...seleccionadas];
      await actualizarEstadoFichaMasivo(ids, estado);
      setFichas((fs) => fs.map((f) => (seleccionadas.has(f.id) ? { ...f, estadoFicha: estado } : f)));
      setSeleccionadas(new Set());
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <main className="mx-auto max-w-7xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">Control de Obras Sociales</h1>
      <p className="mt-1 text-sm text-gray-500">
        Qué prestación se le facturó a cada obra social, por paciente, y qué falta entregar o ya se entregó al
        intermediario a fin de mes.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button onClick={irAEsteMes} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
          Este mes
        </button>
        <input
          type="date"
          value={fechaInicio}
          onChange={(e) => setFechaInicio(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
        <span className="text-sm text-gray-500">a</span>
        <input
          type="date"
          value={fechaFin}
          onChange={(e) => setFechaFin(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
        <select
          value={filtroObraSocial}
          onChange={(e) => setFiltroObraSocial(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="">Todas las obras sociales</option>
          {obrasSociales.map((os) => (
            <option key={os} value={os}>
              {os}
            </option>
          ))}
        </select>
        <select
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="">Todas las categorías</option>
          {CATEGORIAS_FICHA.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="">Todos los estados</option>
          {ESTADOS_FICHA.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <div className="ml-auto rounded-md bg-brand-brown px-3 py-2 text-sm text-white">
          Total: <span className="font-semibold">${totalGeneral.toLocaleString("es-AR")}</span>
        </div>
      </div>

      {resumenPorObraSocial.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-3">
          {resumenPorObraSocial.map((r) => (
            <div key={r.etiqueta} className="rounded-md border border-gray-200 px-3 py-2 text-sm">
              <span className="font-medium text-gray-900">{r.etiqueta}</span>
              <span className="text-gray-500"> — {r.cantidad} prest. — </span>
              <span className="font-semibold text-gray-900">${r.total.toLocaleString("es-AR")}</span>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      <div className="mt-6 rounded-lg border border-gray-200">
        <button
          onClick={() => setMostrarBalance((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <span className="font-semibold text-gray-900">
            📊 Balance por profesional {fechaInicio.slice(0, 7) !== fechaFin.slice(0, 7) ? "y mes" : ""}
          </span>
          <span className="text-sm text-gray-500">{mostrarBalance ? "Ocultar ▲" : "Mostrar ▼"}</span>
        </button>
        {mostrarBalance && (
          <div className="overflow-x-auto border-t border-gray-200">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-600">
                  <th className="px-3 py-2 text-left font-semibold">Mes</th>
                  <th className="px-3 py-2 text-left font-semibold">Profesional</th>
                  <th className="px-3 py-2 text-center font-semibold">Pacientes atendidos</th>
                  <th className="px-3 py-2 text-right font-semibold">Total facturado a OS</th>
                  <th className="px-3 py-2 text-right font-semibold">Le corresponde cobrar</th>
                </tr>
              </thead>
              <tbody>
                {balancePorProfesional.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-center text-gray-500">
                      No hay facturación de obra social en este período.
                    </td>
                  </tr>
                )}
                {balancePorProfesional.map((b) => (
                  <tr key={`${b.mes}|${b.profesionalId}`} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-gray-600">{formatoMes(b.mes)}</td>
                    <td className="px-3 py-2 font-medium text-gray-900">{b.profesional}</td>
                    <td className="px-3 py-2 text-center text-gray-600">{b.cantidadPacientes}</td>
                    <td className="px-3 py-2 text-right text-gray-600">${b.totalFacturado.toLocaleString("es-AR")}</td>
                    <td className="px-3 py-2 text-right font-semibold text-brand-brown">
                      ${Math.round(b.honorarios).toLocaleString("es-AR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button onClick={seleccionarTodasFiltradas} className="text-xs text-blue-600 hover:underline">
          Seleccionar todas las visibles ({filasFiltradas.length})
        </button>
        {seleccionadas.size > 0 && (
          <>
            <span className="text-xs text-gray-500">{seleccionadas.size} seleccionadas —</span>
            {ESTADOS_FICHA.map((v) => (
              <button
                key={v}
                onClick={() => aplicarEstadoMasivo(v)}
                className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
              >
                Marcar {v}
              </button>
            ))}
          </>
        )}
      </div>

      <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-brand-brown text-white">
              <th className="px-2 py-2"></th>
              <th className="px-3 py-2 text-left font-semibold">Fecha</th>
              <th className="px-3 py-2 text-left font-semibold">Paciente</th>
              <th className="px-3 py-2 text-left font-semibold">Obra Social</th>
              <th className="px-3 py-2 text-left font-semibold">Categoría</th>
              <th className="px-3 py-2 text-left font-semibold">N° Afiliado</th>
              <th className="px-3 py-2 text-left font-semibold">Profesional</th>
              <th className="px-3 py-2 text-left font-semibold">Prestación</th>
              <th className="px-2 py-2 text-center font-semibold">Cant.</th>
              <th className="px-3 py-2 text-right font-semibold">Valor OS</th>
              <th className="px-3 py-2 text-left font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr>
                <td colSpan={11} className="px-3 py-4 text-center text-gray-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!cargando && filasFiltradas.length === 0 && (
              <tr>
                <td colSpan={11} className="px-3 py-4 text-center text-gray-500">
                  No hay fichas de obra social registradas en este período.
                </td>
              </tr>
            )}
            {filasFiltradas.map((f) => (
              <tr key={f.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-2 py-2">
                  <input type="checkbox" checked={seleccionadas.has(f.id)} onChange={() => alternarSeleccion(f.id)} />
                </td>
                <td className="px-3 py-2 text-gray-600">{f.fecha}</td>
                <td className="px-3 py-2 font-medium text-gray-900">{f.paciente}</td>
                <td className="px-3 py-2 text-gray-600">{f.obraSocial}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      f.categoria === "Prótesis" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {f.categoria}
                  </span>
                </td>
                <td className="px-3 py-2 text-gray-600">{f.numeroAfiliado || "—"}</td>
                <td className="px-3 py-2 text-gray-600">{f.profesional}</td>
                <td className="px-3 py-2 text-gray-600">
                  {f.prestacion}
                  {f.codigo && <span className="text-gray-400"> ({f.codigo})</span>}
                </td>
                <td className="px-2 py-2 text-center text-gray-600">{f.cantidad}</td>
                <td className="px-3 py-2 text-right text-gray-600">${f.valorOS.toLocaleString("es-AR")}</td>
                <td className="px-3 py-2">
                  <select
                    value={f.estadoFicha}
                    onChange={(e) => cambiarEstado(f.id, e.target.value)}
                    className={`rounded-md border border-gray-300 px-2 py-1 text-xs font-medium ${colorEstado(f.estadoFicha)}`}
                  >
                    {ESTADOS_FICHA.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

export default function ControlObrasSocialesPage() {
  return (
    <SoloDuenaYContador>
      <ControlObrasSocialesContenido />
    </SoloDuenaYContador>
  );
}
