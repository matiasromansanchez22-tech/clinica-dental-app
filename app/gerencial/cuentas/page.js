"use client";

import { useEffect, useState } from "react";
import SoloDuenaYContador from "@/components/SoloDuenaYContador";
import { useAuth } from "@/lib/auth/AuthProvider";
import { fechaDeHoyISO } from "@/lib/agenda";
import { fechaHoraArgentina } from "@/lib/data/historialPagos";
import { obtenerBalanceMensual } from "@/lib/data/balance";
import {
  crearSaldoReal,
  crearTransferenciaEntreCuentas,
  eliminarMovimientoCuenta,
  estimarSaldos,
  obtenerCuentas,
  obtenerMovimientosCuentas,
} from "@/lib/data/cuentasDinero";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function rangoDelMes(anio, mes) {
  const ultimo = new Date(anio, mes, 0).getDate();
  const mm = String(mes).padStart(2, "0");
  return { desde: `${anio}-${mm}-01`, hasta: `${anio}-${mm}-${String(ultimo).padStart(2, "0")}` };
}

function formatoFecha(fechaISO) {
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}

function formatoPesos(n) {
  const r = Math.round(n);
  return `${r < 0 ? "-" : ""}$${Math.abs(r).toLocaleString("es-AR")}`;
}

const CLASE_CAMPO = "rounded-md border border-gray-300 px-3 py-2 text-sm";

function ModalBase({ titulo, onClose, onGuardar, guardando, error, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold text-gray-900">{titulo}</h2>
        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
        {children}
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button onClick={onGuardar} disabled={guardando} className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50">
            {guardando ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SaldoRealModal({ cuentas, fechaInicial, onClose, onGuardado }) {
  const [cuentaId, setCuentaId] = useState(cuentas[0]?.id || "");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(fechaInicial);
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  async function guardar() {
    if (!cuentaId) return setError("Elegí la cuenta.");
    if (monto === "" || Number(monto) < 0) return setError("Ingresá cuánta plata tiene la cuenta.");
    if (!fecha) return setError("Elegí la fecha.");
    setGuardando(true);
    setError(null);
    try {
      await crearSaldoReal({ fecha, cuentaId, monto, observaciones });
      onGuardado();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <ModalBase titulo="Anotar saldo real" onClose={onClose} onGuardar={guardar} guardando={guardando} error={error}>
      <p className="mt-2 text-xs text-gray-500">Lo que la cuenta tiene según el banco o la app del banco, a la fecha que elijas.</p>
      <label className="mt-3 flex flex-col gap-1 text-xs text-gray-700">
        Cuenta
        <select value={cuentaId} onChange={(e) => setCuentaId(e.target.value)} className={CLASE_CAMPO}>
          {cuentas.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs text-gray-700">
          Saldo
          <input autoFocus type="number" min={0} step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} className={CLASE_CAMPO} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-700">
          Fecha
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={CLASE_CAMPO} />
        </label>
      </div>
      <label className="mt-3 flex flex-col gap-1 text-xs text-gray-700">
        Observaciones (opcional)
        <input value={observaciones} onChange={(e) => setObservaciones(e.target.value)} className={CLASE_CAMPO} />
      </label>
    </ModalBase>
  );
}

function TransferenciaModal({ cuentas, fechaInicial, onClose, onGuardado }) {
  const [origen, setOrigen] = useState(cuentas[1]?.id || cuentas[0]?.id || "");
  const [destino, setDestino] = useState(cuentas[0]?.id || "");
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState(fechaInicial);
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  async function guardar() {
    if (!origen || !destino) return setError("Elegí las dos cuentas.");
    if (origen === destino) return setError("La cuenta de origen y la de destino tienen que ser distintas.");
    if (!monto || Number(monto) <= 0) return setError("Ingresá un monto válido.");
    if (!fecha) return setError("Elegí la fecha.");
    setGuardando(true);
    setError(null);
    try {
      await crearTransferenciaEntreCuentas({ fecha, cuentaId: origen, cuentaDestinoId: destino, monto, observaciones });
      onGuardado();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  const opciones = cuentas.map((c) => (
    <option key={c.id} value={c.id}>
      {c.nombre}
    </option>
  ));

  return (
    <ModalBase titulo="Pasé plata entre cuentas" onClose={onClose} onGuardar={guardar} guardando={guardando} error={error}>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs text-gray-700">
          Sale de
          <select value={origen} onChange={(e) => setOrigen(e.target.value)} className={CLASE_CAMPO}>
            {opciones}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-700">
          Entra a
          <select value={destino} onChange={(e) => setDestino(e.target.value)} className={CLASE_CAMPO}>
            {opciones}
          </select>
        </label>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs text-gray-700">
          Monto
          <input autoFocus type="number" min={0} step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} className={CLASE_CAMPO} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-gray-700">
          Fecha
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={CLASE_CAMPO} />
        </label>
      </div>
      <label className="mt-3 flex flex-col gap-1 text-xs text-gray-700">
        Observaciones (opcional)
        <input value={observaciones} onChange={(e) => setObservaciones(e.target.value)} className={CLASE_CAMPO} />
      </label>
      <p className="mt-3 text-[11px] text-gray-500">Es plata propia que cambia de cuenta: no suma ni resta en ningún balance.</p>
    </ModalBase>
  );
}

function TarjetaCuenta({ fila }) {
  const u = fila.ultimoSaldoReal;
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <p className="text-sm font-medium text-gray-600">{fila.cuenta.nombre}</p>
      <p className="mt-1 font-heading text-2xl font-semibold tabular-nums text-brand-brown">{formatoPesos(fila.saldo)}</p>
      <p className="mt-1 text-xs text-gray-500">
        {u ? `Saldo real del ${formatoFecha(u.fecha)}: ${formatoPesos(u.monto)}${fila.saldo !== u.monto ? " + lo que se pasó entre cuentas" : ""}` : "Todavía no anotaste el saldo real de esta cuenta."}
      </p>
    </div>
  );
}

function CuentasContenido() {
  const { perfil } = useAuth();
  const puedeEditar = perfil?.rol === "Duena";
  const hoy = fechaDeHoyISO();
  const [anio, setAnio] = useState(Number(hoy.slice(0, 4)));
  const [mes, setMes] = useState(Number(hoy.slice(5, 7)));
  const [cuentas, setCuentas] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [balance, setBalance] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null);

  const { desde, hasta } = rangoDelMes(anio, mes);
  const corte = hoy < hasta ? hoy : hasta;

  async function recargarMovimientos() {
    try {
      setMovimientos(await obtenerMovimientosCuentas());
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    let activo = true;
    Promise.all([obtenerCuentas(), obtenerMovimientosCuentas()])
      .then(([c, m]) => {
        if (!activo) return;
        setCuentas(c);
        setMovimientos(m);
      })
      .catch((e) => activo && setError(e.message.includes("cuentas_dinero") || e.message.includes("movimientos_cuentas") ? "Falta correr la migración 165 en Supabase." : e.message))
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    let activo = true;
    obtenerBalanceMensual(desde, hasta)
      .then((b) => activo && setBalance(b))
      .catch(() => activo && setBalance(null));
    return () => {
      activo = false;
    };
  }, [desde, hasta]);

  function cambiarMes(delta) {
    setBalance(null);
    const nuevo = new Date(anio, mes - 1 + delta, 1);
    setAnio(nuevo.getFullYear());
    setMes(nuevo.getMonth() + 1);
  }

  async function borrar(m) {
    if (!window.confirm(`¿Borrar este movimiento de ${formatoPesos(m.monto)}? Va a la Papelera.`)) return;
    try {
      await eliminarMovimientoCuenta(m.id);
      await recargarMovimientos();
    } catch (e) {
      setError(e.message);
    }
  }

  const hasta0 = estimarSaldos(cuentas, movimientos, hoy);
  const alCorte = estimarSaldos(cuentas, movimientos, corte);
  const nombre = (id) => cuentas.find((c) => c.id === id)?.nombre || "—";
  const mediosSinEfectivo = (balance?.netoPorMedioPago || []).filter((f) => f.clave !== "Efectivo");
  const netoSinEfectivo = mediosSinEfectivo.reduce((a, f) => a + f.monto, 0);
  const diferencia = alCorte.total - netoSinEfectivo;
  const hayAlgunSaldo = alCorte.filas.some((f) => f.ultimoSaldoReal);

  return (
    <main className="mx-auto max-w-4xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-900">🏦 Cuentas</h1>
        {puedeEditar && cuentas.length > 0 && (
          <div className="flex gap-2">
            <button onClick={() => setModal("saldo")} className="rounded-md border border-brand-brown px-4 py-2 text-sm font-medium text-brand-brown hover:bg-brand-tan/20">
              Anotar saldo real
            </button>
            <button onClick={() => setModal("transferencia")} className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark">
              Pasé plata entre cuentas
            </button>
          </div>
        )}
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Cuánta plata hay en cada cuenta (Galicia, Mercado Pago) y si coincide con el Balance Mensual. Es un control aparte: lo que se pasa de una cuenta a otra
        no es un ingreso ni un gasto, así que no cambia ningún balance.
      </p>

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
      {cargando && <p className="mt-6 text-sm text-gray-500">Cargando...</p>}

      {!cargando && cuentas.length > 0 && (
        <>
          <section className="mt-6">
            <h2 className="font-heading text-sm font-semibold text-brand-charcoal">Plata en las cuentas hoy</h2>
            <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {hasta0.filas.map((f) => (
                <TarjetaCuenta key={f.cuenta.id} fila={f} />
              ))}
              <div className="rounded-lg border border-brand-brown/30 bg-brand-tan/20 p-4">
                <p className="text-sm font-medium text-brand-brown">Total en cuentas</p>
                <p className="mt-1 font-heading text-2xl font-semibold tabular-nums text-brand-brown">{formatoPesos(hasta0.total)}</p>
                <p className="mt-1 text-xs text-gray-500">Galicia + Mercado Pago juntos.</p>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              El saldo de cada cuenta es el último &quot;saldo real&quot; que anotaste más lo que pasaste entre cuentas después. Cuando quieras volver a ajustarlo con
              la realidad, anotá un saldo real nuevo.
            </p>
          </section>

          <section className="mt-8 rounded-lg border border-gray-200 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-heading text-sm font-semibold text-brand-charcoal">Control contra el Balance Mensual</h2>
              <div className="ml-auto flex items-center gap-2">
                <button onClick={() => cambiarMes(-1)} className="rounded-md border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50">
                  ←
                </button>
                <span className="min-w-32 text-center text-sm font-semibold text-gray-800">
                  {MESES[mes - 1]} {anio}
                </span>
                <button onClick={() => cambiarMes(1)} className="rounded-md border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50">
                  →
                </button>
              </div>
            </div>

            {!balance ? (
              <p className="mt-3 text-sm text-gray-500">Calculando...</p>
            ) : (
              <dl className="mt-3 flex flex-col gap-2 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-gray-700">
                    Según el Balance Mensual: lo que queda sin contar efectivo
                    <span className="block text-xs text-gray-400">
                      {mediosSinEfectivo.length === 0
                        ? "No hay movimientos por transferencia o tarjeta este mes."
                        : mediosSinEfectivo.map((f) => `${f.clave} ${formatoPesos(f.monto)}`).join(" · ")}
                    </span>
                  </dt>
                  <dd className="font-semibold tabular-nums text-gray-900">{formatoPesos(netoSinEfectivo)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <dt className="text-gray-700">
                    Plata que hay en las cuentas al {formatoFecha(corte)}
                    <span className="block text-xs text-gray-400">
                      {hayAlgunSaldo ? "Galicia + Mercado Pago" : "Anotá el saldo real de las cuentas para poder comparar."}
                    </span>
                  </dt>
                  <dd className="font-semibold tabular-nums text-gray-900">{formatoPesos(alCorte.total)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-t border-gray-200 pt-2">
                  <dt className="font-semibold text-brand-brown">Diferencia</dt>
                  <dd className={`text-lg font-semibold tabular-nums ${Math.abs(diferencia) < 1 ? "text-brand-green" : "text-amber-700"}`}>
                    {hayAlgunSaldo ? formatoPesos(diferencia) : "—"}
                  </dd>
                </div>
              </dl>
            )}
            {balance && hayAlgunSaldo && (
              <p className="mt-3 text-xs text-gray-500">
                {diferencia > 0
                  ? "Hay más plata en las cuentas que la del balance del mes. Puede ser plata que venía de meses anteriores (reserva), o cobros por Débito/Crédito que se acreditan en el banco."
                  : diferencia < 0
                    ? "Hay menos plata en las cuentas que la del balance del mes. Puede ser que se hayan pagado gastos sin cargarlos en la app, o impuestos y comisiones del banco."
                    : "Las cuentas coinciden con el balance del mes."}{" "}
                Los gastos pagados con la reserva no están en el balance del mes: si usaste la reserva este mes, eso también mueve la diferencia.
              </p>
            )}
          </section>

          <section className="mt-8">
            <h2 className="font-heading text-sm font-semibold text-brand-charcoal">Movimientos</h2>
            <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="bg-brand-brown text-white">
                    <th className="px-3 py-2 text-left font-semibold">Fecha</th>
                    <th className="px-3 py-2 text-left font-semibold">Qué</th>
                    <th className="px-3 py-2 text-right font-semibold">Monto</th>
                    {puedeEditar && <th className="px-3 py-2"></th>}
                  </tr>
                </thead>
                <tbody>
                  {movimientos.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-4 text-center text-gray-500">
                        Todavía no hay movimientos. Empezá anotando el saldo real de cada cuenta.
                      </td>
                    </tr>
                  )}
                  {movimientos.map((m) => (
                    <tr key={m.id} className="border-t border-gray-100 align-top">
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-gray-800">{formatoFecha(m.fecha)}</td>
                      <td className="px-3 py-2 text-gray-900">
                        {m.tipo === "Saldo real" ? `Saldo real de ${nombre(m.cuentaId)}` : `${nombre(m.cuentaId)} → ${nombre(m.cuentaDestinoId)}`}
                        {m.observaciones && <span className="block text-[11px] text-gray-500">{m.observaciones}</span>}
                        <span className="block text-[11px] text-gray-400">
                          Cargado {fechaHoraArgentina(m.registradoEn)}
                          {m.registradoPor ? ` por ${m.registradoPor}` : ""}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-gray-900">{formatoPesos(m.monto)}</td>
                      {puedeEditar && (
                        <td className="px-3 py-2 text-right">
                          <button onClick={() => borrar(m)} className="text-xs text-red-600 hover:underline">
                            Borrar
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {modal === "saldo" && (
        <SaldoRealModal
          cuentas={cuentas}
          fechaInicial={hoy}
          onClose={() => setModal(null)}
          onGuardado={() => {
            setModal(null);
            recargarMovimientos();
          }}
        />
      )}
      {modal === "transferencia" && (
        <TransferenciaModal
          cuentas={cuentas}
          fechaInicial={hoy}
          onClose={() => setModal(null)}
          onGuardado={() => {
            setModal(null);
            recargarMovimientos();
          }}
        />
      )}
    </main>
  );
}

export default function CuentasPage() {
  return (
    <SoloDuenaYContador>
      <CuentasContenido />
    </SoloDuenaYContador>
  );
}
