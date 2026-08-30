"use client";

import { useEffect, useState } from "react";
import SoloDuena from "@/components/SoloDuena";
import { fechaDeHoyISO } from "@/lib/agenda";
import { obtenerBalanceAcumuladoTotal } from "@/lib/data/balance";
import { actualizarConfiguracionGeneral, obtenerConfiguracionGeneral } from "@/lib/data/configuracionGeneral";
import { obtenerActividadDelDia, obtenerResumenMensual, obtenerTendenciaMensual } from "@/lib/data/estadisticas";

const NOMBRES_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function formatoPesos(n) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

function Tarjeta({ etiqueta, valor, sub }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
      <p className="text-xs font-medium uppercase text-gray-400">{etiqueta}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{valor}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

function IndicadorInversion({ acumulado, umbral, onGuardarUmbral }) {
  const [editando, setEditando] = useState(false);
  const [umbralForm, setUmbralForm] = useState(String(umbral));
  const [guardando, setGuardando] = useState(false);

  const alcanzado = umbral > 0 && acumulado >= umbral;

  async function guardar() {
    setGuardando(true);
    try {
      await onGuardarUmbral(Number(umbralForm) || 0);
      setEditando(false);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div
      className={`rounded-lg border-2 px-5 py-4 ${
        alcanzado ? "border-emerald-400 bg-emerald-50" : "border-gray-200 bg-white"
      }`}
    >
      <p className="text-xs font-semibold uppercase text-gray-500">Plata acumulada (histórico)</p>
      <p className={`mt-1 text-3xl font-bold ${alcanzado ? "text-emerald-700" : "text-gray-900"}`}>
        {formatoPesos(acumulado)}
      </p>
      {alcanzado ? (
        <p className="mt-1 text-sm font-medium text-emerald-700">🟢 Superó el umbral que definiste para invertir.</p>
      ) : (
        <p className="mt-1 text-sm text-gray-500">
          {umbral > 0 ? `Falta ${formatoPesos(umbral - acumulado)} para llegar al umbral.` : "Todavía no definiste un umbral."}
        </p>
      )}

      <div className="mt-3 border-t border-gray-200 pt-3 text-sm">
        {editando ? (
          <div className="flex items-center gap-2">
            <span className="text-gray-600">Umbral para invertir:</span>
            <input
              type="number"
              value={umbralForm}
              onChange={(e) => setUmbralForm(e.target.value)}
              className="w-40 rounded-md border border-gray-300 px-2 py-1"
            />
            <button
              onClick={guardar}
              disabled={guardando}
              className="rounded-md bg-brand-brown px-3 py-1 text-xs font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
            >
              {guardando ? "Guardando..." : "Guardar"}
            </button>
            <button onClick={() => setEditando(false)} className="text-xs text-gray-500 hover:underline">
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setUmbralForm(String(umbral));
              setEditando(true);
            }}
            className="text-xs text-brand-brown hover:underline"
          >
            Umbral para invertir: {formatoPesos(umbral)} — cambiar
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-gray-400">
        Este número es solo informativo: vos definís cuánto es "suficiente" y decidís cuándo mover la plata.
      </p>
    </div>
  );
}

function PaginaEstadisticas() {
  const hoy = fechaDeHoyISO();
  const [actividadHoy, setActividadHoy] = useState(null);
  const [resumenMes, setResumenMes] = useState(null);
  const [tendencia, setTendencia] = useState([]);
  const [acumulado, setAcumulado] = useState(null);
  const [umbral, setUmbral] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const ahora = new Date();
    Promise.all([
      obtenerActividadDelDia(hoy),
      obtenerResumenMensual(ahora.getFullYear(), ahora.getMonth() + 1),
      obtenerTendenciaMensual(6),
      obtenerBalanceAcumuladoTotal(),
      obtenerConfiguracionGeneral(),
    ])
      .then(([act, mes, tend, bal, conf]) => {
        setActividadHoy(act);
        setResumenMes(mes);
        setTendencia(tend);
        setAcumulado(bal.acumulado);
        setUmbral(conf.monto_umbral_invertir || 0);
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function guardarUmbral(nuevoValor) {
    await actualizarConfiguracionGeneral("monto_umbral_invertir", nuevoValor);
    setUmbral(nuevoValor);
  }

  if (cargando) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <p className="text-sm text-gray-500">Cargando estadísticas...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">Panel de Estadísticas</h1>
      <p className="mt-0.5 text-sm text-gray-500">Solo visible para Dueña. Actividad de la clínica y plata acumulada.</p>

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      <div className="mt-5">
        <IndicadorInversion acumulado={acumulado} umbral={umbral} onGuardarUmbral={guardarUmbral} />
      </div>

      <h2 className="mt-6 text-sm font-semibold uppercase text-gray-500">Hoy ({hoy})</h2>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tarjeta
          etiqueta="Pacientes nuevos"
          valor={actividadHoy.pacientesNuevosTotal}
          sub={`General ${actividadHoy.pacientesNuevosGeneral} · Orto ${actividadHoy.pacientesNuevosOrtodoncia}`}
        />
        <Tarjeta etiqueta="Historiales marcados" valor={actividadHoy.historialesMarcados} sub="Odontología General" />
        <Tarjeta etiqueta="Consentimientos marcados" valor={actividadHoy.consentimientosMarcados} sub="Odontología General" />
        <Tarjeta
          etiqueta="Turnos atendidos"
          valor={actividadHoy.turnosAtendidosTotal}
          sub={`General ${actividadHoy.turnosAtendidosGeneral} · Orto ${actividadHoy.turnosAtendidosOrtodoncia}`}
        />
        <Tarjeta etiqueta="Cobrado hoy" valor={formatoPesos(actividadHoy.cobradoHoy)} sub={`${actividadHoy.cantidadCobrosHoy} cobros`} />
      </div>

      <h2 className="mt-6 text-sm font-semibold uppercase text-gray-500">
        Este mes ({NOMBRES_MES[resumenMes.mes - 1]} {resumenMes.anio})
      </h2>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Tarjeta etiqueta="Pacientes nuevos" valor={resumenMes.pacientesNuevosTotal} />
        <Tarjeta etiqueta="Historiales marcados" valor={resumenMes.historialesMarcados} />
        <Tarjeta etiqueta="Consentimientos marcados" valor={resumenMes.consentimientosMarcados} />
        <Tarjeta etiqueta="Ingresos del mes" valor={formatoPesos(resumenMes.balance.ingresosTotal)} />
        <Tarjeta etiqueta="Balance del mes" valor={formatoPesos(resumenMes.balance.balance)} />
      </div>

      <h2 className="mt-6 text-sm font-semibold uppercase text-gray-500">Últimos 6 meses</h2>
      <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-brand-brown text-white">
              <th className="px-3 py-2 text-left font-semibold">Mes</th>
              <th className="px-3 py-2 text-right font-semibold">Pacientes nuevos</th>
              <th className="px-3 py-2 text-right font-semibold">Historiales marcados</th>
              <th className="px-3 py-2 text-right font-semibold">Consentimientos marcados</th>
              <th className="px-3 py-2 text-right font-semibold">Ingresos</th>
              <th className="px-3 py-2 text-right font-semibold">Balance</th>
            </tr>
          </thead>
          <tbody>
            {tendencia.map((m) => (
              <tr key={`${m.anio}-${m.mes}`} className="border-t border-gray-100">
                <td className="px-3 py-2 font-medium text-gray-900">
                  {NOMBRES_MES[m.mes - 1]} {m.anio}
                </td>
                <td className="px-3 py-2 text-right text-gray-600">{m.pacientesNuevosTotal}</td>
                <td className="px-3 py-2 text-right text-gray-600">{m.historialesMarcados}</td>
                <td className="px-3 py-2 text-right text-gray-600">{m.consentimientosMarcados}</td>
                <td className="px-3 py-2 text-right text-gray-600">{formatoPesos(m.balance.ingresosTotal)}</td>
                <td className="px-3 py-2 text-right font-medium text-gray-900">{formatoPesos(m.balance.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-gray-400">
        Nota: por ahora "historiales marcados" y "consentimientos marcados" solo cuentan pacientes de Odontología
        General (son los que tienen el tildado ✅ desde la lista). Ortodoncia se puede sumar más adelante si hace
        falta.
      </p>
    </main>
  );
}

export default function EstadisticasPage() {
  return (
    <SoloDuena>
      <PaginaEstadisticas />
    </SoloDuena>
  );
}
