"use client";

import { useEffect, useMemo, useState } from "react";
import SoloDuenaYContador from "@/components/SoloDuenaYContador";
import { fechaDeHoyISO } from "@/lib/agenda";
import { MEDIOS, obtenerLimpioPorDia } from "@/lib/data/limpioDiario";

function formatoPesos(n) {
  const v = Math.round(n);
  return `${v < 0 ? "-" : ""}$${Math.abs(v).toLocaleString("es-AR")}`;
}

function formatoFecha(fechaISO) {
  const [anio, mes, dia] = fechaISO.split("-").map(Number);
  const nombre = new Date(anio, mes - 1, dia).toLocaleDateString("es-AR", { weekday: "short" });
  return `${nombre} ${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;
}

function rangoDelMes(fechaISO) {
  const [anio, mes] = fechaISO.split("-").map(Number);
  const ultimoDia = new Date(anio, mes, 0).getDate();
  const mm = String(mes).padStart(2, "0");
  return { primero: `${anio}-${mm}-01`, ultimo: `${anio}-${mm}-${String(ultimoDia).padStart(2, "0")}` };
}

function colorDe(n) {
  return n < 0 ? "text-red-700" : "text-gray-900";
}

function Tarjeta({ titulo, monto, detalle }) {
  return (
    <div className="rounded-md border border-gray-200 px-3 py-2">
      <p className="text-xs text-gray-500">{titulo}</p>
      <p className={`text-lg font-semibold ${colorDe(monto)}`}>{formatoPesos(monto)}</p>
      {detalle && <p className="text-[11px] text-gray-400">{detalle}</p>}
    </div>
  );
}

function CeldaLimpio({ ingreso, egreso, limpio }) {
  return (
    <td className="px-3 py-2 text-right align-top">
      <span className={`font-semibold ${colorDe(limpio)}`}>{formatoPesos(limpio)}</span>
      {(ingreso !== 0 || egreso !== 0) && (
        <span className="block text-[11px] font-normal text-gray-400">
          +{formatoPesos(ingreso)} / -{formatoPesos(egreso)}
        </span>
      )}
    </td>
  );
}

function LimpioDiarioContenido() {
  const hoy = fechaDeHoyISO();
  const { primero, ultimo } = rangoDelMes(hoy);
  const [inicio, setInicio] = useState(primero);
  const [fin, setFin] = useState(ultimo);
  const [dias, setDias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;
    obtenerLimpioPorDia(inicio, fin)
      .then((d) => {
        if (cancelado) return;
        setDias(d);
        setError(null);
      })
      .catch((e) => !cancelado && setError(e.message))
      .finally(() => !cancelado && setCargando(false));
    return () => {
      cancelado = true;
    };
  }, [inicio, fin]);

  function elegirPeriodo(nuevoInicio, nuevoFin) {
    setCargando(true);
    setInicio(nuevoInicio);
    setFin(nuevoFin);
  }

  function mesAnterior() {
    const [anio, mes] = inicio.split("-").map(Number);
    const ref = `${mes === 1 ? anio - 1 : anio}-${String(mes === 1 ? 12 : mes - 1).padStart(2, "0")}-01`;
    const r = rangoDelMes(ref);
    elegirPeriodo(r.primero, r.ultimo);
  }

  function mesSiguiente() {
    const [anio, mes] = inicio.split("-").map(Number);
    const ref = `${mes === 12 ? anio + 1 : anio}-${String(mes === 12 ? 1 : mes + 1).padStart(2, "0")}-01`;
    const r = rangoDelMes(ref);
    elegirPeriodo(r.primero, r.ultimo);
  }

  const { filas, totales } = useMemo(() => {
    const acumulado = Object.fromEntries(MEDIOS.map((m) => [m.clave, 0]));
    const ingresos = Object.fromEntries(MEDIOS.map((m) => [m.clave, 0]));
    const egresos = Object.fromEntries(MEDIOS.map((m) => [m.clave, 0]));
    const conAcumulado = dias.map((d) => {
      for (const m of MEDIOS) {
        acumulado[m.clave] += d.limpio[m.clave];
        ingresos[m.clave] += d.ingresos[m.clave];
        egresos[m.clave] += d.egresos[m.clave];
      }
      const otros = MEDIOS.filter((m) => m.clave !== "efectivo" && m.clave !== "transferencia");
      const sumar = (obj) => otros.reduce((a, m) => a + obj[m.clave], 0);
      return {
        ...d,
        otros: { ingreso: sumar(d.ingresos), egreso: sumar(d.egresos), limpio: sumar(d.limpio) },
        total: MEDIOS.reduce((a, m) => a + d.limpio[m.clave], 0),
        acumEfectivo: acumulado.efectivo,
        acumTransferencia: acumulado.transferencia,
        acumTotal: MEDIOS.reduce((a, m) => a + acumulado[m.clave], 0),
      };
    });
    const limpio = Object.fromEntries(MEDIOS.map((m) => [m.clave, ingresos[m.clave] - egresos[m.clave]]));
    return { filas: conAcumulado, totales: { ingresos, egresos, limpio } };
  }, [dias]);

  const otrosLimpio = MEDIOS.filter((m) => m.clave !== "efectivo" && m.clave !== "transferencia").reduce(
    (a, m) => a + totales.limpio[m.clave],
    0
  );
  const totalLimpio = totales.limpio.efectivo + totales.limpio.transferencia + otrosLimpio;

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">💵 Lo que queda limpio</h1>
      <p className="mt-1 text-sm text-gray-500">
        Lo cobrado cada día (General + Ortodoncia) menos los gastos y pagos a profesionales, separado por efectivo y
        transferencia, con el acumulado del período.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button onClick={mesAnterior} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
          ← Mes anterior
        </button>
        <button
          onClick={() => elegirPeriodo(primero, ultimo)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50"
        >
          Este mes
        </button>
        <button onClick={mesSiguiente} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
          Mes siguiente →
        </button>
        <input
          type="date"
          value={inicio}
          onChange={(e) => e.target.value && elegirPeriodo(e.target.value, fin)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
        <span className="text-sm text-gray-500">a</span>
        <input
          type="date"
          value={fin}
          onChange={(e) => e.target.value && elegirPeriodo(inicio, e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
      </div>

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      {cargando ? (
        <p className="mt-6 text-sm text-gray-500">Calculando...</p>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tarjeta
              titulo="Efectivo limpio"
              monto={totales.limpio.efectivo}
              detalle={`+${formatoPesos(totales.ingresos.efectivo)} / -${formatoPesos(totales.egresos.efectivo)}`}
            />
            <Tarjeta
              titulo="Transferencia limpia"
              monto={totales.limpio.transferencia}
              detalle={`+${formatoPesos(totales.ingresos.transferencia)} / -${formatoPesos(totales.egresos.transferencia)}`}
            />
            <Tarjeta titulo="Otros medios (débito, crédito, MP, QR)" monto={otrosLimpio} />
            <Tarjeta titulo="Total limpio del período" monto={totalLimpio} />
          </div>

          <div className="mt-5 overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead>
                <tr className="bg-brand-brown text-white">
                  <th className="px-3 py-2 text-left font-semibold">Día</th>
                  <th className="px-3 py-2 text-right font-semibold">Efectivo</th>
                  <th className="px-3 py-2 text-right font-semibold">Transferencia</th>
                  <th className="px-3 py-2 text-right font-semibold">Otros</th>
                  <th className="px-3 py-2 text-right font-semibold">Total del día</th>
                  <th className="px-3 py-2 text-right font-semibold">Acum. efectivo</th>
                  <th className="px-3 py-2 text-right font-semibold">Acum. transferencia</th>
                </tr>
              </thead>
              <tbody>
                {filas.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-4 text-center text-gray-500">
                      No hay movimientos en este período.
                    </td>
                  </tr>
                )}
                {filas.map((d) => (
                  <tr key={d.fecha} className="border-t border-gray-100">
                    <td className="px-3 py-2 align-top font-medium capitalize text-gray-900">{formatoFecha(d.fecha)}</td>
                    <CeldaLimpio
                      ingreso={d.ingresos.efectivo}
                      egreso={d.egresos.efectivo}
                      limpio={d.limpio.efectivo}
                    />
                    <CeldaLimpio
                      ingreso={d.ingresos.transferencia}
                      egreso={d.egresos.transferencia}
                      limpio={d.limpio.transferencia}
                    />
                    <CeldaLimpio ingreso={d.otros.ingreso} egreso={d.otros.egreso} limpio={d.otros.limpio} />
                    <td className={`px-3 py-2 text-right align-top font-semibold ${colorDe(d.total)}`}>
                      {formatoPesos(d.total)}
                    </td>
                    <td className={`px-3 py-2 text-right align-top ${colorDe(d.acumEfectivo)}`}>
                      {formatoPesos(d.acumEfectivo)}
                    </td>
                    <td className={`px-3 py-2 text-right align-top ${colorDe(d.acumTransferencia)}`}>
                      {formatoPesos(d.acumTransferencia)}
                    </td>
                  </tr>
                ))}
              </tbody>
              {filas.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                    <td className="px-3 py-2">Total</td>
                    <td className={`px-3 py-2 text-right ${colorDe(totales.limpio.efectivo)}`}>
                      {formatoPesos(totales.limpio.efectivo)}
                    </td>
                    <td className={`px-3 py-2 text-right ${colorDe(totales.limpio.transferencia)}`}>
                      {formatoPesos(totales.limpio.transferencia)}
                    </td>
                    <td className={`px-3 py-2 text-right ${colorDe(otrosLimpio)}`}>{formatoPesos(otrosLimpio)}</td>
                    <td className={`px-3 py-2 text-right ${colorDe(totalLimpio)}`}>{formatoPesos(totalLimpio)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <p className="mt-3 text-xs text-gray-400">
            Debajo de cada número: lo que entró (+) y lo que salió (-) ese día. No cuentan los sueldos ni los gastos de
            categorías que salen de la reserva (alquiler, impuestos, etc.), igual que en el Cierre Diario. El acumulado
            arranca en el primer día del período elegido.
          </p>
        </>
      )}
    </main>
  );
}

export default function LimpioDiarioPage() {
  return (
    <SoloDuenaYContador>
      <LimpioDiarioContenido />
    </SoloDuenaYContador>
  );
}
