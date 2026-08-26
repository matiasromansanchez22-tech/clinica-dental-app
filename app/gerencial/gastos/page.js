"use client";

import { useEffect, useMemo, useState } from "react";
import ConfiguracionCategoriasGastoModal from "@/components/ConfiguracionCategoriasGastoModal";
import GastoFormModal from "@/components/GastoFormModal";
import SoloDuena from "@/components/SoloDuena";
import { fechaDeHoyISO } from "@/lib/agenda";
import { eliminarGasto, obtenerCategoriasGasto, obtenerGastos } from "@/lib/data/gastos";

function primerYUltimoDiaDelMes(fechaISO) {
  const [anio, mes] = fechaISO.split("-").map(Number);
  const primero = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const ultimoDia = new Date(anio, mes, 0).getDate();
  const ultimo = `${anio}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
  return { primero, ultimo };
}

function GastosContenido() {
  const hoy = fechaDeHoyISO();
  const [fechaInicio, setFechaInicio] = useState(() => primerYUltimoDiaDelMes(hoy).primero);
  const [fechaFin, setFechaFin] = useState(() => primerYUltimoDiaDelMes(hoy).ultimo);
  const [gastos, setGastos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [gastoEnEdicion, setGastoEnEdicion] = useState(null);
  const [mostrarConfigCategorias, setMostrarConfigCategorias] = useState(false);

  async function recargar() {
    setCargando(true);
    try {
      const [g, c] = await Promise.all([obtenerGastos(fechaInicio, fechaFin), obtenerCategoriasGasto()]);
      setGastos(g);
      setCategorias(c);
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

  const gastosFiltrados = useMemo(
    () => gastos.filter((g) => !filtroCategoria || g.categoria === filtroCategoria),
    [gastos, filtroCategoria]
  );

  const totalGeneral = gastosFiltrados.reduce((acc, g) => acc + g.monto, 0);

  const resumenPorCategoria = useMemo(() => {
    const mapa = {};
    for (const g of gastosFiltrados) {
      mapa[g.categoria] = (mapa[g.categoria] || 0) + g.monto;
    }
    return Object.entries(mapa).sort((a, b) => b[1] - a[1]);
  }, [gastosFiltrados]);

  async function borrar(gasto) {
    if (!window.confirm(`¿Borrar el gasto "${gasto.descripcion || gasto.categoria}" de $${gasto.monto.toLocaleString("es-AR")}?`))
      return;
    try {
      await eliminarGasto(gasto.id);
      await recargar();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Gastos</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setMostrarConfigCategorias(true)}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            ⚙ Categorías
          </button>
          <button
            onClick={() => setMostrarNuevo(true)}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            + Nuevo gasto
          </button>
        </div>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Todo lo que sale de la clínica (alquiler, insumos, sueldos, servicios) — la otra mitad del balance mensual.
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
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.nombre}>
              {c.nombre}
            </option>
          ))}
        </select>
        <div className="ml-auto rounded-md bg-gray-900 px-3 py-2 text-sm text-white">
          Total: <span className="font-semibold">${totalGeneral.toLocaleString("es-AR")}</span>
        </div>
      </div>

      {resumenPorCategoria.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-3">
          {resumenPorCategoria.map(([categoria, total]) => (
            <div key={categoria} className="rounded-md border border-gray-200 px-3 py-2 text-sm">
              <span className="text-gray-500">{categoria}: </span>
              <span className="font-semibold text-gray-900">${total.toLocaleString("es-AR")}</span>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="px-3 py-2 text-left font-semibold">Fecha</th>
              <th className="px-3 py-2 text-left font-semibold">Categoría</th>
              <th className="px-3 py-2 text-left font-semibold">Descripción</th>
              <th className="px-3 py-2 text-left font-semibold">Especialidad</th>
              <th className="px-3 py-2 text-right font-semibold">Monto</th>
              <th className="px-3 py-2 text-left font-semibold">Medio</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-gray-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!cargando && gastosFiltrados.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-gray-500">
                  No hay gastos registrados en este período.
                </td>
              </tr>
            )}
            {gastosFiltrados.map((g) => (
              <tr key={g.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-600">{g.fecha}</td>
                <td className="px-3 py-2 font-medium text-gray-900">{g.categoria}</td>
                <td className="px-3 py-2 text-gray-600">{g.descripcion || "—"}</td>
                <td className="px-3 py-2 text-gray-600">{g.especialidad || "General"}</td>
                <td className="px-3 py-2 text-right text-gray-600">${g.monto.toLocaleString("es-AR")}</td>
                <td className="px-3 py-2 text-gray-600">{g.medioPago}</td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => setGastoEnEdicion(g)} className="text-xs text-blue-600 hover:underline">
                    Editar
                  </button>
                  <button onClick={() => borrar(g)} className="ml-3 text-xs text-red-600 hover:underline">
                    Borrar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(mostrarNuevo || gastoEnEdicion) && (
        <GastoFormModal
          gasto={gastoEnEdicion}
          categorias={categorias}
          onClose={() => {
            setMostrarNuevo(false);
            setGastoEnEdicion(null);
          }}
          onGuardado={async () => {
            await recargar();
            setMostrarNuevo(false);
            setGastoEnEdicion(null);
          }}
        />
      )}

      {mostrarConfigCategorias && (
        <ConfiguracionCategoriasGastoModal
          categorias={categorias}
          onClose={() => setMostrarConfigCategorias(false)}
          onCambiado={async () => {
            const c = await obtenerCategoriasGasto();
            setCategorias(c);
          }}
        />
      )}
    </main>
  );
}

export default function GastosPage() {
  return (
    <SoloDuena>
      <GastosContenido />
    </SoloDuena>
  );
}
