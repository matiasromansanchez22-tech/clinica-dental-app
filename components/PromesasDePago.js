"use client";

import { useEffect, useState } from "react";
import { obtenerPromesasDePago, quitarPromesaDePago } from "@/lib/data/prestacionesRealizadas";

function formatoFecha(fechaISO) {
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}

// Pacientes que marcaron algo en Agenda pero avisaron que lo pagan otro
// día (se manda acá con el botón "📅 Después" de la nube) — se muestra
// tanto en Cuentas por cobrar de General como en la de Ortodoncia, cada
// una filtrando lo suyo.
export default function PromesasDePago({ esOrtodoncia }) {
  const [promesas, setPromesas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [quitando, setQuitando] = useState(null);

  async function cargar() {
    setCargando(true);
    setError(null);
    try {
      const todas = await obtenerPromesasDePago();
      setPromesas(todas.filter((p) => p.esOrtodoncia === esOrtodoncia));
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function quitar(p) {
    if (!window.confirm(`¿Sacar la promesa de pago de ${p.nombre}? Vuelve a aparecer en la nube para cobrar hoy.`))
      return;
    setQuitando(p.clave);
    try {
      await quitarPromesaDePago({ pacienteId: p.pacienteId, esOrtodoncia: p.esOrtodoncia });
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setQuitando(null);
    }
  }

  if (!cargando && promesas.length === 0) return null;

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-gray-900">📅 Prometieron pagar otro día</h2>
      <p className="mt-1 text-sm text-gray-500">
        Se marcaron en Agenda pero todavía no se cobraron — el paciente avisó que paga en la fecha de al lado.
      </p>

      {error && (
        <div className="mt-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-brand-brown text-white">
              <th className="px-3 py-2 text-left font-semibold">Paciente</th>
              <th className="px-3 py-2 text-left font-semibold">Qué marcó</th>
              <th className="px-3 py-2 text-left font-semibold">Paga el</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-gray-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!cargando &&
              promesas.map((p) => (
                <tr key={p.clave} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-medium text-gray-900">{p.nombre}</td>
                  <td className="px-3 py-2 text-gray-600">{p.prestaciones.join(", ")}</td>
                  <td className="px-3 py-2 font-medium text-amber-700">{formatoFecha(p.fechaPromesa)}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <a
                        href={
                          p.esOrtodoncia
                            ? `/ortodoncia/caja?pacienteId=${p.pacienteId}&profesionalId=${p.profesionalId || ""}&abrir=1`
                            : `/caja?pacienteId=${p.pacienteId}&profesionalId=${p.profesionalId || ""}&abrir=1`
                        }
                        className="rounded-md bg-brand-brown px-2 py-1 text-xs font-medium text-white hover:bg-brand-brown-dark"
                      >
                        💰 Cobrar
                      </a>
                      <button
                        type="button"
                        onClick={() => quitar(p)}
                        disabled={quitando === p.clave}
                        className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                      >
                        {quitando === p.clave ? "..." : "Quitar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
