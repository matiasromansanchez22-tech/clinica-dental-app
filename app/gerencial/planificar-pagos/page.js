"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import SoloDuena from "@/components/SoloDuena";
import { fechaDeHoyISO } from "@/lib/agenda";
import { esMesDePrueba } from "@/lib/mesesDePrueba";
import { obtenerBalanceMensual } from "@/lib/data/balance";
import { obtenerCierreMes, repartirBalance } from "@/lib/data/cierresMes";
import { obtenerResumenPendienteDeLiquidar } from "@/lib/data/cobrosLiquidados";
import { obtenerSaldosPersonales } from "@/lib/data/finanzasPersonales";
import { calcularCuentasDelMes, nombreDeMes } from "@/lib/cuentasDelMes";
import { supabase } from "@/lib/supabaseClient";
import { MEDIOS_PAGO_GASTO, obtenerCategoriasGasto } from "@/lib/data/gastos";
import {
  actualizarPagoPlanificado,
  crearPagoPlanificado,
  eliminarPagoPlanificado,
  obtenerPagosPlanificados,
  registrarPagosPlanificados,
  revisarDuplicados,
  traerGastosFijosDelMes,
} from "@/lib/data/pagosPlanificados";

const NOMBRES_MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const pesos = (n) => `${n < 0 ? "−" : ""}$${Math.abs(Math.round(Number(n) || 0)).toLocaleString("es-AR")}`;
const cuentaDe = (medio) => (medio === "Efectivo" ? "Efectivo" : "Banco");
const estiloInput = "rounded-md border border-gray-300 px-2 py-1.5 text-sm";

function Tarjeta({ titulo, valor, detalle, tono }) {
  const colores =
    tono === "malo" ? "border-red-300 bg-red-50" : tono === "bueno" ? "border-emerald-300 bg-emerald-50" : tono === "fuerte" ? "border-brand-brown bg-brand-brown text-white" : "border-brand-tan/70 bg-white";
  return (
    <div className={`rounded-xl border px-4 py-3 ${colores}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${tono === "fuerte" ? "text-brand-tan" : "text-brand-brown/70"}`}>{titulo}</p>
      <p className={`font-heading text-2xl font-extrabold leading-tight ${tono === "fuerte" ? "text-white" : "text-brand-charcoal"}`}>{valor}</p>
      {detalle && <div className={`mt-1 text-xs ${tono === "fuerte" ? "text-brand-tan" : "text-gray-600"}`}>{detalle}</div>}
    </div>
  );
}

function PlanificarContenido() {
  const hoy = fechaDeHoyISO();
  const [items, setItems] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [saldo, setSaldo] = useState({ Efectivo: 0, Banco: 0 });
  const [pendientes, setPendientes] = useState([]);
  const [incluidos, setIncluidos] = useState({});
  const [cierre, setCierre] = useState(null); // { mes, anio, reparto } del mes anterior si todavía no se cerró
  const [cuentas, setCuentas] = useState(null); // sueldos y gastos fijos del mes
  const [mesHoras, setMesHoras] = useState("anterior");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [registrando, setRegistrando] = useState(false);
  // Los pagos que ya se hicieron (tildados con «Pagué»): solo esos se registran al apretar el botón.
  const [tildados, setTildados] = useState(() => new Set());
  const [form, setForm] = useState({ concepto: "", categoria: "", monto: "", medioPago: "Transferencia", desdeReserva: true, recordar: false, fecha: "", notas: "" });

  async function cargarCuentas(mes = mesHoras) {
    try {
      setCuentas(await calcularCuentasDelMes(supabase, hoy, { mesHoras: mes }));
    } catch {
      setCuentas(null);
    }
  }

  async function recargar() {
    setError(null);
    cargarCuentas();
    try {
      const [lista, cats, saldos] = await Promise.all([obtenerPagosPlanificados(), obtenerCategoriasGasto(), obtenerSaldosPersonales("Consultorio")]);
      setItems(lista);
      setCategorias(cats);
      setSaldo(saldos);
      setForm((f) => ({ ...f, categoria: f.categoria || cats.find((c) => c.nombre === "Otro")?.nombre || cats[0]?.nombre || "" }));
      // El mes anterior, si todavía no se cerró: lo que entraría a la reserva al cerrarlo.
      const anio = Number(hoy.slice(0, 4));
      const mes = Number(hoy.slice(5, 7));
      const anioPrev = mes === 1 ? anio - 1 : anio;
      const mesPrev = mes === 1 ? 12 : mes - 1;
      if (!esMesDePrueba(anioPrev, mesPrev) && !(await obtenerCierreMes(anioPrev, mesPrev))) {
        const ultimo = new Date(anioPrev, mesPrev, 0).getDate();
        const bal = await obtenerBalanceMensual(`${anioPrev}-${String(mesPrev).padStart(2, "0")}-01`, `${anioPrev}-${String(mesPrev).padStart(2, "0")}-${ultimo}`);
        setCierre({ mes: mesPrev, anio: anioPrev, reparto: repartirBalance(bal) });
      } else {
        setCierre(null);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
    // Honorarios por liquidar: se calcula aparte porque tarda más
    obtenerResumenPendienteDeLiquidar()
      .then((r) => {
        setPendientes(r);
        setIncluidos((actual) => Object.fromEntries(r.map((p) => [p.profesionalId, actual[p.profesionalId] ?? true])));
      })
      .catch(() => setPendientes([]));
  }

  useEffect(() => {
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totales = useMemo(() => {
    const deReserva = items.filter((i) => i.desdeReserva);
    const porCuenta = { Banco: 0, Efectivo: 0 };
    for (const i of deReserva) porCuenta[cuentaDe(i.medioPago)] += i.monto;
    const totalReserva = porCuenta.Banco + porCuenta.Efectivo;
    const delMes = items.filter((i) => !i.desdeReserva).reduce((a, i) => a + i.monto, 0);
    const honorarios = pendientes.filter((p) => incluidos[p.profesionalId]).reduce((a, p) => a + p.falta, 0);
    const disponible = saldo.Banco + saldo.Efectivo;
    return { porCuenta, totalReserva, delMes, honorarios, disponible, queda: disponible - totalReserva - honorarios, total: totalReserva + delMes };
  }, [items, pendientes, incluidos, saldo]);

  async function agregar(e) {
    e.preventDefault();
    if (!form.concepto.trim() || !(Number(form.monto) > 0)) return;
    setError(null);
    setMensaje(null);
    try {
      const nuevo = await crearPagoPlanificado(form);
      setItems((l) => [...l, nuevo]);
      setForm((f) => ({ ...f, concepto: "", monto: "", notas: "", recordar: false }));
    } catch (err) {
      setError(err.message);
    }
  }

  async function cambiar(id, cambios) {
    setError(null);
    try {
      await actualizarPagoPlanificado(id, cambios);
      setItems((l) => l.map((i) => (i.id === id ? { ...i, ...cambios, monto: cambios.monto !== undefined ? Number(cambios.monto) : i.monto } : i)));
    } catch (err) {
      setError(err.message);
    }
  }

  async function quitar(id) {
    setError(null);
    try {
      await eliminarPagoPlanificado(id);
      setItems((l) => l.filter((i) => i.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  // Suma a la lista uno de los renglones de "Cuentas del mes" (un sueldo o un gasto fijo) con su monto.
  async function agregarCuenta(c) {
    if (items.some((i) => i.concepto.trim().toLowerCase() === c.concepto.trim().toLowerCase())) return null;
    const nuevo = await crearPagoPlanificado({ concepto: c.concepto, categoria: categorias.some((k) => k.nombre === c.categoria) ? c.categoria : "Otro", monto: c.monto, medioPago: "Transferencia", desdeReserva: true });
    setItems((l) => [...l, nuevo]);
    return nuevo;
  }

  async function agregarUnaCuenta(c) {
    setError(null);
    setMensaje(null);
    try {
      await agregarCuenta(c);
    } catch (err) {
      setError(err.message);
    }
  }

  async function agregarTodoLoQueFalta() {
    setError(null);
    setMensaje(null);
    try {
      const pendientes = [...cuentas.sueldos, ...cuentas.fijos].filter((c) => !c.pagado);
      let n = 0;
      for (const c of pendientes) if (await agregarCuenta(c)) n += 1;
      setMensaje(n ? `Se sumaron ${n} pago(s) a la lista: revisá los montos y registrá.` : "Todo lo que falta ya está en la lista.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function traerFijos() {
    setError(null);
    setMensaje(null);
    try {
      const { agregados, sinMonto } = await traerGastosFijosDelMes(items, categorias);
      setItems((l) => [...l, ...agregados]);
      setMensaje(
        `${agregados.length ? `Se sumaron ${agregados.length} gasto(s) fijo(s) que todavía no se pagaron este mes.` : "No hay gastos fijos pendientes de este mes."}${
          sinMonto.length ? ` Sin monto sugerido (cargalos a mano): ${sinMonto.join(", ")}.` : ""
        }`
      );
    } catch (err) {
      setError(err.message);
    }
  }

  const aRegistrar = items.filter((i) => tildados.has(i.id));
  const sel = (() => {
    const porCuenta = { Banco: 0, Efectivo: 0 };
    for (const i of aRegistrar.filter((x) => x.desdeReserva)) porCuenta[cuentaDe(i.medioPago)] += i.monto;
    const delMes = aRegistrar.filter((x) => !x.desdeReserva).reduce((a, x) => a + x.monto, 0);
    const totalReserva = porCuenta.Banco + porCuenta.Efectivo;
    return { porCuenta, totalReserva, delMes, total: totalReserva + delMes };
  })();
  const todosTildados = items.length > 0 && aRegistrar.length === items.length;

  function alternarTilde(id) {
    setTildados((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  }

  function tildarTodos(valor) {
    setTildados(valor ? new Set(items.map((i) => i.id)) : new Set());
  }

  async function registrarTodo() {
    if (aRegistrar.length === 0) return;
    setError(null);
    setMensaje(null);
    const avisos = await revisarDuplicados(aRegistrar);
    const lineas = [
      `Se van a registrar ${aRegistrar.length} gasto(s) tildados como pagados, por ${pesos(sel.total)}.${items.length > aRegistrar.length ? ` Los otros ${items.length - aRegistrar.length} siguen en la lista.` : ""}`,
      sel.totalReserva > 0 ? `Salen de la reserva: ${pesos(sel.totalReserva)} (Banco ${pesos(sel.porCuenta.Banco)} · Efectivo ${pesos(sel.porCuenta.Efectivo)}).` : null,
      sel.delMes > 0 ? `Son gastos del mes (no descuentan de la reserva): ${pesos(sel.delMes)}.` : null,
      avisos.length ? `\n⚠ Ojo, posibles duplicados:\n- ${avisos.join("\n- ")}` : null,
      "\n¿Registrarlos?",
    ].filter(Boolean);
    if (!window.confirm(lineas.join("\n"))) return;
    setRegistrando(true);
    try {
      const { registrados, fallidos } = await registrarPagosPlanificados(aRegistrar, categorias);
      setTildados(new Set());
      await recargar();
      await cargarCuentas();
      if (fallidos.length === 0) setMensaje(`✅ Listo: se registraron ${registrados.length} gasto(s). Ya se descontaron de la reserva.`);
      else {
        setError(
          `Se registraron ${registrados.length}, pero ${fallidos.length} fallaron y siguen en la lista: ${fallidos.map((f) => `${f.item.concepto} (${f.error})`).join("; ")}. Antes de reintentar, mirá en Gastos que no se haya cargado.`
        );
      }
    } catch (err) {
      setError(err.message);
      await recargar();
    } finally {
      setRegistrando(false);
    }
  }

  const alcanza = totales.queda >= 0;
  const faltaBanco = totales.porCuenta.Banco > saldo.Banco;
  const faltaEfectivo = totales.porCuenta.Efectivo > saldo.Efectivo;

  return (
    <main className="mx-auto max-w-6xl p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-brown/70">Gerencial</p>
      <h1 className="font-heading text-3xl font-extrabold text-brand-brown">🧮 Planificar pagos</h1>
      <p className="mt-1 max-w-3xl text-sm text-gray-600">
        Cargá todo lo que hay que pagar y mirá el total contra lo que hay disponible en la reserva. A medida que vas pagando, tildá «Pagué» en cada
        renglón (o en todos) y registrá lo tildado con un solo botón: se suma a Gastos y descuenta de la reserva solo.
      </p>

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
      {mensaje && <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{mensaje}</div>}

      {cargando ? (
        <p className="mt-6 text-sm text-gray-500">Cargando...</p>
      ) : (
        <>
          {cierre && (
            <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <strong>Todavía no cerraste {NOMBRES_MES[cierre.mes - 1]}.</strong> Al cerrarlo entran a la reserva: Banco{" "}
              <strong>{pesos(cierre.reparto.banco)}</strong> y Efectivo <strong>{pesos(cierre.reparto.efectivo)}</strong>, y el disponible de abajo
              todavía no los cuenta.{" "}
              <Link href="/gerencial/cierre-mensual" className="font-semibold underline">
                Ir a Cierre de Mes →
              </Link>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tarjeta
              titulo="Disponible en la reserva"
              valor={pesos(totales.disponible)}
              tono="fuerte"
              detalle={
                <>
                  Banco {pesos(saldo.Banco)} · Efectivo {pesos(saldo.Efectivo)}
                </>
              }
            />
            <Tarjeta titulo="Gastos a pagar" valor={pesos(totales.total)} detalle={`${items.length} gasto${items.length === 1 ? "" : "s"} en la lista`} />
            <Tarjeta
              titulo="Honorarios por liquidar"
              valor={pesos(totales.honorarios)}
              detalle={pendientes.length ? `${pendientes.filter((p) => incluidos[p.profesionalId]).length} de ${pendientes.length} profesionales sumados` : "Nada pendiente este mes"}
            />
            <Tarjeta
              titulo={alcanza ? "Te queda" : "No alcanza: faltan"}
              valor={pesos(Math.abs(totales.queda))}
              tono={alcanza ? "bueno" : "malo"}
              detalle={
                <>
                  {faltaBanco && <div className="font-semibold text-red-700">En Banco faltan {pesos(totales.porCuenta.Banco - saldo.Banco)}</div>}
                  {faltaEfectivo && <div className="font-semibold text-red-700">En Efectivo faltan {pesos(totales.porCuenta.Efectivo - saldo.Efectivo)}</div>}
                  {!faltaBanco && !faltaEfectivo && <>Banco {pesos(saldo.Banco - totales.porCuenta.Banco)} · Efectivo {pesos(saldo.Efectivo - totales.porCuenta.Efectivo)} (sin contar honorarios)</>}
                </>
              }
            />
          </div>
          {totales.delMes > 0 && (
            <p className="mt-2 text-xs text-gray-500">
              {pesos(totales.delMes)} de la lista están marcados como gastos del mes (no salen de la reserva), por eso no restan del disponible.
            </p>
          )}

          {cuentas && (
            <section className="mt-6 rounded-xl border border-brand-tan bg-brand-cream p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-heading text-lg font-bold text-brand-brown">Cuentas de {nombreDeMes(cuentas.mesActual.mes)}</h2>
                  <p className="text-xs text-gray-600">
                    Sueldos según las horas de {nombreDeMes(cuentas.mesHoras.mes)} × el valor hora de cada uno, y gastos fijos con el último monto que se pagó.
                  </p>
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-700">
                  Horas de:
                  <select
                    value={mesHoras}
                    onChange={(e) => {
                      setMesHoras(e.target.value);
                      cargarCuentas(e.target.value);
                    }}
                    className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                  >
                    <option value="anterior">el mes anterior</option>
                    <option value="actual">este mes</option>
                  </select>
                </label>
              </div>

              <table className="mt-3 w-full border-collapse text-sm">
                <tbody>
                  {[...cuentas.sueldos, ...cuentas.fijos].map((c) => {
                    const enLista = items.some((i) => i.concepto.trim().toLowerCase() === c.concepto.trim().toLowerCase());
                    return (
                      <tr key={c.clave} className="border-t border-brand-tan/50">
                        <td className="px-2 py-1.5 font-medium text-gray-900">
                          {c.tipo === "sueldo" ? `Sueldo ${c.nombre}` : c.nombre}
                          {c.tipo === "sueldo" && (
                            <span className="ml-2 text-xs font-normal text-gray-500">
                              {c.horas.toLocaleString("es-AR")} h × {pesos(c.valorHora)}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right font-semibold">{pesos(c.monto)}</td>
                        <td className="px-2 py-1.5 text-right text-xs">
                          {c.pagado ? (
                            <span className="text-emerald-700">✓ pagado{c.pagadoFecha ? ` el ${c.pagadoFecha.slice(8)}/${c.pagadoFecha.slice(5, 7)}` : ""}</span>
                          ) : enLista ? (
                            <span className="text-sky-700">en la lista</span>
                          ) : (
                            <button onClick={() => agregarUnaCuenta(c)} className="rounded-md border border-brand-brown/40 px-2 py-0.5 text-brand-brown hover:bg-brand-tan/30">
                              + Agregar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {cuentas.sueldos.length + cuentas.fijos.length === 0 && (
                    <tr>
                      <td className="px-2 py-2 text-gray-500">Todavía no hay sueldos con horas cargadas ni gastos fijos con monto.</td>
                    </tr>
                  )}
                </tbody>
              </table>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-brand-tan pt-3">
                <div className="text-sm">
                  <p>
                    Falta pagar: <strong>{pesos(cuentas.falta)}</strong> <span className="text-xs text-gray-500">(sueldos {pesos(cuentas.faltaSueldos)} + gastos fijos {pesos(cuentas.faltaFijos)})</span>
                  </p>
                  <p className={cuentas.diferencia >= 0 ? "text-emerald-700" : "font-semibold text-red-700"}>
                    En la reserva tenés {pesos(cuentas.reserva.total)}: {cuentas.diferencia >= 0 ? `te sobran ${pesos(cuentas.diferencia)}` : `te faltan ${pesos(-cuentas.diferencia)}`}.
                  </p>
                  <p className="text-xs text-gray-500">No incluye honorarios de profesionales ni gastos que no tengan monto cargado.</p>
                </div>
                <button
                  onClick={agregarTodoLoQueFalta}
                  disabled={cuentas.falta <= 0}
                  className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
                >
                  + Agregar todo lo que falta a la lista
                </button>
              </div>
            </section>
          )}

          <section className="mt-6 rounded-xl border border-gray-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-heading text-lg font-bold text-brand-brown">Lo que hay que pagar</h2>
              <button onClick={traerFijos} className="rounded-md border border-brand-brown/40 px-3 py-1.5 text-sm text-brand-brown hover:bg-brand-tan/30">
                ➕ Traer los gastos fijos del mes
              </button>
            </div>

            <form onSubmit={agregar} className="mt-3 grid gap-2 sm:grid-cols-12">
              <input
                value={form.concepto}
                onChange={(e) => setForm({ ...form, concepto: e.target.value })}
                placeholder="Qué se paga (ej. Luz, Alquiler, Sueldo Simón)"
                className={`${estiloInput} sm:col-span-4`}
              />
              <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className={`${estiloInput} sm:col-span-2`}>
                {categorias.map((c) => (
                  <option key={c.id} value={c.nombre}>
                    {c.nombre}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={form.monto}
                onChange={(e) => setForm({ ...form, monto: e.target.value })}
                placeholder="Monto"
                className={`${estiloInput} text-right sm:col-span-2`}
              />
              <select value={form.medioPago} onChange={(e) => setForm({ ...form, medioPago: e.target.value })} className={`${estiloInput} sm:col-span-2`}>
                {MEDIOS_PAGO_GASTO.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              <button type="submit" disabled={!form.concepto.trim() || !(Number(form.monto) > 0)} className="rounded-md bg-brand-brown px-3 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50 sm:col-span-2">
                + Agregar
              </button>
              <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-6">
                <input type="checkbox" checked={form.desdeReserva} onChange={(e) => setForm({ ...form, desdeReserva: e.target.checked })} />
                Se paga con la reserva del Consultorio
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-12">
                <input type="checkbox" checked={form.recordar} onChange={(e) => setForm({ ...form, recordar: e.target.checked })} />
                📌 Recordar como gasto fijo (el mes que viene sale solo en la lista, con este monto)
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-6">
                Fecha (si la dejás vacía, se usa la de hoy):
                <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className={estiloInput} />
              </label>
            </form>

            {items.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500">La lista está vacía. Agregá lo que hay que pagar o traé los gastos fijos del mes.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-brand-brown text-white">
                      <th className="px-3 py-2 text-center font-semibold">
                        <label className="flex items-center justify-center gap-1.5">
                          <input type="checkbox" checked={todosTildados} onChange={(e) => tildarTodos(e.target.checked)} title="Tildar todos" />
                          Pagué
                        </label>
                      </th>
                      <th className="px-3 py-2 text-left font-semibold">Concepto</th>
                      <th className="px-3 py-2 text-left font-semibold">Categoría</th>
                      <th className="px-3 py-2 text-left font-semibold">Medio</th>
                      <th className="px-3 py-2 text-center font-semibold">Con la reserva</th>
                      <th className="px-3 py-2 text-right font-semibold">Monto</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((i) => (
                      <tr key={i.id} className={`border-t border-gray-100 ${tildados.has(i.id) ? "bg-emerald-50" : ""}`}>
                        <td className="px-3 py-2 text-center">
                          <input type="checkbox" checked={tildados.has(i.id)} onChange={() => alternarTilde(i.id)} title="Ya lo pagué" />
                        </td>
                        <td className="px-3 py-2 font-medium text-gray-900">
                          {i.concepto}
                          {i.fecha && <span className="ml-2 text-xs font-normal text-gray-500">({i.fecha.split("-").reverse().join("/")})</span>}
                        </td>
                        <td className="px-3 py-2 text-gray-600">{i.categoria}</td>
                        <td className="px-3 py-2">
                          <select value={i.medioPago} onChange={(e) => cambiar(i.id, { medioPago: e.target.value })} className="rounded-md border border-gray-300 px-1.5 py-1 text-xs">
                            {MEDIOS_PAGO_GASTO.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <input type="checkbox" checked={i.desdeReserva} onChange={(e) => cambiar(i.id, { desdeReserva: e.target.checked })} />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            min={1}
                            defaultValue={i.monto}
                            onBlur={(e) => Number(e.target.value) > 0 && Number(e.target.value) !== i.monto && cambiar(i.id, { monto: e.target.value })}
                            className="w-28 rounded-md border border-gray-300 px-2 py-1 text-right text-sm"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button onClick={() => quitar(i.id)} className="text-xs text-red-600 hover:underline">
                            Quitar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-300 font-semibold">
                      <td colSpan={5} className="px-3 py-2 text-right">
                        Total de la lista
                      </td>
                      <td className="px-3 py-2 text-right">{pesos(totales.total)}</td>
                      <td></td>
                    </tr>
                    <tr className="font-semibold text-emerald-800">
                      <td colSpan={5} className="px-3 py-1 text-right">
                        Tildado como pagado
                      </td>
                      <td className="px-3 py-1 text-right">{pesos(sel.total)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>

          <section className="mt-6 rounded-xl border border-gray-200 p-4">
            <h2 className="font-heading text-lg font-bold text-brand-brown">Honorarios por liquidar este mes</h2>
            <p className="text-xs text-gray-500">
              Lo que falta liquidarle a cada profesional por los cobros de {NOMBRES_MES[Number(hoy.slice(5, 7)) - 1]} (según el tildado de Caja). Tildá a quién
              querés sumar al total; el pago se hace desde Producción, tildando los pacientes.
            </p>
            {pendientes.length === 0 ? (
              <p className="mt-3 text-sm text-gray-500">No hay honorarios pendientes de liquidar este mes (o todavía se están calculando).</p>
            ) : (
              <table className="mt-3 w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-brand-brown text-white">
                    <th className="px-3 py-2 text-center font-semibold">Sumar</th>
                    <th className="px-3 py-2 text-left font-semibold">Profesional</th>
                    <th className="px-3 py-2 text-right font-semibold">Cobros</th>
                    <th className="px-3 py-2 text-right font-semibold">Falta liquidar</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {pendientes.map((p) => (
                    <tr key={p.profesionalId} className="border-t border-gray-100">
                      <td className="px-3 py-2 text-center">
                        <input type="checkbox" checked={Boolean(incluidos[p.profesionalId])} onChange={(e) => setIncluidos((a) => ({ ...a, [p.profesionalId]: e.target.checked }))} />
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-900">{p.nombre}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{p.cobros}</td>
                      <td className="px-3 py-2 text-right font-semibold">{pesos(p.falta)}</td>
                      <td className="px-3 py-2 text-right">
                        <Link href="/gerencial/produccion" className="text-xs font-medium text-brand-brown hover:underline">
                          Pagar →
                        </Link>
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-gray-300 font-semibold">
                    <td colSpan={3} className="px-3 py-2 text-right">
                      Total sumado
                    </td>
                    <td className="px-3 py-2 text-right">{pesos(totales.honorarios)}</td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            )}
          </section>

          <div className="mt-6 flex flex-wrap items-center gap-4 rounded-xl border-2 border-brand-brown bg-brand-cream px-5 py-4">
            <div className="flex-1">
              <p className="font-heading text-base font-bold text-brand-brown">
                {items.length === 0
                  ? "Todavía no hay gastos para registrar"
                  : aRegistrar.length === 0
                    ? "Tildá «Pagué» en lo que ya pagaste para poder registrarlo"
                    : `Registrar ${aRegistrar.length} gasto${aRegistrar.length === 1 ? "" : "s"} tildado${aRegistrar.length === 1 ? "" : "s"} por ${pesos(sel.total)}`}
              </p>
              <p className="text-xs text-gray-600">
                {!alcanza && items.length > 0 ? "⚠ Con lo que hay en la reserva no alcanza, pero igual los podés registrar. " : ""}
                Se registran solo los tildados como pagados; los demás siguen en la lista. Al registrar, cada gasto queda en Gastos, descuenta de la reserva (si dice «con la reserva») y sale de esta lista.
              </p>
            </div>
            <button
              onClick={registrarTodo}
              disabled={registrando || aRegistrar.length === 0}
              className="rounded-lg bg-brand-brown px-6 py-3 text-base font-bold text-white hover:bg-brand-brown-dark disabled:opacity-50"
            >
              {registrando ? "Registrando..." : "✅ Registrar gastos"}
            </button>
          </div>
        </>
      )}
    </main>
  );
}

export default function PlanificarPagosPage() {
  return (
    <SoloDuena>
      <PlanificarContenido />
    </SoloDuena>
  );
}
