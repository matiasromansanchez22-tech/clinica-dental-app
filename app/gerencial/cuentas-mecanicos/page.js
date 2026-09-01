"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import SoloDuena from "@/components/SoloDuena";
import { fechaDeHoyISO } from "@/lib/agenda";
import { obtenerFechasEnvioPorTrabajo, obtenerTrabajosLaboratorio } from "@/lib/data/laboratorio";

function primerYUltimoDiaDelMes(fechaISO) {
  const [anio, mes] = fechaISO.split("-").map(Number);
  const primero = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const ultimoDia = new Date(anio, mes, 0).getDate();
  const ultimo = `${anio}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
  return { primero, ultimo };
}

function CuentasMecanicosContenido() {
  const hoy = fechaDeHoyISO();
  const { primero, ultimo } = primerYUltimoDiaDelMes(hoy);
  const [fechaInicio, setFechaInicio] = useState(primero);
  const [fechaFin, setFechaFin] = useState(ultimo);
  const [trabajos, setTrabajos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [expandido, setExpandido] = useState(null);

  useEffect(() => {
    setCargando(true);
    Promise.all([obtenerTrabajosLaboratorio(), obtenerFechasEnvioPorTrabajo()])
      .then(([lista, fechasEnvio]) => {
        // Solo entran acá los trabajos que ya se marcaron como enviados —
        // mientras están "Pendiente de envío" no hay nada que cotejar
        // todavía contra ninguna factura.
        setTrabajos(
          lista
            .filter((t) => fechasEnvio[t.id])
            .map((t) => ({ ...t, fechaEnvio: fechasEnvio[t.id] }))
        );
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  function irAEsteMes() {
    setFechaInicio(primero);
    setFechaFin(ultimo);
  }

  const trabajosDelPeriodo = useMemo(
    () => trabajos.filter((t) => t.fechaEnvio >= fechaInicio && t.fechaEnvio <= fechaFin),
    [trabajos, fechaInicio, fechaFin]
  );

  const porLaboratorio = useMemo(() => {
    const mapa = {};
    for (const t of trabajosDelPeriodo) {
      const nombre = t.laboratorio || "Sin asignar";
      if (!mapa[nombre]) mapa[nombre] = { nombre, total: 0, cantidadSinValor: 0, trabajos: [] };
      mapa[nombre].trabajos.push(t);
      if (t.valor) mapa[nombre].total += Number(t.valor);
      else mapa[nombre].cantidadSinValor += 1;
    }
    return Object.values(mapa).sort((a, b) => b.total - a.total);
  }, [trabajosDelPeriodo]);

  const totalGeneral = porLaboratorio.reduce((acc, l) => acc + l.total, 0);
  const totalSinValor = porLaboratorio.reduce((acc, l) => acc + l.cantidadSinValor, 0);

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">Cuentas por mecánico</h1>
      <p className="mt-1 text-sm text-gray-500">
        Qué se le envió a cada mecánico en el período y cuánto suma, para cotejarlo contra lo que factura.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button onClick={irAEsteMes} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
          Este mes
        </button>
        <input
          type="date"
          value={fechaInicio}
          onChange={(e) => setFechaInicio(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
        <span className="text-sm text-gray-500">a</span>
        <input
          type="date"
          value={fechaFin}
          onChange={(e) => setFechaFin(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-3">
        <div className="rounded-md border border-gray-200 px-3 py-2 text-sm">
          <span className="text-gray-500">Trabajos enviados: </span>
          <span className="font-semibold text-gray-900">{trabajosDelPeriodo.length}</span>
        </div>
        <div className="rounded-md bg-brand-brown px-3 py-2 text-sm text-white">
          Total del período: <span className="font-semibold">${totalGeneral.toLocaleString("es-AR")}</span>
        </div>
        {totalSinValor > 0 && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            ⚠️ {totalSinValor} trabajo{totalSinValor === 1 ? "" : "s"} sin valor cargado (no {totalSinValor === 1 ? "está" : "están"}{" "}
            en el total)
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-brand-brown text-white">
              <th className="px-3 py-2 text-left font-semibold">Mecánico</th>
              <th className="px-2 py-2 text-center font-semibold">Trabajos</th>
              <th className="px-3 py-2 text-right font-semibold">Total a pagar</th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-center text-gray-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!cargando && porLaboratorio.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-4 text-center text-gray-500">
                  No hay trabajos enviados en este período.
                </td>
              </tr>
            )}
            {porLaboratorio.map((l) => (
              <Fragment key={l.nombre}>
                <tr
                  onClick={() => setExpandido((e) => (e === l.nombre ? null : l.nombre))}
                  className="cursor-pointer border-t border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-3 py-2 font-medium text-gray-900">
                    {expandido === l.nombre ? "▾" : "▸"} {l.nombre}
                  </td>
                  <td className="px-2 py-2 text-center text-gray-600">
                    {l.trabajos.length}
                    {l.cantidadSinValor > 0 && (
                      <span className="ml-1 text-xs text-amber-600" title="Trabajos sin valor cargado">
                        ({l.cantidadSinValor} sin valor)
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold text-emerald-700">
                    ${l.total.toLocaleString("es-AR")}
                  </td>
                </tr>
                {expandido === l.nombre && (
                  <tr className="bg-gray-50">
                    <td colSpan={3} className="px-3 py-2">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-gray-500">
                            <th className="px-2 py-1 text-left font-medium">Fecha de envío</th>
                            <th className="px-2 py-1 text-left font-medium">Paciente</th>
                            <th className="px-2 py-1 text-left font-medium">Trabajo</th>
                            <th className="px-2 py-1 text-left font-medium">Estado</th>
                            <th className="px-2 py-1 text-right font-medium">Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {l.trabajos
                            .sort((a, b) => (a.fechaEnvio < b.fechaEnvio ? 1 : -1))
                            .map((t) => (
                              <tr key={t.id} className="border-t border-gray-200">
                                <td className="px-2 py-1">{t.fechaEnvio}</td>
                                <td className="px-2 py-1">{t.pacienteNombre}</td>
                                <td className="px-2 py-1">
                                  {t.tipoTrabajo}
                                  {t.pieza ? ` (${t.pieza})` : ""}
                                </td>
                                <td className="px-2 py-1 text-gray-500">{t.estado}</td>
                                <td className="px-2 py-1 text-right">
                                  {t.valor ? (
                                    `$${Number(t.valor).toLocaleString("es-AR")}`
                                  ) : (
                                    <span className="text-amber-600">sin valor</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-gray-500">
        El valor de cada trabajo se carga al mandarlo al mecánico (o después, desde el detalle del trabajo en
        Laboratorio/Prótesis). Si un trabajo no tiene valor cargado, no suma al total — se marca aparte para que no
        se pierda de vista.
      </p>
    </main>
  );
}

export default function CuentasMecanicosPage() {
  return (
    <SoloDuena>
      <CuentasMecanicosContenido />
    </SoloDuena>
  );
}
