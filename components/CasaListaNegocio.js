"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  actualizarCantidadItemCasa,
  agregarItemListaComprasCasa,
  crearItemCasa,
  eliminarItemListaComprasCasa,
  obtenerItemsCasa,
  obtenerListaComprasCasa,
} from "@/lib/data/casa";
import { obtenerCatalogoProductosSuper } from "@/lib/data/catalogoSuper";

function normalizar(texto) {
  return (texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

function formatoCantidad(n) {
  const num = Number(n) || 0;
  return Number.isInteger(num) ? String(num) : num.toLocaleString("es-AR", { maximumFractionDigits: 2 });
}

// Una lista por negocio (Verdulería, Carnicería...): todos los productos de ese rubro del
// catálogo del súper, con lo que hay en stock hoy, para ver de un vistazo qué falta, anotarlo
// para comprar y copiar la lista para pasársela al negocio.
//   grupo: nombre del grupo en el catálogo (ej. "Frutas y verduras")
export default function CasaListaNegocio({ grupo, titulo }) {
  const [catalogo, setCatalogo] = useState([]);
  const [items, setItems] = useState([]);
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [soloFaltan, setSoloFaltan] = useState(false);
  const [aComprar, setAComprar] = useState({}); // nombre normalizado -> cantidad a agregar
  const [stockEditando, setStockEditando] = useState({}); // nombre normalizado -> texto escrito
  const [ocupado, setOcupado] = useState(null);
  const [copiado, setCopiado] = useState(false);

  const recargar = useCallback(async () => {
    const [c, i, l] = await Promise.all([obtenerCatalogoProductosSuper(), obtenerItemsCasa(), obtenerListaComprasCasa()]);
    setCatalogo(c);
    setItems(i);
    setLista(l);
  }, []);

  useEffect(() => {
    let activo = true;
    Promise.all([obtenerCatalogoProductosSuper(), obtenerItemsCasa(), obtenerListaComprasCasa()])
      .then(([c, i, l]) => {
        if (!activo) return;
        setCatalogo(c);
        setItems(i);
        setLista(l);
      })
      .catch((e) => activo && setError(e.message))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, []);

  const productos = useMemo(() => {
    const itemsPorNombre = new Map();
    for (const i of items.filter((x) => x.categoria === "Alimentos")) {
      const k = normalizar(i.nombre);
      if (!itemsPorNombre.has(k)) itemsPorNombre.set(k, []);
      itemsPorNombre.get(k).push(i);
    }
    const listaPorNombre = new Map();
    for (const l of lista) {
      const k = normalizar(l.nombre);
      if (!listaPorNombre.has(k)) listaPorNombre.set(k, []);
      listaPorNombre.get(k).push(l);
    }
    return catalogo
      .filter((p) => p.grupo === grupo)
      .map((p) => {
        const k = normalizar(p.nombre);
        const stock = itemsPorNombre.get(k) || [];
        const enLista = listaPorNombre.get(k) || [];
        return {
          clave: k,
          nombre: p.nombre,
          unidad: p.unidad || stock[0]?.unidad || "",
          stockItems: stock,
          stockTotal: stock.reduce((a, s) => a + Number(s.cantidad), 0),
          enLista,
          listaTotal: enLista.reduce((a, l) => a + Number(l.cantidad), 0),
        };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [catalogo, items, lista, grupo]);

  const texto = normalizar(busqueda);
  const visibles = productos.filter((p) => (!texto || p.clave.includes(texto)) && (!soloFaltan || p.stockTotal <= 0));
  const conStock = productos.filter((p) => p.stockTotal > 0).length;
  const sinStock = productos.length - conStock;
  const enLaLista = productos.filter((p) => p.enLista.length > 0);

  async function guardarStock(p) {
    const escrito = stockEditando[p.clave];
    if (escrito === undefined) return;
    const cantidad = Number(String(escrito).replace(",", "."));
    setStockEditando((s) => {
      const { [p.clave]: _quitar, ...resto } = s;
      return resto;
    });
    if (!Number.isFinite(cantidad) || cantidad < 0 || cantidad === p.stockTotal) return;
    setOcupado(p.clave);
    setError(null);
    try {
      if (p.stockItems.length === 1) await actualizarCantidadItemCasa(p.stockItems[0].id, cantidad);
      else if (p.stockItems.length === 0 && cantidad > 0) {
        await crearItemCasa({ nombre: p.nombre, categoria: "Alimentos", ubicacionId: null, cantidad, unidad: p.unidad });
      }
      await recargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupado(null);
    }
  }

  async function agregarALista(p) {
    const cantidad = Number(String(aComprar[p.clave] ?? 1).replace(",", ".")) || 1;
    setOcupado(p.clave);
    setError(null);
    try {
      await agregarItemListaComprasCasa({ nombre: p.nombre, categoria: "Alimentos", cantidad, unidad: p.unidad });
      setAComprar((s) => {
        const { [p.clave]: _quitar, ...resto } = s;
        return resto;
      });
      await recargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupado(null);
    }
  }

  async function quitarDeLista(p) {
    setOcupado(p.clave);
    setError(null);
    try {
      for (const l of p.enLista) await eliminarItemListaComprasCasa(l.id);
      await recargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupado(null);
    }
  }

  async function copiarLista() {
    const lineas = enLaLista.map((p) => `• ${p.nombre} — ${formatoCantidad(p.listaTotal)}${p.unidad ? ` ${p.unidad}` : ""}`);
    const textoLista = `${titulo}:\n${lineas.join("\n")}`;
    try {
      await navigator.clipboard.writeText(textoLista);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      window.prompt("Copiá la lista:", textoLista);
    }
  }

  if (cargando) return <p className="mt-4 text-sm text-gray-500">Cargando...</p>;

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-md border border-gray-200 px-3 py-1.5 text-gray-700">
          Con stock: <strong>{conStock}</strong>
        </span>
        <span className={`rounded-md border px-3 py-1.5 ${sinStock > 0 ? "border-amber-300 bg-amber-50 text-amber-900" : "border-gray-200 text-gray-700"}`}>
          Sin stock: <strong>{sinStock}</strong>
        </span>
        <span className="rounded-md border border-brand-brown/30 bg-brand-tan/20 px-3 py-1.5 text-brand-brown">
          Para comprar: <strong>{enLaLista.length}</strong>
        </span>
        <button
          onClick={copiarLista}
          disabled={enLaLista.length === 0}
          className="ml-auto rounded-md bg-brand-brown px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
        >
          {copiado ? "✓ Copiada" : `📋 Copiar lista de ${titulo.toLowerCase()}`}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar producto..."
          className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        />
        <label className="flex items-center gap-1.5 text-sm text-gray-700">
          <input type="checkbox" checked={soloFaltan} onChange={(e) => setSoloFaltan(e.target.checked)} />
          Solo lo que no tengo
        </label>
      </div>

      {error && <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-[560px] border-collapse text-sm">
          <thead>
            <tr className="bg-brand-brown text-white">
              <th className="px-3 py-2 text-left font-semibold">Producto</th>
              <th className="px-3 py-2 text-left font-semibold">En stock</th>
              <th className="px-3 py-2 text-left font-semibold">Para comprar</th>
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-center text-gray-500">
                  No hay productos que coincidan.
                </td>
              </tr>
            )}
            {visibles.map((p) => {
              const editable = p.stockItems.length <= 1;
              const valorStock = stockEditando[p.clave] ?? (p.stockTotal > 0 || p.stockItems.length === 1 ? formatoCantidad(p.stockTotal) : "");
              return (
                <tr key={p.clave} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-medium text-gray-900">{p.nombre}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={valorStock}
                        placeholder="0"
                        disabled={!editable || ocupado === p.clave}
                        title={editable ? "Escribí cuánto queda y salí del casillero para guardar" : "Está en varias ubicaciones: editalo en la pestaña Stock"}
                        onChange={(e) => setStockEditando((s) => ({ ...s, [p.clave]: e.target.value }))}
                        onBlur={() => guardarStock(p)}
                        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                        className={`w-16 rounded-md border px-2 py-1 text-right text-sm tabular-nums ${
                          p.stockTotal <= 0 ? "border-amber-300 bg-amber-50" : "border-gray-300"
                        }`}
                      />
                      <span className="text-xs text-gray-500">{p.unidad}</span>
                      {p.stockTotal <= 0 && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">sin stock</span>}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {p.enLista.length > 0 ? (
                      <span className="inline-flex items-center gap-2 rounded-md bg-brand-tan/30 px-2 py-1 text-xs font-medium text-brand-brown">
                        🛒 {formatoCantidad(p.listaTotal)} {p.unidad}
                        <button onClick={() => quitarDeLista(p)} disabled={ocupado === p.clave} aria-label="Quitar de la lista" className="text-gray-500 hover:text-red-600">
                          ✕
                        </button>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={aComprar[p.clave] ?? "1"}
                          onChange={(e) => setAComprar((s) => ({ ...s, [p.clave]: e.target.value }))}
                          className="w-14 rounded-md border border-gray-300 px-2 py-1 text-right text-sm tabular-nums"
                        />
                        <span className="text-xs text-gray-500">{p.unidad}</span>
                        <button
                          onClick={() => agregarALista(p)}
                          disabled={ocupado === p.clave}
                          className="rounded-md border border-brand-brown/40 px-2 py-1 text-xs font-medium text-brand-brown hover:bg-brand-tan/30 disabled:opacity-50"
                        >
                          + Lista
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-gray-400">
        Lo que agregás acá aparece también en la pestaña 🛒 Lista de súper, y cuando lo tildás como comprado suma al stock.
      </p>
    </div>
  );
}
