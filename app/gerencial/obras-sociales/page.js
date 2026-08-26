"use client";

import { useEffect, useMemo, useState } from "react";
import SoloDuena from "@/components/SoloDuena";
import { fechaDeHoyISO } from "@/lib/agenda";
import {
  actualizarEstadoFicha,
  actualizarEstadoFichaMasivo,
  ESTADOS_FICHA,
  obtenerFacturacionObrasSociales,
} from "@/lib/data/facturacionObrasSociales";

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
      .filter((f) => !filtroEstado || f.estadoFicha === filtroEstado);
  }, [fichas, filtroObraSocial, filtroEstado]);

  const resumenPorObraSocial = useMemo(() => {
    const mapa = {};
    for (const f of filasFiltradas) {
      if (!mapa[f.obraSocial]) mapa[f.obraSocial] = { obraSocial: f.obraSocial, cantidad: 0, total: 0 };
      mapa[f.obraSocial].cantidad += 1;
      mapa[f.obraSocial].total += f.valorOS;
    }
    return Object.values(mapa).sort((a, b) => b.total - a.total);
  }, [filasFiltradas]);

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
        <div className="ml-auto rounded-md bg-gray-900 px-3 py-2 text-sm text-white">
          Total: <span className="font-semibold">${totalGeneral.toLocaleString("es-AR")}</span>
        </div>
      </div>

      {resumenPorObraSocial.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-3">
          {resumenPorObraSocial.map((r) => (
            <div key={r.obraSocial} className="rounded-md border border-gray-200 px-3 py-2 text-sm">
              <span className="font-medium text-gray-900">{r.obraSocial}</span>
              <span className="text-gray-500"> — {r.cantidad} prest. — </span>
              <span className="font-semibold text-gray-900">${r.total.toLocaleString("es-AR")}</span>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

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
            <tr className="bg-gray-800 text-white">
              <th className="px-2 py-2"></th>
              <th className="px-3 py-2 text-left font-semibold">Fecha</th>
              <th className="px-3 py-2 text-left font-semibold">Paciente</th>
              <th className="px-3 py-2 text-left font-semibold">Obra Social</th>
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
                <td colSpan={10} className="px-3 py-4 text-center text-gray-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!cargando && filasFiltradas.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-4 text-center text-gray-500">
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
    <SoloDuena>
      <ControlObrasSocialesContenido />
    </SoloDuena>
  );
}
