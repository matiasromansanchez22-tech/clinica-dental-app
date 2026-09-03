"use client";

import { useEffect, useState } from "react";
import GestionarRodantesModal from "@/components/GestionarRodantesModal";
import RegistrarTraspasoStockModal from "@/components/RegistrarTraspasoStockModal";
import SoloDuenaYLaboratorio from "@/components/SoloDuenaYLaboratorio";
import { useAuth } from "@/lib/auth/AuthProvider";
import { fechaDeHoyISO } from "@/lib/agenda";
import {
  actualizarCantidadStock,
  actualizarInsumoStock,
  cerrarSemanaStock,
  crearInsumoStock,
  eliminarInsumoStock,
  eliminarMovimientoStock,
  obtenerCantidadesStock,
  obtenerCierreSemanal,
  obtenerInsumosStock,
  obtenerMovimientosSemana,
  obtenerRodantes,
  SECTORES_STOCK,
} from "@/lib/data/stock";

function fmt(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function lunesYViernesDeSemana(fechaISO) {
  const [anio, mes, dia] = fechaISO.split("-").map(Number);
  const fecha = new Date(anio, mes - 1, dia);
  const diasDesdeLunes = (fecha.getDay() + 6) % 7;
  const lunes = new Date(fecha);
  lunes.setDate(fecha.getDate() - diasDesdeLunes);
  const viernes = new Date(lunes);
  viernes.setDate(lunes.getDate() + 4);
  return { lunes: fmt(lunes), viernes: fmt(viernes) };
}

function sumarSemanas(fechaISO, delta) {
  const [anio, mes, dia] = fechaISO.split("-").map(Number);
  const fecha = new Date(anio, mes - 1, dia);
  fecha.setDate(fecha.getDate() + delta * 7);
  return fmt(fecha);
}

function formatoFechaCorta(fechaISO) {
  const [, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}`;
}

function CeldaCantidad({ valor, onGuardar }) {
  return (
    <input
      type="number"
      min={0}
      defaultValue={valor}
      onBlur={(e) => onGuardar(e.target.value)}
      className="w-20 rounded-md border border-gray-300 px-2 py-1 text-right text-sm"
    />
  );
}

function StockContenido() {
  const { user, perfil } = useAuth();
  const hoy = fechaDeHoyISO();
  const [rodantes, setRodantes] = useState([]);
  const [insumos, setInsumos] = useState([]);
  const [cantidades, setCantidades] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [mostrarRodantes, setMostrarRodantes] = useState(false);
  const [mostrarTraspaso, setMostrarTraspaso] = useState(false);
  const [sectoresAbiertos, setSectoresAbiertos] = useState(() => new Set());
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoSector, setNuevoSector] = useState(SECTORES_STOCK[0]);
  const [guardandoInsumo, setGuardandoInsumo] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [editNombre, setEditNombre] = useState("");
  const [editSector, setEditSector] = useState(SECTORES_STOCK[0]);
  const [editObservaciones, setEditObservaciones] = useState("");
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);

  const [semanaRef, setSemanaRef] = useState(hoy);
  const [movimientos, setMovimientos] = useState([]);
  const [cierreSemanal, setCierreSemanal] = useState(null);
  const [cerrando, setCerrando] = useState(false);
  const [mensajeSemana, setMensajeSemana] = useState(null);
  const { lunes, viernes } = lunesYViernesDeSemana(semanaRef);

  const deposito = rodantes.find((r) => r.es_deposito);
  const rodantesDestino = rodantes.filter((r) => !r.es_deposito);

  async function recargar() {
    setCargando(true);
    try {
      const [r, i, c] = await Promise.all([obtenerRodantes(), obtenerInsumosStock(), obtenerCantidadesStock()]);
      setRodantes(r);
      setInsumos(i);
      setCantidades(c);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  async function recargarSemana() {
    setMensajeSemana(null);
    try {
      const [mov, cierre] = await Promise.all([obtenerMovimientosSemana(lunes, viernes), obtenerCierreSemanal(lunes, viernes)]);
      setMovimientos(mov);
      setCierreSemanal(cierre);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    recargar();
  }, []);

  useEffect(() => {
    recargarSemana();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semanaRef]);

  function cantidadDe(insumoId, rodanteId) {
    return cantidades.find((c) => c.insumo_id === insumoId && c.rodante_id === rodanteId)?.cantidad || 0;
  }

  function totalDe(insumoId) {
    return cantidades.filter((c) => c.insumo_id === insumoId).reduce((acc, c) => acc + Number(c.cantidad), 0);
  }

  async function guardarCantidadDeposito(insumoId, valor) {
    setError(null);
    try {
      await actualizarCantidadStock(insumoId, deposito.id, valor);
      setCantidades((c) => {
        const idx = c.findIndex((x) => x.insumo_id === insumoId && x.rodante_id === deposito.id);
        const nuevaCantidad = Number(valor) || 0;
        if (idx >= 0) {
          const copia = [...c];
          copia[idx] = { ...copia[idx], cantidad: nuevaCantidad };
          return copia;
        }
        return [...c, { insumo_id: insumoId, rodante_id: deposito.id, cantidad: nuevaCantidad }];
      });
    } catch (e) {
      setError(e.message);
    }
  }

  async function agregarInsumo(e) {
    e.preventDefault();
    if (!nuevoNombre.trim()) return;
    setGuardandoInsumo(true);
    setError(null);
    try {
      const nuevo = await crearInsumoStock(nuevoNombre.trim(), nuevoSector);
      setInsumos((i) => [...i, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setNuevoNombre("");
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardandoInsumo(false);
    }
  }

  function toggleSector(sector) {
    setSectoresAbiertos((set) => {
      const nuevo = new Set(set);
      if (nuevo.has(sector)) nuevo.delete(sector);
      else nuevo.add(sector);
      return nuevo;
    });
  }

  function empezarEdicion(insumo) {
    setEditandoId(insumo.id);
    setEditNombre(insumo.nombre);
    setEditSector(insumo.sector);
    setEditObservaciones(insumo.observaciones || "");
  }

  async function guardarEdicion(insumo) {
    if (!editNombre.trim()) return;
    setGuardandoEdicion(true);
    setError(null);
    try {
      const actualizado = await actualizarInsumoStock(insumo.id, {
        nombre: editNombre.trim(),
        sector: editSector,
        observaciones: editObservaciones.trim(),
      });
      setInsumos((i) => i.map((x) => (x.id === insumo.id ? actualizado : x)).sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setEditandoId(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardandoEdicion(false);
    }
  }

  async function borrarInsumo(insumo) {
    if (!window.confirm(`¿Borrar "${insumo.nombre}" de la lista de stock? Se pierden las cantidades cargadas.`)) return;
    try {
      await eliminarInsumoStock(insumo.id);
      setInsumos((i) => i.filter((x) => x.id !== insumo.id));
      setCantidades((c) => c.filter((x) => x.insumo_id !== insumo.id));
    } catch (e) {
      setError(e.message);
    }
  }

  async function borrarMovimiento(mov) {
    if (!window.confirm(`¿Deshacer el traspaso de ${mov.cantidad} × ${mov.insumo?.nombre} a ${mov.rodante?.nombre}?`)) return;
    try {
      await eliminarMovimientoStock(mov);
      await recargar();
      await recargarSemana();
    } catch (e) {
      setError(e.message);
    }
  }

  const resumenPorInsumo = (() => {
    const mapa = {};
    movimientos.forEach((m) => {
      const id = m.insumo?.id;
      if (!id) return;
      if (!mapa[id]) mapa[id] = { insumoId: id, insumo: m.insumo.nombre, trasladado: 0 };
      mapa[id].trasladado += Number(m.cantidad);
    });
    return Object.values(mapa)
      .map((f) => ({ ...f, stockRestante: cantidadDe(f.insumoId, deposito?.id) }))
      .sort((a, b) => b.trasladado - a.trasladado);
  })();

  async function handleCerrarSemana() {
    setCerrando(true);
    setError(null);
    try {
      const detalle = {
        porInsumo: resumenPorInsumo,
        totalTrasladado: resumenPorInsumo.reduce((acc, f) => acc + f.trasladado, 0),
        cantidadMovimientos: movimientos.length,
      };
      const cierre = await cerrarSemanaStock({
        semanaInicio: lunes,
        semanaFin: viernes,
        detalle,
        nombreDuena: perfil?.nombre || user?.email,
      });
      setCierreSemanal(cierre);
      setMensajeSemana("Semana cerrada y congelada correctamente.");
    } catch (e) {
      setError(e.message);
    } finally {
      setCerrando(false);
    }
  }

  const detalleMostrado = cierreSemanal?.detalle || {
    porInsumo: resumenPorInsumo,
    totalTrasladado: resumenPorInsumo.reduce((acc, f) => acc + f.trasladado, 0),
  };

  const grupos = SECTORES_STOCK.map((sector) => ({
    sector,
    items: insumos.filter((i) => i.sector === sector),
  })).filter((g) => g.items.length > 0);

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Stock de Insumos</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setMostrarRodantes(true)}
            className="rounded-md border border-brand-brown/40 px-4 py-2 text-sm font-medium text-brand-brown hover:bg-brand-tan/30"
          >
            Gestionar ubicaciones
          </button>
          <button
            onClick={() => setMostrarTraspaso(true)}
            disabled={!deposito || insumos.length === 0}
            className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
          >
            + Completar rodante
          </button>
        </div>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        El Stock se edita directo (lo que comprás/tenés guardado). Los rodantes se completan con el botón de arriba,
        que resta del Stock automáticamente. Las filas en rojo no tienen nada en ningún lado.
      </p>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      {cargando ? (
        <p className="mt-6 text-sm text-gray-500">Cargando...</p>
      ) : (
        <>
          {grupos.map((g) => {
            const abierto = sectoresAbiertos.has(g.sector);
            const sinStock = g.items.filter((i) => totalDe(i.id) === 0).length;
            return (
              <div key={g.sector} className="mt-4 overflow-hidden rounded-lg border border-gray-200">
                <button
                  type="button"
                  onClick={() => toggleSector(g.sector)}
                  className="flex w-full items-center justify-between bg-brand-tan/20 px-4 py-3 text-left hover:bg-brand-tan/30"
                >
                  <span className="font-heading text-sm font-semibold text-brand-brown">
                    {abierto ? "▾" : "▸"} {g.sector}
                  </span>
                  <span className="text-xs text-gray-500">
                    {g.items.length} insumo{g.items.length === 1 ? "" : "s"}
                    {sinStock > 0 && <span className="ml-2 text-red-600">· {sinStock} sin stock</span>}
                  </span>
                </button>
                {abierto && (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="bg-brand-brown text-white">
                          <th className="px-3 py-2 text-left font-semibold">Insumo</th>
                          {rodantes.map((r) => (
                            <th key={r.id} className="px-3 py-2 text-right font-semibold">
                              {r.nombre}
                            </th>
                          ))}
                          <th className="px-3 py-2 text-right font-semibold">Total</th>
                          <th className="px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.items.map((insumo) => {
                          const total = totalDe(insumo.id);
                          const editando = editandoId === insumo.id;
                          if (editando) {
                            return (
                              <tr key={insumo.id} className="border-t border-gray-100 bg-brand-tan/10">
                                <td colSpan={rodantes.length + 2} className="px-3 py-3">
                                  <div className="flex flex-col gap-2">
                                    <div className="flex flex-wrap gap-2">
                                      <input
                                        value={editNombre}
                                        onChange={(e) => setEditNombre(e.target.value)}
                                        placeholder="Nombre del insumo"
                                        className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                                      />
                                      <select
                                        value={editSector}
                                        onChange={(e) => setEditSector(e.target.value)}
                                        className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                                      >
                                        {SECTORES_STOCK.map((s) => (
                                          <option key={s} value={s}>
                                            {s}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <input
                                      value={editObservaciones}
                                      onChange={(e) => setEditObservaciones(e.target.value)}
                                      placeholder="Observaciones (ej. 2 cajas, una ya abierta)"
                                      className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                                    />
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => guardarEdicion(insumo)}
                                        disabled={guardandoEdicion}
                                        className="rounded-md bg-brand-brown px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
                                      >
                                        {guardandoEdicion ? "Guardando..." : "Guardar"}
                                      </button>
                                      <button
                                        onClick={() => setEditandoId(null)}
                                        className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-white"
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            );
                          }
                          return (
                            <tr key={insumo.id} className={`border-t border-gray-100 ${total === 0 ? "bg-red-50" : ""}`}>
                              <td className="px-3 py-2 font-medium text-gray-900">
                                {insumo.nombre}
                                {insumo.observaciones && (
                                  <p className="mt-0.5 text-xs font-normal text-gray-500">{insumo.observaciones}</p>
                                )}
                              </td>
                              {rodantes.map((r) =>
                                r.es_deposito ? (
                                  <td key={r.id} className="px-3 py-2 text-right">
                                    <CeldaCantidad
                                      valor={cantidadDe(insumo.id, r.id)}
                                      onGuardar={(v) => guardarCantidadDeposito(insumo.id, v)}
                                    />
                                  </td>
                                ) : (
                                  <td key={r.id} className="px-3 py-2 text-right text-gray-600">
                                    {cantidadDe(insumo.id, r.id)}
                                  </td>
                                )
                              )}
                              <td className={`px-3 py-2 text-right font-semibold ${total === 0 ? "text-red-700" : "text-gray-900"}`}>
                                {total}
                              </td>
                              <td className="px-3 py-2 text-right whitespace-nowrap">
                                <button
                                  onClick={() => empezarEdicion(insumo)}
                                  className="mr-2 text-xs text-brand-brown hover:underline"
                                >
                                  Editar
                                </button>
                                <button
                                  onClick={() => borrarInsumo(insumo)}
                                  className="text-xs text-red-600 hover:underline"
                                >
                                  Borrar
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}

          {insumos.length === 0 && (
            <p className="mt-6 text-sm text-gray-500">Todavía no cargaste ningún insumo para controlar.</p>
          )}

          <div className="mt-6 rounded-lg border border-gray-200 p-4">
            <h3 className="mb-2 font-heading text-sm font-semibold text-brand-charcoal">Agregar insumo a controlar</h3>
            <form onSubmit={agregarInsumo} className="flex flex-wrap items-center gap-2">
              <input
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                placeholder="Nombre del insumo (ej. Guantes M)"
                className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
              <select
                value={nuevoSector}
                onChange={(e) => setNuevoSector(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              >
                {SECTORES_STOCK.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={guardandoInsumo}
                className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
              >
                + Agregar
              </button>
            </form>
          </div>

          <div className="mt-8 rounded-lg border border-brand-tan bg-brand-tan/10 p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-sm font-semibold text-brand-brown">
                Resumen semanal ({formatoFechaCorta(lunes)} al {formatoFechaCorta(viernes)})
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSemanaRef((f) => sumarSemanas(f, -1))}
                  className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                >
                  ← Semana anterior
                </button>
                <button
                  onClick={() => setSemanaRef(hoy)}
                  className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                >
                  Esta semana
                </button>
                <button
                  onClick={() => setSemanaRef((f) => sumarSemanas(f, 1))}
                  className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
                >
                  Semana siguiente →
                </button>
              </div>
            </div>

            {cierreSemanal ? (
              <p className="mt-2 text-sm text-brand-green">
                🔒 Semana cerrada por {cierreSemanal.nombre_duena} el{" "}
                {new Date(cierreSemanal.aprobado_en).toLocaleString("es-AR")}. Se muestran los números congelados de
                ese momento.
              </p>
            ) : (
              <p className="mt-2 text-sm text-gray-500">Esta semana todavía no se cerró — números en vivo.</p>
            )}
            {mensajeSemana && <p className="mt-1 text-sm text-emerald-700">{mensajeSemana}</p>}

            <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200 bg-white">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-brand-brown text-white">
                    <th className="px-3 py-2 text-left font-semibold">Insumo</th>
                    <th className="px-3 py-2 text-right font-semibold">Trasladado esta semana</th>
                    <th className="px-3 py-2 text-right font-semibold">Stock {cierreSemanal ? "al cerrar" : "actual"}</th>
                  </tr>
                </thead>
                <tbody>
                  {detalleMostrado.porInsumo.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-4 text-center text-gray-500">
                        No hubo traspasos esta semana.
                      </td>
                    </tr>
                  )}
                  {detalleMostrado.porInsumo.map((f) => (
                    <tr key={f.insumoId} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-medium text-gray-900">{f.insumo}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{f.trasladado}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{f.stockRestante}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!cierreSemanal && movimientos.length > 0 && (
              <div className="mt-3">
                <p className="mb-1 text-xs font-semibold uppercase text-gray-400">Traspasos de la semana</p>
                <ul className="flex flex-col gap-1 text-xs text-gray-600">
                  {movimientos.map((m) => (
                    <li key={m.id} className="flex items-center justify-between rounded-md border border-gray-100 bg-white px-2 py-1">
                      <span>
                        {formatoFechaCorta(m.fecha)} — {m.cantidad} × {m.insumo?.nombre} → {m.rodante?.nombre}
                      </span>
                      <button onClick={() => borrarMovimiento(m)} className="text-red-600 hover:underline">
                        Deshacer
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={handleCerrarSemana}
              disabled={cerrando}
              className="mt-4 rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
            >
              {cerrando ? "Guardando..." : cierreSemanal ? "Actualizar cierre de la semana" : "✅ Cerrar semana"}
            </button>
          </div>
        </>
      )}

      {mostrarRodantes && (
        <GestionarRodantesModal
          rodantes={rodantes}
          onClose={() => setMostrarRodantes(false)}
          onCambiado={async () => {
            const r = await obtenerRodantes();
            setRodantes(r);
          }}
        />
      )}

      {mostrarTraspaso && (
        <RegistrarTraspasoStockModal
          insumos={insumos}
          rodantes={rodantes}
          onClose={() => setMostrarTraspaso(false)}
          onGuardado={async () => {
            await recargar();
            await recargarSemana();
            setMostrarTraspaso(false);
          }}
        />
      )}
    </main>
  );
}

export default function StockPage() {
  return (
    <SoloDuenaYLaboratorio>
      <StockContenido />
    </SoloDuenaYLaboratorio>
  );
}
