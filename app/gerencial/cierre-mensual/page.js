"use client";

import { useEffect, useState } from "react";
import SoloDuenaYContador from "@/components/SoloDuenaYContador";
import { useAuth } from "@/lib/auth/AuthProvider";
import { esMesDePrueba } from "@/lib/mesesDePrueba";
import { fechaDeHoyISO } from "@/lib/agenda";
import { obtenerBalanceMensual } from "@/lib/data/balance";
import { aprobarCierreMes, obtenerCierreMes, obtenerDiasPendientesDelMes, reabrirCierreMes, repartirBalance } from "@/lib/data/cierresMes";
import { obtenerSaldosPersonales } from "@/lib/data/finanzasPersonales";

const NOMBRES_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function formatoPesos(n) {
  return `${n < 0 ? "−" : ""}$${Math.abs(Math.round(n)).toLocaleString("es-AR")}`;
}

const conSigno = (n) => (n >= 0 ? "+" : "−") + formatoPesos(Math.abs(n));

function rangoDelMes(anio, mes) {
  const inicio = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const ultimoDia = new Date(anio, mes, 0).getDate();
  const fin = `${anio}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
  return { inicio, fin };
}

function CierreMensualContenido() {
  const { user, perfil } = useAuth();
  const soloLectura = perfil?.rol === "Contador";
  const hoy = fechaDeHoyISO();
  const [anio, setAnio] = useState(Number(hoy.slice(0, 4)));
  const [mes, setMes] = useState(Number(hoy.slice(5, 7)));
  const [balance, setBalance] = useState(null);
  const [diasPendientes, setDiasPendientes] = useState([]);
  const [cierreAprobado, setCierreAprobado] = useState(null);
  const [observaciones, setObservaciones] = useState("");
  const [saldoReserva, setSaldoReserva] = useState(null);
  const [cerrarIgual, setCerrarIgual] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState(null);
  const [mensaje, setMensaje] = useState(null);

  async function recargar() {
    setCargando(true);
    setMensaje(null);
    setError(null);
    try {
      const { inicio, fin } = rangoDelMes(anio, mes);
      const [bal, pendientes, aprobado, saldos] = await Promise.all([
        obtenerBalanceMensual(inicio, fin),
        obtenerDiasPendientesDelMes(anio, mes),
        obtenerCierreMes(anio, mes),
        obtenerSaldosPersonales("Consultorio").catch(() => null),
      ]);
      setSaldoReserva(saldos);
      setCerrarIgual(false);
      setBalance(bal);
      setDiasPendientes(pendientes);
      setCierreAprobado(aprobado);
      setObservaciones(aprobado?.observaciones || "");
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anio, mes]);

  async function handleCerrar() {
    if (diasPendientes.length > 0 && !cerrarIgual) return;
    const rep = repartirBalance(balance);
    const sinAprobar =
      diasPendientes.length > 0 ? ` Ojo: ${diasPendientes.length} día(s) no tienen el Cierre Diario aprobado y se cierra igual.` : "";
    if (
      !window.confirm(
        `¿Cerrar ${NOMBRES_MES[mes - 1]} ${anio}? Los gastos y pagos a profesionales de ese mes van a quedar bloqueados. A la reserva de Consultorio entran: Banco ${conSigno(rep.banco)} y Efectivo ${conSigno(rep.efectivo)}.${sinAprobar}`
      )
    )
      return;
    setProcesando(true);
    setError(null);
    setMensaje(null);
    try {
      const nota =
        diasPendientes.length > 0
          ? `${observaciones ? observaciones + " · " : ""}Se cerró sin aprobar el Cierre Diario de ${diasPendientes.length} día(s): ${diasPendientes.join(", ")}.`
          : observaciones;
      await aprobarCierreMes(anio, mes, user.id, perfil?.nombre || user.email, nota, balance);
      setMensaje("Mes cerrado correctamente. El balance ya quedó cargado en la reserva de Consultorio (banco y efectivo).");
      await recargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setProcesando(false);
    }
  }

  async function handleReabrir() {
    if (
      !window.confirm(
        `¿Reabrir ${NOMBRES_MES[mes - 1]} ${anio}? Los gastos y pagos de ese mes van a volver a ser editables, y se saca de la reserva de Consultorio el balance que se había cargado al cerrar.`
      )
    )
      return;
    setProcesando(true);
    setError(null);
    setMensaje(null);
    try {
      await reabrirCierreMes(anio, mes);
      setMensaje("Mes reabierto. El balance ya se sacó de la reserva de Consultorio.");
      await recargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setProcesando(false);
    }
  }

  const detalleMostrado = cierreAprobado?.detalle || balance;
  // Lo que entra (o entró) a cada cuenta de la reserva. Los cierres viejos no traían el reparto: iba todo al banco.
  const reparto = cierreAprobado
    ? cierreAprobado.detalle?.reparto || { banco: Number(cierreAprobado.detalle?.balance) || 0, efectivo: 0 }
    : balance
      ? repartirBalance(balance)
      : null;

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">Cierre de Mes</h1>
      <p className="mt-1 text-sm text-gray-500">
        Cierra el mes con una foto fija del balance y bloquea gastos y pagos a profesionales de ese mes, para que no
        se puedan seguir editando en silencio.
      </p>

      <div className="mt-4 flex items-center gap-2">
        <select
          value={mes}
          onChange={(e) => setMes(Number(e.target.value))}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          {NOMBRES_MES.map((nombre, i) => (
            <option key={nombre} value={i + 1}>
              {nombre}
            </option>
          ))}
        </select>
        <input
          type="number"
          value={anio}
          onChange={(e) => setAnio(Number(e.target.value))}
          className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
        <button onClick={recargar} className="ml-auto rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
          ↻ Actualizar
        </button>
      </div>

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
      {mensaje && (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{mensaje}</div>
      )}

      {cargando || !balance ? (
        <p className="mt-6 text-sm text-gray-500">Calculando...</p>
      ) : (
        <>
          {!cierreAprobado && esMesDePrueba(anio, mes) && (
            <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Mes de prueba: se muestra solo como historial.
            </div>
          )}

          {cierreAprobado && (
            <div className="mt-4 rounded-md border border-brand-tan bg-brand-tan/10 px-3 py-2 text-sm text-brand-brown">
              🔒 Este mes ya está cerrado — se muestran los números <strong>congelados</strong> del momento de la
              aprobación.
            </div>
          )}

          {!cierreAprobado && !esMesDePrueba(anio, mes) && diasPendientes.length > 0 && (
            <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              ⚠️ Faltan cerrar {diasPendientes.length} día{diasPendientes.length === 1 ? "" : "s"} antes de poder
              cerrar el mes: {diasPendientes.join(", ")}.{soloLectura ? "" : " Andá a Cierre Diario y aprobá cada uno, o cerrá el mes igual con la casilla de abajo."}
            </div>
          )}

          <h2 className="mt-6 mb-2 font-heading text-sm font-semibold text-brand-brown">
            {NOMBRES_MES[mes - 1]} {anio}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-md border border-gray-200 px-3 py-2">
              <p className="text-xs text-gray-500">Ingresos</p>
              <p className="text-base font-semibold text-gray-900">{formatoPesos(detalleMostrado.ingresosTotal)}</p>
            </div>
            <div className="rounded-md border border-gray-200 px-3 py-2">
              <p className="text-xs text-gray-500">Gastos</p>
              <p className="text-base font-semibold text-gray-900">{formatoPesos(detalleMostrado.totalGastos)}</p>
            </div>
            <div className="rounded-md border border-gray-200 px-3 py-2">
              <p className="text-xs text-gray-500">Pagos a profesionales</p>
              <p className="text-base font-semibold text-gray-900">{formatoPesos(detalleMostrado.totalPagosProfesionales)}</p>
            </div>
            <div className="rounded-md border border-gray-200 px-3 py-2">
              <p className="text-xs text-gray-500">Egresos totales</p>
              <p className="text-base font-semibold text-gray-900">{formatoPesos(detalleMostrado.egresosTotal)}</p>
            </div>
          </div>
          <div className={`mt-3 rounded-md px-4 py-3 text-white ${detalleMostrado.balance >= 0 ? "bg-brand-green" : "bg-red-700"}`}>
            <span className="text-sm">Balance del mes: </span>
            <span className="text-xl font-bold">{formatoPesos(detalleMostrado.balance)}</span>
          </div>

          {reparto && !esMesDePrueba(anio, mes) && (
            <div className="mt-6 rounded-lg border border-gray-200 p-4">
              <h2 className="font-heading text-sm font-semibold text-brand-brown">
                {cierreAprobado ? "Lo que entró a la reserva de Consultorio" : "Lo que entra a la reserva de Consultorio al cerrar"}
              </h2>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  { cuenta: "Banco", detalle: "todo lo que entró a la cuenta (transferencias, débito, etc.) menos lo que salió", monto: reparto.banco },
                  { cuenta: "Efectivo", detalle: "lo cobrado en efectivo menos lo pagado en efectivo", monto: reparto.efectivo },
                ].map((c) => (
                  <div key={c.cuenta} className="rounded-md border border-gray-200 px-3 py-2">
                    <p className="text-xs text-gray-500">{c.cuenta}</p>
                    <p className={`text-lg font-semibold ${c.monto >= 0 ? "text-brand-green" : "text-red-700"}`}>{conSigno(c.monto)}</p>
                    <p className="text-[11px] text-gray-500">{c.detalle}</p>
                    {!cierreAprobado && saldoReserva && (
                      <p className="mt-1 text-xs text-gray-700">
                        Reserva hoy {formatoPesos(saldoReserva[c.cuenta])} → queda en{" "}
                        <strong>{formatoPesos(saldoReserva[c.cuenta] + c.monto)}</strong>
                      </p>
                    )}
                  </div>
                ))}
              </div>
              {!cierreAprobado && (
                <p className="mt-2 text-xs text-gray-500">
                  Antes de cerrar, controlá que el Banco coincida con lo que realmente quedó en la cuenta: si falta cargar algún
                  gasto, después de cerrar no se puede cargar sin reabrir el mes.
                </p>
              )}
            </div>
          )}

          <div className="mt-8 rounded-lg border border-brand-tan bg-brand-tan/10 p-4">
            <h2 className="font-heading text-sm font-semibold text-brand-brown">Cierre final del mes</h2>
            {cierreAprobado ? (
              <>
                <p className="mt-1 text-sm text-brand-green">
                  ✅ Aprobado por {cierreAprobado.nombre_duena} el {new Date(cierreAprobado.aprobado_en).toLocaleString("es-AR")}.
                  Gastos y pagos a profesionales de este mes quedaron bloqueados, y el balance ya se cargó en la
                  reserva de Consultorio.
                </p>
                {cierreAprobado.observaciones && (
                  <p className="mt-2 text-sm text-gray-700">Observaciones: {cierreAprobado.observaciones}</p>
                )}
                {!soloLectura && (
                  <button
                    onClick={handleReabrir}
                    disabled={procesando}
                    className="mt-3 rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    {procesando ? "Reabriendo..." : "🔓 Reabrir mes para corregir algo"}
                  </button>
                )}
              </>
            ) : esMesDePrueba(anio, mes) ? (
              <p className="mt-1 text-sm text-gray-500">
                {NOMBRES_MES[mes - 1]} {anio} fue un mes de prueba y no se cierra: no entra a la reserva ni cuenta en los
                totales.
              </p>
            ) : soloLectura ? (
              <p className="mt-1 text-sm text-gray-500">
                {diasPendientes.length > 0
                  ? "Este mes todavía no está cerrado: faltan cerrar días."
                  : "Este mes todavía no está cerrado: está pendiente de la aprobación de la Dueña."}{" "}
                Los números de arriba son provisorios.
              </p>
            ) : (
              <>
                <p className="mt-1 text-sm text-gray-500">
                  {diasPendientes.length > 0
                    ? "Todavía hay días sin cerrar este mes (ver aviso arriba): aprobalos en Cierre Diario o tildá la opción de cerrar igual."
                    : "Todos los días de este mes ya están cerrados. Podés cerrar el mes."}
                </p>
                {diasPendientes.length > 0 && (
                  <label className="mt-3 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    <input type="checkbox" className="mt-0.5" checked={cerrarIgual} onChange={(e) => setCerrarIgual(e.target.checked)} />
                    <span>
                      Cerrar el mes igual, aunque falte aprobar el Cierre Diario de {diasPendientes.length} día
                      {diasPendientes.length === 1 ? "" : "s"}. Queda anotado en las observaciones del cierre.
                    </span>
                  </label>
                )}
                <label className="mt-3 flex flex-col gap-1 text-sm text-gray-700">
                  Observaciones (opcional)
                  <input
                    value={observaciones}
                    onChange={(e) => setObservaciones(e.target.value)}
                    className="rounded-md border border-gray-300 px-2 py-1.5"
                  />
                </label>
                <button
                  onClick={handleCerrar}
                  disabled={procesando || (diasPendientes.length > 0 && !cerrarIgual)}
                  className="mt-3 rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
                >
                  {procesando ? "Cerrando..." : "✅ Cerrar mes"}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </main>
  );
}

export default function CierreMensualPage() {
  return (
    <SoloDuenaYContador>
      <CierreMensualContenido />
    </SoloDuenaYContador>
  );
}
