"use client";

import { useEffect, useMemo, useState } from "react";
import {
  desvincularFichaDePago,
  obtenerFichasPendientesDeConciliar,
  obtenerFichasVinculadasAPago,
  vincularFichasAPago,
} from "@/lib/data/facturacionObrasSociales";

export default function ConciliarPagoAsorModal({ pago, onClose, onGuardado }) {
  const [pendientes, setPendientes] = useState([]);
  const [vinculadas, setVinculadas] = useState([]);
  const [seleccionadas, setSeleccionadas] = useState(new Set());
  const [filtroObraSocial, setFiltroObraSocial] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  async function cargar() {
    setCargando(true);
    try {
      const [p, v] = await Promise.all([obtenerFichasPendientesDeConciliar(), obtenerFichasVinculadasAPago(pago.id)]);
      setPendientes(p);
      setVinculadas(v);
      setSeleccionadas(new Set(v.map((f) => f.id)));
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

  const todasLasFichas = useMemo(() => {
    const mapa = new Map();
    [...vinculadas, ...pendientes].forEach((f) => mapa.set(f.id, f));
    return Array.from(mapa.values()).sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
  }, [vinculadas, pendientes]);

  const obrasSociales = useMemo(
    () => [...new Set(todasLasFichas.map((f) => f.obraSocial))].sort(),
    [todasLasFichas]
  );

  const fichasFiltradas = todasLasFichas.filter((f) => !filtroObraSocial || f.obraSocial === filtroObraSocial);

  function alternar(id) {
    setSeleccionadas((s) => {
      const nuevo = new Set(s);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  }

  const totalSeleccionado = todasLasFichas
    .filter((f) => seleccionadas.has(f.id))
    .reduce((acc, f) => acc + f.valorOS, 0);
  const diferencia = Number(pago.monto) - totalSeleccionado;
  const coincide = Math.abs(diferencia) < 1;

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const idsVinculadasAntes = new Set(vinculadas.map((f) => f.id));
      const aVincular = [...seleccionadas].filter((id) => !idsVinculadasAntes.has(id));
      const aDesvincular = [...idsVinculadasAntes].filter((id) => !seleccionadas.has(id));

      if (aVincular.length > 0) await vincularFichasAPago(aVincular, pago.id);
      for (const id of aDesvincular) await desvincularFichaDePago(id);

      onGuardado();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold text-brand-brown">
            Conciliar pago ASOR — {pago.fecha} — ${Number(pago.monto).toLocaleString("es-AR")}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            ✕
          </button>
        </div>
        <p className="mb-3 text-xs text-gray-500">
          Tildá las fichas que cubre esta transferencia. Al guardar, quedan marcadas "Liquidada".
        </p>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
        )}

        <div className="mb-3 flex items-center justify-between gap-2">
          <select
            value={filtroObraSocial}
            onChange={(e) => setFiltroObraSocial(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          >
            <option value="">Todas las obras sociales</option>
            {obrasSociales.map((os) => (
              <option key={os} value={os}>
                {os}
              </option>
            ))}
          </select>
          <div
            className={`rounded-md px-3 py-2 text-sm font-semibold ${coincide ? "bg-brand-mint/20 text-brand-green" : "bg-red-50 text-red-700"}`}
          >
            Seleccionado: ${totalSeleccionado.toLocaleString("es-AR")} — Transferido: $
            {Number(pago.monto).toLocaleString("es-AR")} —{" "}
            {coincide ? "✅ Coincide" : `Diferencia: $${diferencia.toLocaleString("es-AR")}`}
          </div>
        </div>

        {cargando ? (
          <p className="text-sm text-gray-500">Cargando fichas...</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-brand-brown text-white">
                  <th className="px-2 py-2"></th>
                  <th className="px-3 py-2 text-left font-semibold">Fecha</th>
                  <th className="px-3 py-2 text-left font-semibold">Paciente</th>
                  <th className="px-3 py-2 text-left font-semibold">Obra Social</th>
                  <th className="px-3 py-2 text-left font-semibold">Prestación</th>
                  <th className="px-3 py-2 text-right font-semibold">Valor OS</th>
                </tr>
              </thead>
              <tbody>
                {fichasFiltradas.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-gray-500">
                      No hay fichas pendientes de conciliar{filtroObraSocial ? ` para ${filtroObraSocial}` : ""}.
                    </td>
                  </tr>
                )}
                {fichasFiltradas.map((f) => (
                  <tr key={f.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-2 py-2">
                      <input type="checkbox" checked={seleccionadas.has(f.id)} onChange={() => alternar(f.id)} />
                    </td>
                    <td className="px-3 py-2 text-gray-600">{f.fecha}</td>
                    <td className="px-3 py-2 font-medium text-gray-900">{f.paciente}</td>
                    <td className="px-3 py-2 text-gray-600">{f.obraSocial}</td>
                    <td className="px-3 py-2 text-gray-600">{f.prestacion}</td>
                    <td className="px-3 py-2 text-right text-gray-600">${f.valorOS.toLocaleString("es-AR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cerrar
          </button>
          <button
            onClick={guardar}
            disabled={guardando}
            className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
          >
            {guardando ? "Guardando..." : "Guardar conciliación"}
          </button>
        </div>
      </div>
    </div>
  );
}
