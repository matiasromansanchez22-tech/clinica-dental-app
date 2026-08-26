"use client";

import { useEffect, useState } from "react";
import { fechaDeHoyISO } from "@/lib/agenda";
import { crearNotaCredito, crearProveedor, obtenerPedidos } from "@/lib/data/pedidosInsumos";

export default function NuevaNotaCreditoModal({ proveedores, onClose, onGuardado }) {
  const [fecha, setFecha] = useState(fechaDeHoyISO());
  const [proveedorId, setProveedorId] = useState(proveedores[0]?.id ?? "");
  const [proveedorNuevo, setProveedorNuevo] = useState("");
  const [pedidoId, setPedidoId] = useState("");
  const [pedidosDelProveedor, setPedidosDelProveedor] = useState([]);
  const [motivo, setMotivo] = useState("Devolución de insumos");
  const [monto, setMonto] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!proveedorId) {
      setPedidosDelProveedor([]);
      return;
    }
    // Trae un rango amplio para poder vincular la nota a un pedido anterior.
    obtenerPedidos("2000-01-01", "2100-01-01").then((pedidos) => {
      setPedidosDelProveedor(pedidos.filter((p) => p.proveedorId === proveedorId));
    });
  }, [proveedorId]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!proveedorId && !proveedorNuevo.trim()) {
      setError("Falta elegir o escribir el proveedor.");
      return;
    }
    if (!monto || Number(monto) <= 0) {
      setError("Falta el monto de la nota de crédito.");
      return;
    }

    setGuardando(true);
    try {
      let idProveedorFinal = proveedorId;
      if (!idProveedorFinal && proveedorNuevo.trim()) {
        const nuevo = await crearProveedor(proveedorNuevo.trim());
        idProveedorFinal = nuevo.id;
      }

      await crearNotaCredito({
        fecha,
        proveedorId: idProveedorFinal,
        pedidoId: pedidoId || null,
        motivo,
        monto: Number(monto),
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
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold text-brand-brown">Nota de crédito (devolución)</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
            Proveedor
            <select
              value={proveedorId}
              onChange={(e) => {
                setProveedorId(e.target.value);
                setPedidoId("");
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

          {proveedorId && pedidosDelProveedor.length > 0 && (
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Vincular a un pedido (opcional)
              <select
                value={pedidoId}
                onChange={(e) => setPedidoId(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              >
                <option value="">(sin vincular)</option>
                {pedidosDelProveedor.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fecha} · ${p.total.toLocaleString("es-AR")}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Motivo
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Monto a favor
            <input
              type="number"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0"
              className="rounded-md border border-gray-300 px-2 py-1.5"
            />
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
              {guardando ? "Guardando..." : "Guardar nota de crédito"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
