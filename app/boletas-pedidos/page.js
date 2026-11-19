"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { fechaDeHoyISO } from "@/lib/agenda";
import {
  MEDIOS_PAGO_BOLETA,
  crearBoleta,
  desmarcarBoletaPagada,
  eliminarBoleta,
  leerBoletaConIA,
  marcarBoletaPagada,
  obtenerBoletas,
  obtenerNombresDeProveedores,
  urlDeBoleta,
} from "@/lib/data/boletasPedidos";

// Boletas de pedidos: quien recibe la mercadería saca una foto de la boleta y la deja cargada (proveedor, fecha, monto y si está pagada).
// Arriba, el resumen del mes en una frase; abajo, una cortina por proveedor con cada boleta y su foto.

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const ROLES = ["Duena", "Secretaria", "Laboratorio", "Contador"];
const pesos = (n) => `$${Math.round(n).toLocaleString("es-AR")}`;
const dm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const hora = (iso) => new Date(iso).toLocaleTimeString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit" });

function rango(mes) {
  const [a, m] = mes.split("-").map(Number);
  return { desde: `${mes}-01`, hasta: `${mes}-${String(new Date(a, m, 0).getDate()).padStart(2, "0")}` };
}
function sumarMes(mes, n) {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(a, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
const nombreMes = (mes) => `${MESES[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`;

function FormularioCarga({ proveedoresSugeridos, onGuardada, onCancelar }) {
  const [archivo, setArchivo] = useState(null);
  const [leyendo, setLeyendo] = useState(false);
  const [avisoIA, setAvisoIA] = useState(null);
  const [f, setF] = useState({ proveedor: "", fecha: fechaDeHoyISO(), monto: "", numero: "", pagada: false, medioPago: "Efectivo", nota: "" });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  async function elegirArchivo(e) {
    const a = e.target.files?.[0] || null;
    setArchivo(a);
    setAvisoIA(null);
    setError(null);
    if (!a) return;
    // Se intenta completar solo leyendo la foto; si no puede, se carga a mano.
    setLeyendo(true);
    try {
      const d = await leerBoletaConIA(a);
      setF((x) => ({ ...x, proveedor: d.proveedor || x.proveedor, fecha: d.fecha || x.fecha, monto: d.monto || x.monto, numero: d.numero || x.numero, medioPago: d.medioPago || x.medioPago }));
      setAvisoIA("✨ Completé lo que pude leer de la foto. Revisalo antes de guardar.");
    } catch (err) {
      setAvisoIA(`No pude leer la foto solo (${err.message}). Cargala a mano.`);
    } finally {
      setLeyendo(false);
    }
  }

  async function guardar(e) {
    e.preventDefault();
    setError(null);
    if (!archivo) return setError("Sacá o elegí la foto (o PDF) de la boleta.");
    if (!f.proveedor.trim()) return setError("Falta el proveedor.");
    if (!f.monto || Number(f.monto) <= 0) return setError("Falta el monto de la boleta.");
    setGuardando(true);
    try {
      await crearBoleta({ archivo, ...f });
      onGuardada();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="rounded-xl border-2 border-brand-green/50 bg-white p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-bold text-brand-brown">➕ Cargar una boleta</h2>
        <button type="button" onClick={onCancelar} className="text-sm text-gray-500 hover:underline">
          Cancelar
        </button>
      </div>
      {error && <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      <label className="mt-3 flex flex-col gap-1 text-sm font-semibold text-gray-700">
        1. Foto o PDF de la boleta
        <input type="file" accept="image/*,application/pdf" capture="environment" onChange={elegirArchivo} className="rounded-md border border-dashed border-brand-tan bg-brand-tan/10 p-2 text-sm font-normal" />
      </label>
      {leyendo && <p className="mt-1 text-xs text-gray-500">Leyendo la boleta…</p>}
      {avisoIA && <p className="mt-1 text-xs text-gray-600">{avisoIA}</p>}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          2. Proveedor
          <input list="proveedores-sugeridos" value={f.proveedor} onChange={(e) => set("proveedor", e.target.value)} placeholder="Ej: Dental Rosario" className="rounded-md border border-gray-300 px-2 py-1.5" />
          <datalist id="proveedores-sugeridos">
            {proveedoresSugeridos.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Fecha de la boleta
          <input type="date" value={f.fecha} max={fechaDeHoyISO()} onChange={(e) => set("fecha", e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          3. Monto total ($)
          <input type="number" inputMode="numeric" min="0" value={f.monto} onChange={(e) => set("monto", e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-700">
          Número de boleta (opcional)
          <input value={f.numero} onChange={(e) => set("numero", e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5" />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
        <span className="font-semibold text-gray-700">4. ¿Está pagada?</span>
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={!f.pagada} onChange={() => set("pagada", false)} /> Falta pagar
        </label>
        <label className="flex items-center gap-1.5">
          <input type="radio" checked={f.pagada} onChange={() => set("pagada", true)} /> Ya está pagada
        </label>
        {f.pagada && (
          <select value={f.medioPago} onChange={(e) => set("medioPago", e.target.value)} className="rounded-md border border-gray-300 px-2 py-1">
            {MEDIOS_PAGO_BOLETA.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        )}
      </div>

      <label className="mt-3 flex flex-col gap-1 text-sm text-gray-700">
        Nota (opcional): por ejemplo, si faltó algún producto
        <textarea value={f.nota} onChange={(e) => set("nota", e.target.value)} rows={2} className="rounded-md border border-gray-300 px-2 py-1.5" />
      </label>

      <div className="mt-4 flex justify-end">
        <button type="submit" disabled={guardando || leyendo} className="rounded-md bg-brand-green px-5 py-2 text-sm font-semibold text-white hover:bg-brand-green/90 disabled:opacity-50">
          {guardando ? "Guardando..." : "Guardar boleta"}
        </button>
      </div>
    </form>
  );
}

function FilaBoleta({ b, esGestor, miId, onCambio, setError }) {
  const [pagando, setPagando] = useState(false);
  const [medio, setMedio] = useState("Efectivo");
  const [fechaPago, setFechaPago] = useState(fechaDeHoyISO());
  const [ocupado, setOcupado] = useState(false);
  const [ahora] = useState(() => Date.now());
  const dentroDeLaVentana = b.cargadaPorId === miId && ahora - new Date(b.creadaEn).getTime() < 30 * 60 * 1000;
  const puedeBorrar = esGestor || dentroDeLaVentana;

  async function ver() {
    try {
      window.open(await urlDeBoleta(b), "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e.message);
    }
  }
  async function accion(fn) {
    setOcupado(true);
    setError(null);
    try {
      await fn();
      setPagando(false);
      await onCambio();
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <tr className="align-top">
      <td className="whitespace-nowrap px-4 py-2 text-gray-600">{dm(b.fecha)}</td>
      <td className="px-2 py-2">
        <button onClick={ver} className="font-semibold text-brand-brown underline">
          🧾 Ver boleta
        </button>
        {b.numero && <p className="text-[11px] text-gray-500">N° {b.numero}</p>}
        {b.nota && <p className="mt-0.5 text-xs text-gray-600">{b.nota}</p>}
      </td>
      <td className="px-2 py-2 text-right font-semibold tabular-nums">{pesos(b.monto)}</td>
      <td className="px-2 py-2">
        {b.pagada ? (
          <div>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">Pagada</span>
            <p className="mt-0.5 text-[11px] text-gray-500">
              {b.fechaPago ? dm(b.fechaPago) : ""} {b.medioPago ? `· ${b.medioPago}` : ""}
            </p>
          </div>
        ) : (
          <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">Falta pagar</span>
        )}
      </td>
      <td className="px-2 py-2 text-xs text-gray-500">
        {b.cargadaPor}
        <br />
        {hora(b.creadaEn)}
      </td>
      <td className="px-4 py-2 text-right text-xs">
        {esGestor && !b.pagada && !pagando && (
          <button onClick={() => setPagando(true)} className="block w-full font-semibold text-brand-green hover:underline">
            ✅ Marcar pagada
          </button>
        )}
        {esGestor && b.pagada && (
          <button disabled={ocupado} onClick={() => accion(() => desmarcarBoletaPagada(b.id))} className="block w-full text-gray-500 hover:underline">
            Deshacer pago
          </button>
        )}
        {pagando && (
          <div className="flex flex-col items-end gap-1">
            <input type="date" value={fechaPago} max={fechaDeHoyISO()} onChange={(e) => setFechaPago(e.target.value)} className="rounded border border-gray-300 px-1 py-0.5" />
            <select value={medio} onChange={(e) => setMedio(e.target.value)} className="rounded border border-gray-300 px-1 py-0.5">
              {MEDIOS_PAGO_BOLETA.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
            <button disabled={ocupado} onClick={() => accion(() => marcarBoletaPagada(b.id, { fechaPago, medioPago: medio }))} className="rounded bg-brand-green px-2 py-1 font-semibold text-white">
              Confirmar pago
            </button>
          </div>
        )}
        {puedeBorrar && (
          <button
            disabled={ocupado}
            onClick={() => window.confirm(`¿Borrar la boleta de ${b.proveedor} por ${pesos(b.monto)}?`) && accion(() => eliminarBoleta(b))}
            className="mt-1 block w-full text-red-600 hover:underline"
          >
            Borrar
          </button>
        )}
      </td>
    </tr>
  );
}

function Contenido() {
  const { perfil, user } = useAuth();
  const esGestor = perfil?.rol === "Duena" || perfil?.rol === "Contador";
  const mesActual = fechaDeHoyISO().slice(0, 7);
  const [mes, setMes] = useState(mesActual);
  const [boletas, setBoletas] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [abiertos, setAbiertos] = useState(() => new Set());
  const [soloImpagas, setSoloImpagas] = useState(false);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [sugeridos, setSugeridos] = useState([]);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let vigente = true;
    const { desde, hasta } = rango(mes);
    obtenerBoletas(desde, hasta)
      .then((b) => vigente && setBoletas(b))
      .catch((e) => vigente && setError(e.message))
      .finally(() => vigente && setCargando(false));
    return () => {
      vigente = false;
    };
  }, [mes, version]);
  useEffect(() => {
    obtenerNombresDeProveedores().then(setSugeridos).catch(() => {});
  }, [version]);

  const cambiarMes = (m) => {
    setBoletas(null);
    setCargando(true);
    setMes(m);
  };

  const grupos = useMemo(() => {
    if (!boletas) return [];
    const mapa = new Map();
    for (const b of boletas) {
      const clave = b.proveedor.trim().toLowerCase();
      if (!mapa.has(clave)) mapa.set(clave, { clave, nombre: b.proveedor.trim(), boletas: [], total: 0, impagas: 0, montoImpago: 0 });
      const g = mapa.get(clave);
      g.boletas.push(b);
      g.total += b.monto;
      if (!b.pagada) {
        g.impagas += 1;
        g.montoImpago += b.monto;
      }
    }
    return [...mapa.values()].sort((a, b) => b.montoImpago - a.montoImpago || a.nombre.localeCompare(b.nombre, "es"));
  }, [boletas]);

  const t = useMemo(() => {
    if (!boletas) return null;
    return {
      cantidad: boletas.length,
      total: boletas.reduce((a, b) => a + b.monto, 0),
      impagas: boletas.filter((b) => !b.pagada).length,
      montoImpago: boletas.filter((b) => !b.pagada).reduce((a, b) => a + b.monto, 0),
      proveedores: grupos.length,
    };
  }, [boletas, grupos]);
  const cerrado = mes < mesActual;
  const frase = t
    ? `${cerrado ? "Cerró" : "Va"} ${nombreMes(mes)} con ${t.cantidad} boleta${t.cantidad === 1 ? "" : "s"} de ${t.proveedores} proveedor${t.proveedores === 1 ? "" : "es"} por ${pesos(t.total)}. ${
        t.impagas === 0 ? "Todas están pagadas." : `${t.impagas} ${t.impagas === 1 ? "falta pagar" : "faltan pagar"} por ${pesos(t.montoImpago)}.`
      }`
    : "";

  const alternar = (id) =>
    setAbiertos((a) => {
      const n = new Set(a);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-brown/70">Pedidos</p>
      <h1 className="font-heading text-3xl font-extrabold text-brand-brown">📦 Boletas de pedidos</h1>
      <p className="mt-1 text-sm text-gray-600">Cuando llega un pedido, sacale una foto a la boleta y cargala acá. Queda guardada con quién la cargó y a qué hora.</p>

      {mostrarForm ? (
        <div className="mt-4">
          <FormularioCarga
            proveedoresSugeridos={sugeridos}
            onCancelar={() => setMostrarForm(false)}
            onGuardada={() => {
              setMostrarForm(false);
              setMes(mesActual);
              setVersion((v) => v + 1);
            }}
          />
        </div>
      ) : (
        <button onClick={() => setMostrarForm(true)} className="mt-4 w-full rounded-xl bg-brand-green px-4 py-3 text-base font-bold text-white shadow hover:bg-brand-green/90 sm:w-auto">
          ➕ Cargar una boleta
        </button>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <button onClick={() => cambiarMes(sumarMes(mes, -1))} className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm hover:bg-gray-50" aria-label="Mes anterior">
          ←
        </button>
        <input type="month" value={mes} max={mesActual} onChange={(e) => e.target.value && cambiarMes(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        <button disabled={mes >= mesActual} onClick={() => cambiarMes(sumarMes(mes, 1))} className="rounded-md border border-gray-300 px-2.5 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-40" aria-label="Mes siguiente">
          →
        </button>
        <span className="text-sm font-semibold capitalize text-gray-700">{nombreMes(mes)}</span>
        {grupos.length > 0 && (
          <div className="ml-auto flex flex-wrap gap-2 text-sm">
            <label className="flex items-center gap-1.5 rounded-md border border-gray-300 px-2.5 py-1.5 text-gray-700">
              <input type="checkbox" checked={soloImpagas} onChange={(e) => setSoloImpagas(e.target.checked)} /> Solo las que faltan pagar
            </label>
            <button onClick={() => setAbiertos(new Set(grupos.map((g) => g.clave)))} className="rounded-md border border-brand-brown/40 px-3 py-1.5 font-medium text-brand-brown hover:bg-brand-tan/30">
              Abrir todos
            </button>
            <button onClick={() => setAbiertos(new Set())} className="rounded-md border border-brand-brown/40 px-3 py-1.5 font-medium text-brand-brown hover:bg-brand-tan/30">
              Cerrar todos
            </button>
          </div>
        )}
      </div>

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
      {cargando && !boletas && !error && <p className="mt-4 text-sm text-gray-500">Cargando…</p>}
      {boletas && boletas.length === 0 && <p className="mt-4 rounded-md border border-brand-tan bg-white px-4 py-3 text-sm text-gray-700">Todavía no hay boletas cargadas en {nombreMes(mes)}.</p>}

      {boletas && boletas.length > 0 && (
        <>
          <div className="mt-4 rounded-xl border border-brand-green/40 bg-emerald-50/60 px-4 py-3">
            <p className="text-[15px] leading-relaxed text-gray-900">{frase}</p>
            <div className="mt-3 grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="font-heading text-2xl font-extrabold text-brand-charcoal">{t.cantidad}</p>
                <p className="text-[11px] uppercase tracking-wide text-gray-500">boletas</p>
              </div>
              <div>
                <p className="font-heading text-2xl font-extrabold text-brand-charcoal">{pesos(t.total)}</p>
                <p className="text-[11px] uppercase tracking-wide text-gray-500">total del mes</p>
              </div>
              <div>
                <p className={`font-heading text-2xl font-extrabold ${t.impagas ? "text-rose-700" : "text-brand-green"}`}>{pesos(t.montoImpago)}</p>
                <p className="text-[11px] uppercase tracking-wide text-gray-500">falta pagar</p>
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {grupos
              .filter((g) => !soloImpagas || g.impagas > 0)
              .map((g) => {
                const filas = soloImpagas ? g.boletas.filter((b) => !b.pagada) : g.boletas;
                const abierto = abiertos.has(g.clave);
                return (
                  <section key={g.clave} className="overflow-hidden rounded-xl border border-brand-tan/70 bg-white">
                    <button onClick={() => alternar(g.clave)} className="flex w-full flex-wrap items-center justify-between gap-3 px-4 py-3 text-left hover:bg-brand-cream/60" aria-expanded={abierto}>
                      <div>
                        <p className="text-base font-bold text-gray-900">{g.nombre}</p>
                        <p className="text-sm text-gray-600">
                          <strong>{g.boletas.length}</strong> boleta{g.boletas.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="flex items-center gap-5 text-right">
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-gray-500">Total</p>
                          <p className="font-heading text-lg font-extrabold text-brand-charcoal">{pesos(g.total)}</p>
                        </div>
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-gray-500">Falta pagar</p>
                          <p className={`font-heading text-xl font-extrabold ${g.impagas ? "text-rose-700" : "text-brand-green"}`}>{pesos(g.montoImpago)}</p>
                        </div>
                        <span className="text-gray-400">{abierto ? "▲" : "▼"}</span>
                      </div>
                    </button>
                    {abierto && (
                      <div className="overflow-x-auto border-t border-gray-100">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-brand-tan/40 text-left text-xs uppercase tracking-wide text-brand-brown">
                              <th className="px-4 py-2">Fecha</th>
                              <th className="px-2 py-2">Boleta</th>
                              <th className="px-2 py-2 text-right">Monto</th>
                              <th className="px-2 py-2">Estado</th>
                              <th className="px-2 py-2">Cargó</th>
                              <th className="px-4 py-2"></th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {filas.map((b) => (
                              <FilaBoleta key={b.id} b={b} esGestor={esGestor} miId={user?.id} setError={setError} onCambio={async () => setVersion((v) => v + 1)} />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                );
              })}
          </div>
        </>
      )}
    </main>
  );
}

export default function BoletasPedidosPage() {
  const { perfil, cargando } = useAuth();
  if (cargando) return null;
  if (!ROLES.includes(perfil?.rol)) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">Acceso restringido — esta sección no está disponible para este usuario.</div>
      </main>
    );
  }
  return <Contenido />;
}
