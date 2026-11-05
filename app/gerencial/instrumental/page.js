"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  actualizarItemInstrumental,
  AREAS_INSTRUMENTAL,
  CATEGORIAS_POR_AREA,
  crearItemInstrumental,
  crearUbicacionInstrumental,
  guardarConteoInstrumental,
  obtenerCantidadesInstrumental,
  obtenerConteosInstrumental,
  obtenerItemsInstrumental,
  obtenerNovedadesInstrumental,
  obtenerUbicacionesInstrumental,
  quitarItemInstrumental,
  registrarNovedadInstrumental,
  TIPOS_NOVEDAD,
} from "@/lib/data/instrumental";

const ROLES_PERMITIDOS = ["Duena", "Laboratorio"];

function fechaCorta(iso) {
  if (!iso) return "";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

const estiloInput = "rounded-md border border-gray-300 px-2 py-1.5 text-sm";
const estiloBoton = "rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50";

function NovedadModal({ item, ubicaciones, cantidades, onClose, onGuardar }) {
  const [tipo, setTipo] = useState("Roto");
  const conUnidades = ubicaciones.filter((u) => {
    const c = cantidades.find((x) => x.item_id === item.id && x.ubicacion_id === u.id);
    return c && (c.buenos > 0 || c.a_reparar > 0);
  });
  const [ubicacionId, setUbicacionId] = useState((conUnidades[0] || ubicaciones[0])?.id || "");
  const [destinoId, setDestinoId] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [nota, setNota] = useState("");
  const [comprar, setComprar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  async function enviar(e) {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      await onGuardar({
        item,
        ubicacion: ubicaciones.find((u) => u.id === ubicacionId),
        destino: ubicaciones.find((u) => u.id === destinoId),
        tipo,
        cantidad,
        nota,
        comprarReposicion: comprar,
      });
    } catch (err) {
      setError(err.message);
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form onSubmit={enviar} className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-base font-semibold text-gray-900">Novedad — {item.nombre}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700">
            ✕
          </button>
        </div>
        <div className="flex flex-col gap-3 text-sm text-gray-700">
          <label className="flex flex-col gap-1">
            Qué pasó
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={estiloInput}>
              {Object.keys(TIPOS_NOVEDAD).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <span className="text-xs text-gray-500">{TIPOS_NOVEDAD[tipo].ayuda}</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              {tipo === "Movido" ? "Desde" : "Ubicación"}
              <select value={ubicacionId} onChange={(e) => setUbicacionId(e.target.value)} className={estiloInput}>
                {ubicaciones.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              Cantidad
              <input type="number" min={1} value={cantidad} onChange={(e) => setCantidad(e.target.value)} className={estiloInput} />
            </label>
          </div>
          {tipo === "Movido" && (
            <label className="flex flex-col gap-1">
              Hacia
              <select value={destinoId} onChange={(e) => setDestinoId(e.target.value)} className={estiloInput}>
                <option value="">Elegí la ubicación…</option>
                {ubicaciones
                  .filter((u) => u.id !== ubicacionId)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1">
            Nota (opcional)
            <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Qué pasó, quién lo usaba…" className={estiloInput} />
          </label>
          {(tipo === "Roto" || tipo === "Perdido") && (
            <label className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
              <input type="checkbox" className="mt-0.5" checked={comprar} onChange={(e) => setComprar(e.target.checked)} />
              <span>Anotar la reposición en la lista de insumos para comprar.</span>
            </label>
          )}
          {TIPOS_NOVEDAD[tipo].avisa && <p className="text-xs text-gray-500">Esto le avisa a las dueñas.</p>}
          {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-800">{error}</p>}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button type="submit" disabled={guardando} className={estiloBoton}>
            {guardando ? "Guardando..." : "Registrar"}
          </button>
        </div>
      </form>
    </div>
  );
}

function InventarioContenido() {
  const { user, perfil } = useAuth();
  const quien = perfil?.nombre || user?.email;
  const [ubicaciones, setUbicaciones] = useState([]);
  const [items, setItems] = useState([]);
  const [cantidades, setCantidades] = useState([]);
  const [novedades, setNovedades] = useState([]);
  const [conteos, setConteos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [pestana, setPestana] = useState("inventario");
  const [busqueda, setBusqueda] = useState("");
  // Odontología General y Ortodoncia se llevan por separado (solapas): cada una con su instrumental, categorías y conteos.
  const [area, setArea] = useState(() => {
    try {
      const guardada = localStorage.getItem("instrumental_area");
      return AREAS_INSTRUMENTAL.includes(guardada) ? guardada : AREAS_INSTRUMENTAL[0];
    } catch {
      return AREAS_INSTRUMENTAL[0];
    }
  });
  function cambiarArea(nueva) {
    setArea(nueva);
    try {
      localStorage.setItem("instrumental_area", nueva);
    } catch {
      // sin almacenamiento: no pasa nada
    }
  }

  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [nuevo, setNuevo] = useState({ nombre: "", categoria: "", ubicacionId: "", cantidad: 1, observaciones: "" });
  const [nuevaUbicacion, setNuevaUbicacion] = useState("");
  const [modalNovedad, setModalNovedad] = useState(null);
  const [editando, setEditando] = useState(null);

  const [conteoUbicacionId, setConteoUbicacionId] = useState("");
  const [contados, setContados] = useState({});
  const [ajustar, setAjustar] = useState(true);
  const [guardandoConteo, setGuardandoConteo] = useState(false);

  async function recargar() {
    try {
      const [u, i, c, n, k] = await Promise.all([
        obtenerUbicacionesInstrumental(),
        obtenerItemsInstrumental(),
        obtenerCantidadesInstrumental(),
        obtenerNovedadesInstrumental(),
        obtenerConteosInstrumental(),
      ]);
      setUbicaciones(u);
      setItems(i);
      setCantidades(c);
      setNovedades(n);
      setConteos(k);
      setNuevo((x) => ({ ...x, ubicacionId: x.ubicacionId || u[0]?.id || "" }));
      setConteoUbicacionId((x) => x || u[0]?.id || "");
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    recargar();
  }, []);

  const cant = (itemId, ubicacionId) => cantidades.find((c) => c.item_id === itemId && c.ubicacion_id === ubicacionId);
  const totalBuenos = (itemId) => cantidades.filter((c) => c.item_id === itemId).reduce((a, c) => a + c.buenos, 0);
  const totalReparar = (itemId) => cantidades.filter((c) => c.item_id === itemId).reduce((a, c) => a + c.a_reparar, 0);

  const itemsArea = useMemo(() => items.filter((i) => (i.area || AREAS_INSTRUMENTAL[0]) === area), [items, area]);
  const categoriasArea = CATEGORIAS_POR_AREA[area];
  const categoriaNueva = categoriasArea.includes(nuevo.categoria) ? nuevo.categoria : categoriasArea[0];
  const conteosArea = conteos.filter((k) => (k.area || AREAS_INSTRUMENTAL[0]) === area);
  const novedadesArea = novedades.filter((n) => (n.item?.area || AREAS_INSTRUMENTAL[0]) === area);
  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return itemsArea.filter((i) => !q || i.nombre.toLowerCase().includes(q));
  }, [itemsArea, busqueda]);

  // Las categorías del área, más cualquier otra que ya tenga algún instrumental cargado (así nada queda escondido).
  const categoriasMostradas = [...categoriasArea, ...new Set(filtrados.map((i) => i.categoria || "Otros").filter((c) => !categoriasArea.includes(c)))];
  const grupos = categoriasMostradas
    .map((categoria) => ({ categoria, lista: filtrados.filter((i) => (i.categoria || "Otros") === categoria) }))
    .filter((g) => g.lista.length > 0);

  const resumen = {
    tipos: itemsArea.length,
    unidades: itemsArea.reduce((a, i) => a + totalBuenos(i.id) + totalReparar(i.id), 0),
    reparar: itemsArea.reduce((a, i) => a + totalReparar(i.id), 0),
  };

  async function accion(fn, textoOk) {
    setError(null);
    setMensaje(null);
    try {
      await fn();
      await recargar();
      if (textoOk) setMensaje(textoOk);
    } catch (e) {
      setError(e.message);
    }
  }

  async function agregarItem(e) {
    e.preventDefault();
    if (!nuevo.nombre.trim()) return;
    await accion(async () => {
      await crearItemInstrumental({ ...nuevo, categoria: categoriaNueva, area, quien });
      setNuevo((x) => ({ ...x, nombre: "", cantidad: 1, observaciones: "" }));
    }, "Instrumental agregado al inventario.");
  }

  async function agregarUbicacion(e) {
    e.preventDefault();
    if (!nuevaUbicacion.trim()) return;
    await accion(async () => {
      await crearUbicacionInstrumental(nuevaUbicacion);
      setNuevaUbicacion("");
    }, "Ubicación agregada.");
  }

  async function guardarNovedad(datos) {
    await registrarNovedadInstrumental({ ...datos, quien });
    setModalNovedad(null);
    await recargar();
    setMensaje("Novedad registrada.");
  }

  async function guardarEdicion() {
    if (!editando?.nombre.trim()) return;
    await accion(async () => {
      await actualizarItemInstrumental(editando.id, editando);
      setEditando(null);
    });
  }

  async function quitar(item) {
    if (!window.confirm(`¿Quitar "${item.nombre}" del inventario?`)) return;
    await accion(() => quitarItemInstrumental(item.id), "Instrumental quitado.");
  }

  // ---- conteo ----
  const ubicacionConteo = ubicaciones.find((u) => u.id === conteoUbicacionId);
  const lineasConteo = itemsArea
    .map((i) => ({ itemId: i.id, nombre: i.nombre, esperado: cant(i.id, conteoUbicacionId)?.buenos || 0 }))
    .filter((l) => l.esperado > 0);
  const contadoDe = (l) => (contados[`${conteoUbicacionId}:${l.itemId}`] ?? l.esperado);
  const diferencias = lineasConteo.filter((l) => Number(contadoDe(l)) !== l.esperado);

  async function guardarConteo() {
    if (!ubicacionConteo) return;
    const lineas = lineasConteo.map((l) => ({ ...l, contado: Math.max(0, Math.floor(Number(contadoDe(l)) || 0)) }));
    const faltan = lineas.filter((l) => l.contado < l.esperado).length;
    if (
      !window.confirm(
        `¿Guardar el conteo de ${ubicacionConteo.nombre}? ${faltan > 0 ? `Hay ${faltan} instrumental(es) con faltantes y se les avisa a las dueñas. ` : "No hay diferencias. "}${ajustar ? "El inventario va a quedar igual a lo contado." : "El inventario no se modifica."}`
      )
    )
      return;
    setGuardandoConteo(true);
    await accion(async () => {
      await guardarConteoInstrumental({ ubicacion: ubicacionConteo, lineas, ajustar, quien, area });
      setContados({});
    }, "Conteo guardado.");
    setGuardandoConteo(false);
  }

  const pestanas = [
    ["inventario", "Inventario"],
    ["conteo", "Conteo"],
    ["novedades", "Novedades"],
  ];

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">🦷 Inventario de instrumental</h1>
      <p className="mt-1 text-sm text-gray-500">
        Cuánto instrumental hay, dónde está y en qué estado. Las cantidades solo cambian con una novedad (roto, perdido, a reparar...)
        o con un conteo, y queda registrado quién lo hizo.
      </p>

      <div className="mt-4 flex gap-2 border-b border-gray-200">
        {AREAS_INSTRUMENTAL.map((a) => (
          <button
            key={a}
            onClick={() => cambiarArea(a)}
            className={`px-4 py-2 text-sm font-medium ${area === a ? "border-b-2 border-brand-brown text-brand-brown" : "text-gray-500 hover:text-gray-800"}`}
          >
            {a === "Ortodoncia" ? "🦷 " : ""}
            {a}
          </button>
        ))}
      </div>

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
      {mensaje && <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{mensaje}</div>}

      <div className="mt-4 flex gap-2 border-b border-gray-200">
        {pestanas.map(([clave, texto]) => (
          <button
            key={clave}
            onClick={() => setPestana(clave)}
            className={`px-4 py-2 text-sm font-medium ${pestana === clave ? "border-b-2 border-brand-brown text-brand-brown" : "text-gray-500 hover:text-gray-800"}`}
          >
            {texto}
          </button>
        ))}
      </div>

      {cargando ? (
        <p className="mt-6 text-sm text-gray-500">Cargando...</p>
      ) : pestana === "inventario" ? (
        <>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-md border border-gray-200 px-3 py-2">
              <p className="text-xs text-gray-500">Tipos de instrumental</p>
              <p className="text-lg font-semibold text-gray-900">{resumen.tipos}</p>
            </div>
            <div className="rounded-md border border-gray-200 px-3 py-2">
              <p className="text-xs text-gray-500">Unidades en total</p>
              <p className="text-lg font-semibold text-gray-900">{resumen.unidades}</p>
            </div>
            <div className={`rounded-md border px-3 py-2 ${resumen.reparar > 0 ? "border-amber-300 bg-amber-50" : "border-gray-200"}`}>
              <p className="text-xs text-gray-500">Para reparar</p>
              <p className="text-lg font-semibold text-gray-900">{resumen.reparar}</p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar instrumental…" className={`${estiloInput} w-64`} />
            <button onClick={() => setMostrarNuevo((v) => !v)} className={estiloBoton}>
              {mostrarNuevo ? "Cerrar" : "+ Instrumental nuevo"}
            </button>
            <form onSubmit={agregarUbicacion} className="ml-auto flex items-center gap-2">
              <input value={nuevaUbicacion} onChange={(e) => setNuevaUbicacion(e.target.value)} placeholder="Nueva ubicación (ej. Rodante 1)" className={`${estiloInput} w-56`} />
              <button type="submit" disabled={!nuevaUbicacion.trim()} className="rounded-md border border-brand-brown/40 px-3 py-1.5 text-sm text-brand-brown hover:bg-brand-tan/30 disabled:opacity-50">
                + Ubicación
              </button>
            </form>
          </div>

          {mostrarNuevo && (
            <form onSubmit={agregarItem} className="mt-3 grid gap-2 rounded-lg border border-brand-tan bg-brand-tan/10 p-4 sm:grid-cols-6">
              <input
                value={nuevo.nombre}
                onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })}
                placeholder="Nombre (ej. Pinza Kocher recta)"
                className={`${estiloInput} sm:col-span-2`}
              />
              <select value={categoriaNueva} onChange={(e) => setNuevo({ ...nuevo, categoria: e.target.value })} className={estiloInput}>
                {categoriasArea.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select value={nuevo.ubicacionId} onChange={(e) => setNuevo({ ...nuevo, ubicacionId: e.target.value })} className={estiloInput}>
                {ubicaciones.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
              <input type="number" min={0} value={nuevo.cantidad} onChange={(e) => setNuevo({ ...nuevo, cantidad: e.target.value })} title="Cantidad" className={`${estiloInput} text-right`} />
              <button type="submit" disabled={!nuevo.nombre.trim()} className={estiloBoton}>
                Agregar
              </button>
              <input
                value={nuevo.observaciones}
                onChange={(e) => setNuevo({ ...nuevo, observaciones: e.target.value })}
                placeholder="Observaciones (opcional)"
                className={`${estiloInput} sm:col-span-6`}
              />
            </form>
          )}

          {items.length === 0 && <p className="mt-6 text-sm text-gray-500">Todavía no cargaste instrumental. Empezá con “+ Instrumental nuevo”.</p>}

          {grupos.map((g) => (
            <div key={g.categoria} className="mt-4 overflow-hidden rounded-lg border border-gray-200">
              <div className="bg-brand-tan/20 px-4 py-2 font-heading text-sm font-semibold text-brand-brown">
                {g.categoria} <span className="font-normal text-gray-500">· {g.lista.length}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-brand-brown text-white">
                      <th className="px-3 py-2 text-left font-semibold">Instrumental</th>
                      {ubicaciones.map((u) => (
                        <th key={u.id} className="px-3 py-2 text-right font-semibold">
                          {u.nombre}
                        </th>
                      ))}
                      <th className="px-3 py-2 text-right font-semibold">Total</th>
                      <th className="px-3 py-2 text-right font-semibold">Para reparar</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.lista.map((item) => {
                      const buenos = totalBuenos(item.id);
                      const reparar = totalReparar(item.id);
                      if (editando?.id === item.id) {
                        return (
                          <tr key={item.id} className="border-t border-gray-100 bg-brand-tan/10">
                            <td colSpan={ubicaciones.length + 4} className="px-3 py-3">
                              <div className="flex flex-wrap gap-2">
                                <input value={editando.nombre} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} className={`${estiloInput} flex-1`} />
                                <select value={editando.area || area} onChange={(e) => setEditando({ ...editando, area: e.target.value, categoria: CATEGORIAS_POR_AREA[e.target.value][0] })} className={estiloInput}>
                                  {AREAS_INSTRUMENTAL.map((a) => (
                                    <option key={a} value={a}>
                                      {a}
                                    </option>
                                  ))}
                                </select>
                                <select value={editando.categoria} onChange={(e) => setEditando({ ...editando, categoria: e.target.value })} className={estiloInput}>
                                  {[...new Set([...CATEGORIAS_POR_AREA[editando.area || area], editando.categoria])].map((c) => (
                                    <option key={c} value={c}>
                                      {c}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  value={editando.observaciones || ""}
                                  onChange={(e) => setEditando({ ...editando, observaciones: e.target.value })}
                                  placeholder="Observaciones"
                                  className={`${estiloInput} flex-1`}
                                />
                                <button onClick={guardarEdicion} className="rounded-md bg-brand-brown px-3 py-1.5 text-xs font-medium text-white">
                                  Guardar
                                </button>
                                <button onClick={() => setEditando(null)} className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-700">
                                  Cancelar
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }
                      return (
                        <tr key={item.id} className="border-t border-gray-100">
                          <td className="px-3 py-2 font-medium text-gray-900">
                            {item.nombre}
                            {item.observaciones && <p className="mt-0.5 text-xs font-normal text-gray-500">{item.observaciones}</p>}
                          </td>
                          {ubicaciones.map((u) => {
                            const c = cant(item.id, u.id);
                            return (
                              <td key={u.id} className="px-3 py-2 text-right text-gray-700">
                                {c?.buenos || 0}
                                {c?.a_reparar > 0 && <span className="ml-1 text-xs text-amber-700">+{c.a_reparar}🔧</span>}
                              </td>
                            );
                          })}
                          <td className="px-3 py-2 text-right font-semibold text-gray-900">{buenos}</td>
                          <td className={`px-3 py-2 text-right ${reparar > 0 ? "font-semibold text-amber-700" : "text-gray-400"}`}>{reparar}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-right">
                            <button onClick={() => setModalNovedad(item)} className="mr-2 text-xs font-medium text-brand-brown hover:underline">
                              Novedad
                            </button>
                            <button onClick={() => setEditando({ id: item.id, nombre: item.nombre, categoria: item.categoria, observaciones: item.observaciones, area: item.area })} className="mr-2 text-xs text-gray-600 hover:underline">
                              Editar
                            </button>
                            <button onClick={() => quitar(item)} className="text-xs text-red-600 hover:underline">
                              Quitar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      ) : pestana === "conteo" ? (
        <>
          <div className="mt-4 rounded-lg border border-gray-200 p-4">
            <h2 className="font-heading text-sm font-semibold text-brand-brown">Hacer un conteo</h2>
            <p className="mt-1 text-xs text-gray-500">
              Elegí la ubicación, contá lo que hay de verdad y anotá la cantidad. Si algo no coincide, queda registrado y se les avisa a las dueñas.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select value={conteoUbicacionId} onChange={(e) => setConteoUbicacionId(e.target.value)} className={estiloInput}>
                {ubicaciones.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre}
                  </option>
                ))}
              </select>
              <span className="text-sm text-gray-500">{lineasConteo.length} instrumental(es) anotados acá</span>
            </div>

            {lineasConteo.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500">No hay instrumental anotado en esta ubicación.</p>
            ) : (
              <>
                <table className="mt-3 w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-brand-brown text-white">
                      <th className="px-3 py-2 text-left font-semibold">Instrumental</th>
                      <th className="px-3 py-2 text-right font-semibold">Anotados</th>
                      <th className="px-3 py-2 text-right font-semibold">Contados</th>
                      <th className="px-3 py-2 text-right font-semibold">Diferencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineasConteo.map((l) => {
                      const dif = (Number(contadoDe(l)) || 0) - l.esperado;
                      return (
                        <tr key={l.itemId} className={`border-t border-gray-100 ${dif < 0 ? "bg-red-50" : dif > 0 ? "bg-amber-50" : ""}`}>
                          <td className="px-3 py-2 font-medium text-gray-900">{l.nombre}</td>
                          <td className="px-3 py-2 text-right text-gray-600">{l.esperado}</td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min={0}
                              value={contadoDe(l)}
                              onChange={(e) => setContados((c) => ({ ...c, [`${conteoUbicacionId}:${l.itemId}`]: e.target.value }))}
                              className="w-20 rounded-md border border-gray-300 px-2 py-1 text-right text-sm"
                            />
                          </td>
                          <td className={`px-3 py-2 text-right font-semibold ${dif < 0 ? "text-red-700" : dif > 0 ? "text-amber-700" : "text-gray-400"}`}>
                            {dif === 0 ? "—" : dif > 0 ? `+${dif}` : dif}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <label className="mt-3 flex items-start gap-2 text-sm text-gray-700">
                  <input type="checkbox" className="mt-0.5" checked={ajustar} onChange={(e) => setAjustar(e.target.checked)} />
                  <span>Dejar el inventario igual a lo contado (los faltantes y sobrantes quedan registrados en Novedades).</span>
                </label>
                <div className="mt-3 flex items-center gap-3">
                  <button onClick={guardarConteo} disabled={guardandoConteo} className={estiloBoton}>
                    {guardandoConteo ? "Guardando..." : "Guardar conteo"}
                  </button>
                  {diferencias.length > 0 && <span className="text-sm text-red-700">{diferencias.length} con diferencia</span>}
                </div>
              </>
            )}
          </div>

          <h2 className="mt-6 font-heading text-sm font-semibold text-brand-brown">Conteos anteriores</h2>
          {conteosArea.length === 0 ? (
            <p className="mt-2 text-sm text-gray-500">Todavía no se hizo ningún conteo.</p>
          ) : (
            <ul className="mt-2 divide-y divide-gray-100 rounded-md border border-gray-200">
              {conteosArea.map((k) => {
                const faltan = (k.detalle || []).filter((l) => l.contado < l.esperado);
                return (
                  <li key={k.id} className="px-3 py-2 text-sm">
                    <span className="font-medium text-gray-900">{k.ubicacion_nombre}</span>{" "}
                    <span className="text-gray-500">· {fechaCorta(k.fecha)} · {k.realizado_por_nombre || "—"}</span>
                    <span className={`ml-2 ${k.faltantes > 0 ? "font-semibold text-red-700" : "text-emerald-700"}`}>
                      {k.faltantes > 0 ? `faltaron ${k.faltantes}` : "sin faltantes"}
                    </span>
                    {k.sobrantes > 0 && <span className="ml-2 text-amber-700">sobraron {k.sobrantes}</span>}
                    {faltan.length > 0 && (
                      <p className="text-xs text-gray-500">{faltan.map((l) => `${l.nombre} (faltan ${l.esperado - l.contado})`).join(", ")}</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-brand-brown text-white">
                <th className="px-3 py-2 text-left font-semibold">Fecha</th>
                <th className="px-3 py-2 text-left font-semibold">Instrumental</th>
                <th className="px-3 py-2 text-left font-semibold">Qué pasó</th>
                <th className="px-3 py-2 text-right font-semibold">Cant.</th>
                <th className="px-3 py-2 text-left font-semibold">Dónde</th>
                <th className="px-3 py-2 text-left font-semibold">Quién</th>
                <th className="px-3 py-2 text-left font-semibold">Nota</th>
              </tr>
            </thead>
            <tbody>
              {novedadesArea.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-gray-500">
                    Todavía no hay novedades.
                  </td>
                </tr>
              )}
              {novedadesArea.map((n) => (
                <tr key={n.id} className="border-t border-gray-100">
                  <td className="whitespace-nowrap px-3 py-2 text-gray-600">{fechaCorta(n.fecha)}</td>
                  <td className="px-3 py-2 font-medium text-gray-900">{n.item?.nombre || "—"}</td>
                  <td className={`px-3 py-2 ${["Roto", "Perdido", "Faltante en conteo"].includes(n.tipo) ? "text-red-700" : n.tipo === "A reparar" ? "text-amber-700" : "text-gray-700"}`}>{n.tipo}</td>
                  <td className="px-3 py-2 text-right">{n.cantidad}</td>
                  <td className="px-3 py-2 text-gray-600">
                    {n.ubicacion?.nombre || "—"}
                    {n.destino?.nombre ? ` → ${n.destino.nombre}` : ""}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{n.registrado_por_nombre || "—"}</td>
                  <td className="px-3 py-2 text-xs text-gray-500">{n.nota}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalNovedad && (
        <NovedadModal item={modalNovedad} ubicaciones={ubicaciones} cantidades={cantidades} onClose={() => setModalNovedad(null)} onGuardar={guardarNovedad} />
      )}
    </main>
  );
}

export default function InventarioInstrumentalPage() {
  const { perfil, cargando } = useAuth();
  if (cargando) return null;
  if (!ROLES_PERMITIDOS.includes(perfil?.rol)) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Acceso restringido — esta sección no está disponible para este usuario.
        </div>
      </main>
    );
  }
  return <InventarioContenido />;
}
