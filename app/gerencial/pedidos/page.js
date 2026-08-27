"use client";

import { Fragment, useEffect, useState } from "react";
import NuevaNotaCreditoModal from "@/components/NuevaNotaCreditoModal";
import NuevoPedidoInsumoModal from "@/components/NuevoPedidoInsumoModal";
import SoloDuena from "@/components/SoloDuena";
import { fechaDeHoyISO } from "@/lib/agenda";
import {
  actualizarEstadoNotaCredito,
  eliminarNotaCredito,
  eliminarPedido,
  obtenerNotasCredito,
  obtenerPedidos,
  obtenerProveedores,
  obtenerSaldoAFavorPorProveedor,
  SECTORES_INSUMO,
} from "@/lib/data/pedidosInsumos";

const COLOR_SECTOR = {
  "Odontología General": "border-sky-200 bg-sky-50",
  "Tratamiento de Conducto": "border-amber-200 bg-amber-50",
  "Ortodoncia": "border-violet-200 bg-violet-50",
  "Otros": "border-gray-200 bg-gray-50",
};

function agruparPorSector(items) {
  const grupos = {};
  for (const it of items) {
    const sector = it.sector || "Otros";
    if (!grupos[sector]) grupos[sector] = [];
    grupos[sector].push(it);
  }
  return SECTORES_INSUMO.filter((s) => grupos[s]?.length).map((sector) => ({
    sector,
    items: grupos[sector],
    subtotal: grupos[sector].reduce((acc, it) => acc + it.cantidad * it.precioUnitario, 0),
  }));
}

function GrillaItemsPorSector({ items }) {
  const grupos = agruparPorSector(items);
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      {grupos.map((g) => (
        <div key={g.sector} className={`rounded-lg border p-3 ${COLOR_SECTOR[g.sector] || COLOR_SECTOR.Otros}`}>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="font-heading text-xs font-bold uppercase text-brand-charcoal">{g.sector}</h4>
            <span className="text-xs font-semibold text-gray-600">${g.subtotal.toLocaleString("es-AR")}</span>
          </div>
          <ul className="flex flex-col gap-1 text-xs text-gray-700">
            {g.items.map((it, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span>
                  {it.insumo} <span className="text-gray-400">× {it.cantidad}</span>
                </span>
                <span className="whitespace-nowrap text-gray-500">
                  ${(it.cantidad * it.precioUnitario).toLocaleString("es-AR")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function primerYUltimoDiaDelMes(fechaISO) {
  const [anio, mes] = fechaISO.split("-").map(Number);
  const primero = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const ultimoDia = new Date(anio, mes, 0).getDate();
  const ultimo = `${anio}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
  return { primero, ultimo };
}

function PedidosContenido() {
  const hoy = fechaDeHoyISO();
  const [fechaInicio, setFechaInicio] = useState(() => primerYUltimoDiaDelMes(hoy).primero);
  const [fechaFin, setFechaFin] = useState(() => primerYUltimoDiaDelMes(hoy).ultimo);
  const [proveedores, setProveedores] = useState([]);
  const [pedidos, setPedidos] = useState([]);
  const [notasCredito, setNotasCredito] = useState([]);
  const [saldos, setSaldos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [mostrarNuevoPedido, setMostrarNuevoPedido] = useState(false);
  const [mostrarNuevaNota, setMostrarNuevaNota] = useState(false);
  const [expandido, setExpandido] = useState(null);

  async function recargar() {
    setCargando(true);
    try {
      const [prov, ped, notas, saldosProv] = await Promise.all([
        obtenerProveedores(),
        obtenerPedidos(fechaInicio, fechaFin),
        obtenerNotasCredito(fechaInicio, fechaFin),
        obtenerSaldoAFavorPorProveedor(),
      ]);
      setProveedores(prov);
      setPedidos(ped);
      setNotasCredito(notas);
      setSaldos(saldosProv);
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

  const totalPedidos = pedidos.reduce((acc, p) => acc + p.total, 0);
  const totalNotasCredito = notasCredito.reduce((acc, n) => acc + n.monto, 0);
  const totalSaldoAFavor = saldos.reduce((acc, s) => acc + s.saldo, 0);

  async function borrarPedido(pedido) {
    if (!window.confirm(`¿Borrar el pedido a "${pedido.proveedor}" de $${pedido.total.toLocaleString("es-AR")}?`)) return;
    try {
      await eliminarPedido(pedido.id);
      await recargar();
    } catch (e) {
      setError(e.message);
    }
  }

  async function borrarNota(nota) {
    if (!window.confirm(`¿Borrar la nota de crédito de "${nota.proveedor}" de $${nota.monto.toLocaleString("es-AR")}?`)) return;
    try {
      await eliminarNotaCredito(nota.id);
      await recargar();
    } catch (e) {
      setError(e.message);
    }
  }

  async function cambiarEstadoNota(nota, estado) {
    try {
      await actualizarEstadoNotaCredito(nota.id, estado);
      await recargar();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Pedidos de Insumos</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setMostrarNuevaNota(true)}
            className="rounded-md border border-brand-brown/40 px-4 py-2 text-sm font-medium text-brand-brown hover:bg-brand-tan/30"
          >
            + Nota de crédito
          </button>
          <button
            onClick={() => setMostrarNuevoPedido(true)}
            className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark"
          >
            + Nuevo pedido
          </button>
        </div>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Compras de insumos a proveedores, con el total calculado solo, y las devoluciones como notas de crédito para
        saber cuánto queda a favor de cada uno.
      </p>

      {saldos.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-semibold uppercase text-gray-400">Saldo a favor por proveedor</p>
          <div className="flex flex-wrap gap-3">
            {saldos.map((s) => (
              <div key={s.proveedorId} className="rounded-md border border-brand-mint/40 bg-brand-mint/15 px-3 py-2 text-sm">
                <span className="text-brand-green">{s.proveedor}: </span>
                <span className="font-semibold text-brand-green">${s.saldo.toLocaleString("es-AR")}</span>
              </div>
            ))}
            <div className="rounded-md bg-brand-brown px-3 py-2 text-sm text-white">
              Total a favor: <span className="font-semibold">${totalSaldoAFavor.toLocaleString("es-AR")}</span>
            </div>
          </div>
        </div>
      )}

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
        <div className="ml-auto flex gap-2">
          <div className="rounded-md border border-gray-200 px-3 py-2 text-sm">
            <span className="text-gray-500">Comprado: </span>
            <span className="font-semibold text-gray-900">${totalPedidos.toLocaleString("es-AR")}</span>
          </div>
          <div className="rounded-md border border-gray-200 px-3 py-2 text-sm">
            <span className="text-gray-500">Notas de crédito: </span>
            <span className="font-semibold text-gray-900">${totalNotasCredito.toLocaleString("es-AR")}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      <h2 className="mt-6 mb-2 font-heading text-sm font-semibold text-brand-brown">Pedidos</h2>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-brand-brown text-white">
              <th className="px-3 py-2 text-left font-semibold">Fecha</th>
              <th className="px-3 py-2 text-left font-semibold">Proveedor</th>
              <th className="px-3 py-2 text-right font-semibold">Total</th>
              <th className="px-3 py-2 text-left font-semibold">Medio</th>
              <th className="px-3 py-2 text-left font-semibold">Estado</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-gray-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!cargando && pedidos.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-gray-500">
                  No hay pedidos registrados en este período.
                </td>
              </tr>
            )}
            {pedidos.map((p) => (
              <Fragment key={p.id}>
                <tr
                  onClick={() => setExpandido((e) => (e === p.id ? null : p.id))}
                  className="cursor-pointer border-t border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-3 py-2 text-gray-600">
                    {expandido === p.id ? "▾" : "▸"} {p.fecha}
                  </td>
                  <td className="px-3 py-2 font-medium text-gray-900">{p.proveedor}</td>
                  <td className="px-3 py-2 text-right text-gray-600">${p.total.toLocaleString("es-AR")}</td>
                  <td className="px-3 py-2 text-gray-600">{p.medioPago || "—"}</td>
                  <td className="px-3 py-2 text-gray-600">{p.estado}</td>
                  <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => borrarPedido(p)} className="text-xs text-red-600 hover:underline">
                      Borrar
                    </button>
                  </td>
                </tr>
                {expandido === p.id && (
                  <tr className="bg-gray-50">
                    <td colSpan={6} className="px-3 py-3">
                      <GrillaItemsPorSector items={p.items} />
                      {p.observaciones && <p className="mt-2 text-xs text-gray-400">{p.observaciones}</p>}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mt-6 mb-2 font-heading text-sm font-semibold text-brand-brown">Notas de crédito (devoluciones)</h2>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-brand-brown text-white">
              <th className="px-3 py-2 text-left font-semibold">Fecha</th>
              <th className="px-3 py-2 text-left font-semibold">Proveedor</th>
              <th className="px-3 py-2 text-left font-semibold">Motivo</th>
              <th className="px-3 py-2 text-right font-semibold">Monto</th>
              <th className="px-3 py-2 text-left font-semibold">Estado</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {!cargando && notasCredito.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-gray-500">
                  No hay notas de crédito registradas en este período.
                </td>
              </tr>
            )}
            {notasCredito.map((n) => (
              <tr key={n.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-600">{n.fecha}</td>
                <td className="px-3 py-2 font-medium text-gray-900">{n.proveedor}</td>
                <td className="px-3 py-2 text-gray-600">{n.motivo || "—"}</td>
                <td className="px-3 py-2 text-right text-gray-600">${n.monto.toLocaleString("es-AR")}</td>
                <td className="px-3 py-2">
                  <select
                    value={n.estado}
                    onChange={(e) => cambiarEstadoNota(n, e.target.value)}
                    className={`rounded-full border-0 px-2 py-0.5 text-xs font-medium ${
                      n.estado === "Disponible"
                        ? "bg-brand-mint/30 text-brand-green"
                        : n.estado === "Usada"
                          ? "bg-gray-100 text-gray-500"
                          : "bg-red-100 text-red-700"
                    }`}
                  >
                    <option value="Disponible">Disponible</option>
                    <option value="Usada">Usada</option>
                    <option value="Vencida">Vencida</option>
                  </select>
                </td>
                <td className="px-3 py-2 text-right">
                  <button onClick={() => borrarNota(n)} className="text-xs text-red-600 hover:underline">
                    Borrar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {mostrarNuevoPedido && (
        <NuevoPedidoInsumoModal
          proveedores={proveedores}
          onClose={() => setMostrarNuevoPedido(false)}
          onGuardado={async () => {
            await recargar();
            setMostrarNuevoPedido(false);
          }}
        />
      )}

      {mostrarNuevaNota && (
        <NuevaNotaCreditoModal
          proveedores={proveedores}
          onClose={() => setMostrarNuevaNota(false)}
          onGuardado={async () => {
            await recargar();
            setMostrarNuevaNota(false);
          }}
        />
      )}
    </main>
  );
}

export default function PedidosPage() {
  return (
    <SoloDuena>
      <PedidosContenido />
    </SoloDuena>
  );
}
