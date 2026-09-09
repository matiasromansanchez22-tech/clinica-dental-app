"use client";

import { useEffect, useState } from "react";
import { fechaDeHoyISO } from "@/lib/agenda";
import { crearPedidoConStock, crearProveedor, leerFacturaPedidoConIA, SECTORES_INSUMO } from "@/lib/data/pedidosInsumos";
import { obtenerInsumosStock } from "@/lib/data/stock";
import LeerComprobanteIA from "@/components/LeerComprobanteIA";

const MEDIOS_PAGO = ["Efectivo", "Transferencia", "Débito", "Crédito", "Mercado Pago", "QR"];

function itemVacio() {
  return { insumo: "", cantidad: 1, precioUnitario: "", sector: SECTORES_INSUMO[0], insumoId: "", crearNuevo: false };
}

function normalizar(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

// Busca, entre los insumos/proveedores ya cargados, el que más se parezca
// al nombre que leyó la IA — así se puede sugerir un vínculo automático,
// pero la persona siempre puede cambiarlo antes de guardar.
function mejorCoincidencia(nombre, opciones, campoNombre) {
  const n = normalizar(nombre);
  if (!n) return null;
  let mejor = null;
  let mejorScore = 0;
  for (const opcion of opciones) {
    const ni = normalizar(opcion[campoNombre]);
    if (!ni) continue;
    let score = 0;
    if (ni === n) score = 1;
    else if (ni.includes(n) || n.includes(ni)) score = 0.7;
    else {
      const palabrasN = n.split(/\s+/);
      const palabrasI = ni.split(/\s+/);
      const comunes = palabrasN.filter((p) => p.length > 2 && palabrasI.includes(p));
      score = comunes.length / Math.max(palabrasN.length, palabrasI.length);
    }
    if (score > mejorScore) {
      mejorScore = score;
      mejor = opcion;
    }
  }
  return mejorScore >= 0.5 ? mejor : null;
}

export default function NuevoPedidoInsumoModal({ proveedores, onClose, onGuardado }) {
  const [fecha, setFecha] = useState(fechaDeHoyISO());
  const [proveedorId, setProveedorId] = useState(proveedores[0]?.id ?? "");
  const [proveedorNuevo, setProveedorNuevo] = useState("");
  const [medioPago, setMedioPago] = useState("Transferencia");
  const [estado, setEstado] = useState("Recibido");
  const [items, setItems] = useState([itemVacio()]);
  const [observaciones, setObservaciones] = useState("");
  const [insumosStock, setInsumosStock] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    obtenerInsumosStock()
      .then(setInsumosStock)
      .catch(() => {});
  }, []);

  function actualizarItem(i, cambios) {
    setItems((fs) => fs.map((f, idx) => (idx === i ? { ...f, ...cambios } : f)));
  }

  function agregarItem() {
    setItems((fs) => [...fs, itemVacio()]);
  }

  function quitarItem(i) {
    setItems((fs) => fs.filter((_, idx) => idx !== i));
  }

  function aplicarSugerenciaFactura(datos) {
    if (datos.fecha) setFecha(datos.fecha);
    if (datos.medioPago) setMedioPago(datos.medioPago);
    if (datos.observaciones) setObservaciones(datos.observaciones);

    if (datos.proveedor) {
      const match = mejorCoincidencia(datos.proveedor, proveedores, "nombre");
      if (match) {
        setProveedorId(match.id);
        setProveedorNuevo("");
      } else {
        setProveedorId("");
        setProveedorNuevo(datos.proveedor);
      }
    }

    if (datos.items?.length) {
      setItems(
        datos.items.map((it) => {
          const match = mejorCoincidencia(it.nombre, insumosStock, "nombre");
          return {
            insumo: it.nombre,
            cantidad: it.cantidad || 1,
            precioUnitario: it.precioUnitario || "",
            sector: match?.sector || SECTORES_INSUMO[0],
            insumoId: match?.id || "",
            crearNuevo: !match,
          };
        })
      );
    }
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

      await crearPedidoConStock({
        fecha,
        proveedorId: idProveedorFinal,
        items: itemsValidos.map((i) => ({
          insumo: i.insumo.trim(),
          cantidad: Number(i.cantidad),
          precioUnitario: Number(i.precioUnitario) || 0,
          sector: i.sector || SECTORES_INSUMO[0],
          ...(i.insumoId ? { insumoId: i.insumoId } : {}),
          ...(i.crearNuevo ? { crearInsumoNuevo: true } : {}),
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
          <LeerComprobanteIA
            titulo="📷 Factura del proveedor (opcional)"
            leerFn={leerFacturaPedidoConIA}
            onLeido={aplicarSugerenciaFactura}
          />

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
                <div key={i} className="flex flex-col gap-1.5 rounded-md border border-gray-100 p-2">
                  <div className="flex flex-wrap items-center gap-2">
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
                  <div className="flex flex-wrap items-center gap-2 pl-1">
                    <span className="text-xs text-gray-400">Sumar a Stock:</span>
                    <select
                      value={it.crearNuevo ? "__nuevo__" : it.insumoId || ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "__nuevo__") actualizarItem(i, { insumoId: "", crearNuevo: true });
                        else if (v === "") actualizarItem(i, { insumoId: "", crearNuevo: false });
                        else actualizarItem(i, { insumoId: v, crearNuevo: false });
                      }}
                      className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                    >
                      <option value="">No actualizar stock</option>
                      <option value="__nuevo__">+ Crear insumo nuevo en Stock</option>
                      {insumosStock.map((ins) => (
                        <option key={ins.id} value={ins.id}>
                          {ins.nombre} ({ins.sector})
                        </option>
                      ))}
                    </select>
                    {it.crearNuevo && (
                      <span className="text-xs text-amber-700">
                        se va a crear como insumo nuevo en Stock, sector "{it.sector || SECTORES_INSUMO[0]}"
                      </span>
                    )}
                  </div>
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
            {items.some((i) => i.insumoId || i.crearNuevo) && (
              <span className="text-xs text-gray-400">
                {estado === "Recibido"
                  ? "Como está \"Recibido\", el stock se suma al guardar."
                  : "El stock solo se suma cuando el estado es \"Recibido\"."}
              </span>
            )}
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
