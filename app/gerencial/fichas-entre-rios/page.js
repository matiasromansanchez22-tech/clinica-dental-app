"use client";

import { useEffect, useMemo, useState } from "react";
import NuevaFichaEntreRiosModal from "@/components/NuevaFichaEntreRiosModal";
import SoloDuenaYContador from "@/components/SoloDuenaYContador";
import { fechaDeHoyISO } from "@/lib/agenda";
import {
  actualizarEstadoFicha,
  actualizarEstadoFichaMasivo,
  agruparBalanceObrasSocialesPorProfesional,
  CATEGORIAS_FICHA,
  eliminarFichaManual,
  ESTADOS_FICHA,
  obtenerFichasEntreRios,
  OBRAS_SOCIALES_ENTRE_RIOS,
} from "@/lib/data/facturacionObrasSociales";
import { obtenerPacientesActivos } from "@/lib/data/pacientes";
import { obtenerProfesionales } from "@/lib/data/profesionales";

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

function FichasEntreRiosContenido() {
  const hoy = fechaDeHoyISO();
  const [fechaInicio, setFechaInicio] = useState(() => primerYUltimoDiaDelMes(hoy).primero);
  const [fechaFin, setFechaFin] = useState(() => primerYUltimoDiaDelMes(hoy).ultimo);
  const [fichas, setFichas] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [profesionales, setProfesionales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [filtroObraSocial, setFiltroObraSocial] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [seleccionadas, setSeleccionadas] = useState(new Set());
  const [mostrarNueva, setMostrarNueva] = useState(false);

  async function recargar() {
    setCargando(true);
    try {
      const data = await obtenerFichasEntreRios(fechaInicio, fechaFin);
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

  useEffect(() => {
    Promise.all([obtenerPacientesActivos(), obtenerProfesionales()])
      .then(([pac, prof]) => {
        setPacientes(pac);
        setProfesionales(prof);
      })
      .catch((e) => setError(e.message));
  }, []);

  function irAEsteMes() {
    const { primero, ultimo } = primerYUltimoDiaDelMes(hoy);
    setFechaInicio(primero);
    setFechaFin(ultimo);
  }

  const filasFiltradas = useMemo(() => {
    return fichas
      .filter((f) => !filtroObraSocial || f.obraSocial === filtroObraSocial)
      .filter((f) => !filtroCategoria || f.categoria === filtroCategoria)
      .filter((f) => !filtroEstado || f.estadoFicha === filtroEstado);
  }, [fichas, filtroObraSocial, filtroCategoria, filtroEstado]);

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

  async function borrarFicha(ficha) {
    if (!window.confirm(`¿Borrar la ficha de "${ficha.paciente}" (${ficha.prestacion})?`)) return;
    try {
      await eliminarFichaManual(ficha.id);
      await recargar();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <main className="mx-auto max-w-7xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Fichas Entre Ríos</h1>
        <button
          onClick={() => setMostrarNueva(true)}
          className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark"
        >
          + Nueva ficha manual
        </button>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Swiss Medical, Osde y Sancor Salud — solo Catalina está habilitada para estas prestaciones, y se facturan y
        entregan en Entre Ríos (no por ASOR). Se cargan solas al cobrar el coseguro en Caja, o se pueden agregar acá a
        mano.
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
          <option value="">Todas</option>
          {OBRAS_SOCIALES_ENTRE_RIOS.map((os) => (
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
                  <th className="px-3 py-2 text-right font-semibold">Total facturado</th>
                  <th className="px-3 py-2 text-right font-semibold">Le corresponde cobrar</th>
                </tr>
              </thead>
              <tbody>
                {balancePorProfesional.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-center text-gray-500">
                      No hay fichas en este período.
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
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr>
                <td colSpan={12} className="px-3 py-4 text-center text-gray-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!cargando && filasFiltradas.length === 0 && (
              <tr>
                <td colSpan={12} className="px-3 py-4 text-center text-gray-500">
                  No hay fichas registradas en este período.
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
                <td className="px-3 py-2 text-right">
                  {f.cargadaAMano && (
                    <button onClick={() => borrarFicha(f)} className="text-xs text-red-600 hover:underline">
                      Borrar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {mostrarNueva && (
        <NuevaFichaEntreRiosModal
          pacientes={pacientes}
          profesionales={profesionales}
          onClose={() => setMostrarNueva(false)}
          onGuardado={async () => {
            setMostrarNueva(false);
            await recargar();
          }}
        />
      )}
    </main>
  );
}

export default function FichasEntreRiosPage() {
  return (
    <SoloDuenaYContador>
      <FichasEntreRiosContenido />
    </SoloDuenaYContador>
  );
}
