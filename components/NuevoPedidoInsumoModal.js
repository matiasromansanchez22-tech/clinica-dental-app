"use client";

import { useState } from "react";
import { fechaDeHoyISO } from "@/lib/agenda";
import { crearPedido, crearProveedor, SECTORES_INSUMO } from "@/lib/data/pedidosInsumos";

const MEDIOS_PAGO = ["Efectivo", "Transferencia", "Débito", "Crédito", "Mercado Pago", "QR"];

function itemVacio() {
  return { insumo: "", cantidad: 1, precioUnitario: "", sector: SECTORES_INSUMO[0] };
}

export default function NuevoPedidoInsumoModal({ proveedores, onClose, onGuardado }) {
  const [fecha, setFecha] = useState(fechaDeHoyISO());
  const [proveedorId, setProveedorId] = useState(proveedores[0]?.id ?? "");
  const [proveedorNuevo, setProveedorNuevo] = useState("");
  const [medioPago, setMedioPago] = useState("Transferencia");
  const [estado, setEstado] = useState("Recibido");
  const [items, setItems] = useState([itemVacio()]);
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  function actualizarItem(i, cambios) {
    setItems((fs) => fs.map((f, idx) => (idx === i ? { ...f, ...cambios } : f)));
  }

  function agregarItem() {
    setItems((fs) => [...fs, itemVacio()]);
  }

  function quitarItem(i) {
    setItems((fs) => fs.filter((_, idx) => idx !== i));
  }

  const total = items.reduce((acc, i) => acc + (Number(i.cantidad) || 0) * (Number(i.precioUnitario) || 0), 0);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const itemsValidos = items.filter((i) => i.insumo.trim() && Number(i.cantidad) > 0);
    if (itemsValidos.length === 0) {
      setError("Cargá al menos un insumo con cantidad.");
      return;
    }
    if (!proveedorId && !proveedorNuevo.trim()) {
      setError("Falta elegir o escribir el proveedor.");
      return;
    }

    setGuardando(true);
    try {
      let idProveedorFinal = proveedorId;
      if (!idProveedorFinal && proveedorNuevo.trim()) {
        const nuevo = await crearProveedor(proveedorNuevo.trim());
        idProveedorFinal = nuevo.id;
      }

      await crearPedido({
        fecha,
        proveedorId: idProveedorFinal,
        items: itemsValidos.map((i) => ({
          insumo: i.insumo.trim(),
          cantidad: Number(i.cantidad),
          precioUnitario: Number(i.precioUnitario) || 0,
          sector: i.sector || SECTORES_INSUMO[0],
        })),
        medioPago,
        estado,
        observaciones,
      });
      onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold text-brand-brown">Nuevo pedido de insumos</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Fecha
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Medio de pago
              <select
                value={medioPago}
                onChange={(e) => setMedioPago(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              >
                {MEDIOS_PAGO.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Proveedor
            <select
              value={proveedorId}
              onChange={(e) => {
                setProveedorId(e.target.value);
                if (e.target.value) setProveedorNuevo("");
              }}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            >
              <option value="">(proveedor nuevo)</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>
          {!proveedorId && (
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Nombre del proveedor nuevo
              <input
                value={proveedorNuevo}
                onChange={(e) => setProveedorNuevo(e.target.value)}
                placeholder="Ej. Dental Insumos SRL"
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
            </label>
          )}

          <div>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase text-gray-400">Insumos</p>
              <button type="button" onClick={agregarItem} className="text-xs text-brand-brown hover:underline">
                + Agregar ítem
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {items.map((it, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2 rounded-md border border-gray-100 p-2">
                  <input
                    value={it.insumo}
                    onChange={(e) => actualizarItem(i, { insumo: e.target.value })}
                    placeholder="Insumo"
                    className="min-w-[10rem] flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  />
                  <select
                    value={it.sector || SECTORES_INSUMO[0]}
                    onChange={(e) => actualizarItem(i, { sector: e.target.value })}
                    className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  >
                    {SECTORES_INSUMO.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    value={it.cantidad}
                    onChange={(e) => actualizarItem(i, { cantidad: e.target.value })}
                    placeholder="Cant."
                    className="w-16 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  />
                  <input
                    type="number"
                    value={it.precioUnitario}
                    onChange={(e) => actualizarItem(i, { precioUnitario: e.target.value })}
                    placeholder="Precio unit."
                    className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  />
                  <span className="w-20 text-right text-xs text-gray-500">
                    ${((Number(it.cantidad) || 0) * (Number(it.precioUnitario) || 0)).toLocaleString("es-AR")}
                  </span>
                  <button type="button" onClick={() => quitarItem(i)} className="text-gray-400 hover:text-red-600">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md bg-brand-tan/20 px-3 py-2 text-right text-sm font-semibold text-brand-brown">
            Total: ${total.toLocaleString("es-AR")}
          </div>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Estado
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            >
              <option value="Pendiente">Pendiente</option>
              <option value="Recibido">Recibido</option>
              <option value="Cancelado">Cancelado</option>
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Observaciones
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              rows={2}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            />
          </label>

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
            >
              {guardando ? "Guardando..." : "Guardar pedido"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
