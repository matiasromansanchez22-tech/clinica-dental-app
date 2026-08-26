"use client";

import { useEffect, useState } from "react";
import SoloDuena from "@/components/SoloDuena";
import { fechaDeHoyISO } from "@/lib/agenda";
import { obtenerBalanceMensual } from "@/lib/data/balance";

const NOMBRES_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function mesActualDeFecha(fechaISO) {
  const [anio, mes] = fechaISO.split("-").map(Number);
  return { anio, mes };
}

function primerYUltimoDiaDelMes(anio, mes) {
  const primero = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const ultimoDia = new Date(anio, mes, 0).getDate();
  const ultimo = `${anio}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
  return { primero, ultimo };
}

function sumarMeses({ anio, mes }, delta) {
  const total = mes - 1 + delta;
  const nuevoAnio = anio + Math.floor(total / 12);
  const nuevoMes = ((total % 12) + 12) % 12;
  return { anio: nuevoAnio, mes: nuevoMes + 1 };
}

function formatoMoneda(monto) {
  return `$${Math.round(monto).toLocaleString("es-AR")}`;
}

function TarjetaResumen({ titulo, monto, tono }) {
  const colores = {
    ingreso: "border-brand-mint/50 bg-brand-mint/10 text-brand-green",
    egreso: "border-red-200 bg-red-50 text-red-800",
    balancePositivo: "border-brand-brown/30 bg-brand-tan/20 text-brand-brown",
    balanceNegativo: "border-red-300 bg-red-100 text-red-900",
  };
  return (
    <div className={`rounded-lg border px-5 py-4 ${colores[tono]}`}>
      <p className="text-sm font-medium opacity-80">{titulo}</p>
      <p className="mt-1 text-2xl font-heading font-semibold">{formatoMoneda(monto)}</p>
    </div>
  );
}

function TablaNeto({ titulo, filas }) {
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <h3 className="font-heading text-sm font-semibold text-brand-charcoal">{titulo}</h3>
      {filas.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">Sin datos en este período.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {filas.map((f) => (
            <li key={f.clave} className="flex items-center justify-between border-b border-gray-100 pb-2 text-sm last:border-0 last:pb-0">
              <span className="text-gray-600">{f.clave}</span>
              <span className="text-right">
                <span className="block text-xs text-gray-400">
                  +{formatoMoneda(f.ingreso)} − {formatoMoneda(f.egreso)}
                </span>
                <span className={`font-semibold ${f.monto >= 0 ? "text-brand-green" : "text-red-700"}`}>
                  {formatoMoneda(f.monto)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TablaDesglose({ titulo, filas }) {
  const total = filas.reduce((acc, f) => acc + f.monto, 0);
  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <h3 className="font-heading text-sm font-semibold text-brand-charcoal">{titulo}</h3>
      {filas.length === 0 ? (
        <p className="mt-2 text-sm text-gray-500">Sin datos en este período.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-1.5">
          {filas.map((f) => (
            <li key={f.clave} className="flex items-center justify-between text-sm">
              <span className="text-gray-600">{f.clave}</span>
              <span className="flex items-center gap-2">
                <span className="font-medium text-gray-900">{formatoMoneda(f.monto)}</span>
                <span className="w-12 text-right text-xs text-gray-400">
                  {total > 0 ? `${Math.round((f.monto / total) * 100)}%` : ""}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function BalanceMensualContenido() {
  const hoy = fechaDeHoyISO();
  const [mesSeleccionado, setMesSeleccionado] = useState(() => mesActualDeFecha(hoy));
  const [balance, setBalance] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setCargando(true);
    const { primero, ultimo } = primerYUltimoDiaDelMes(mesSeleccionado.anio, mesSeleccionado.mes);
    obtenerBalanceMensual(primero, ultimo)
      .then(setBalance)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [mesSeleccionado]);

  const nombreMes = `${NOMBRES_MES[mesSeleccionado.mes - 1]} ${mesSeleccionado.anio}`;

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">Balance Mensual</h1>
      <p className="mt-1 text-sm text-gray-500">
        Ingresos (Caja General + Caja Ortodoncia) menos Gastos, para ver la ganancia real del mes.
      </p>

      <div className="mt-4 flex items-center gap-2">
        <button
          onClick={() => setMesSeleccionado((m) => sumarMeses(m, -1))}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          ← Mes anterior
        </button>
        <span className="font-heading w-40 text-center text-sm font-semibold text-brand-brown">{nombreMes}</span>
        <button
          onClick={() => setMesSeleccionado((m) => sumarMeses(m, 1))}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          Mes siguiente →
        </button>
        <button
          onClick={() => setMesSeleccionado(mesActualDeFecha(hoy))}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          Este mes
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      {cargando ? (
        <p className="mt-6 text-sm text-gray-500">Cargando...</p>
      ) : (
        balance && (
          <>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <TarjetaResumen titulo="Ingresos totales" monto={balance.ingresosTotal} tono="ingreso" />
              <TarjetaResumen titulo="Egresos totales" monto={balance.egresosTotal} tono="egreso" />
              <TarjetaResumen
                titulo="Balance del mes"
                monto={balance.balance}
                tono={balance.balance >= 0 ? "balancePositivo" : "balanceNegativo"}
              />
            </div>

            <div className="mt-6">
              <TablaNeto titulo="Lo que queda limpio por medio de pago (ingresos − egresos)" filas={balance.netoPorMedioPago} />
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TablaDesglose titulo="Ingresos por especialidad" filas={balance.ingresosPorEspecialidad} />
              <TablaDesglose titulo="Ingresos por medio de pago" filas={balance.ingresosPorMedioPago} />
              <TablaDesglose titulo="Egresos por categoría" filas={balance.egresosPorCategoria} />
              <TablaDesglose titulo="Egresos por medio de pago" filas={balance.egresosPorMedioPago} />
            </div>

            <p className="mt-4 text-xs text-gray-400">
              {balance.cantidadCobrosGeneral} cobros de Odontología General · {balance.cantidadCobrosOrtodoncia} cobros
              de Ortodoncia · {balance.cantidadGastos} gastos registrados en el período.
            </p>
          </>
        )
      )}
    </main>
  );
}

export default function BalanceMensualPage() {
  return (
    <SoloDuena>
      <BalanceMensualContenido />
    </SoloDuena>
  );
}
