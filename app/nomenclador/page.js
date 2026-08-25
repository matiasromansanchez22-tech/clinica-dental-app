"use client";

import { useEffect, useState } from "react";
import ConfiguracionCopagoModal from "@/components/ConfiguracionCopagoModal";
import NomencladorFilaModal from "@/components/NomencladorFilaModal";
import { calcularCopagoSugerido } from "@/lib/copago";
import {
  obtenerEscalasCopago,
  obtenerExcepcionesCopago,
  obtenerNomencladorPorObraSocial,
  obtenerObrasSociales,
} from "@/lib/data/nomenclador";

export default function NomencladorPage() {
  const [obrasSociales, setObrasSociales] = useState([]);
  const [obraSocial, setObraSocial] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filas, setFilas] = useState([]);
  const [escalas, setEscalas] = useState([]);
  const [excepciones, setExcepciones] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [filaEnEdicion, setFilaEnEdicion] = useState(null);
  const [mostrarConfig, setMostrarConfig] = useState(false);

  async function recargarConfig() {
    const [e, x] = await Promise.all([obtenerEscalasCopago(), obtenerExcepcionesCopago()]);
    setEscalas(e);
    setExcepciones(x);
  }

  useEffect(() => {
    Promise.all([obtenerObrasSociales(), obtenerEscalasCopago(), obtenerExcepcionesCopago()])
      .then(([os, e, x]) => {
        setObrasSociales(os);
        setEscalas(e);
        setExcepciones(x);
      })
      .catch((e) => setError(e.message));
  }, []);

  async function buscar() {
    if (!obraSocial) {
      setFilas([]);
      return;
    }
    setCargando(true);
    setError(null);
    try {
      const data = await obtenerNomencladorPorObraSocial(obraSocial, busqueda);
      setFilas(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    const timeout = setTimeout(buscar, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [obraSocial, busqueda]);

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Nomenclador</h1>
        <button
          onClick={() => setMostrarConfig(true)}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          ⚙ Configurar escala de copago
        </button>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Elegí una obra social para ver qué le reconoce a cada prestación y cuánto le corresponde pagar al paciente.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <select
          value={obraSocial}
          onChange={(e) => setObraSocial(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">Elegí una obra social...</option>
          {obrasSociales.map((os) => (
            <option key={os.id} value={os.nombre}>
              {os.nombre}
            </option>
          ))}
        </select>
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar prestación o código..."
          disabled={!obraSocial}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-50"
        />
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      {!obraSocial && (
        <p className="mt-6 text-sm text-gray-500">Elegí una obra social arriba para ver sus prestaciones.</p>
      )}

      {obraSocial && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className="px-3 py-2 text-left font-semibold">Código</th>
                <th className="px-3 py-2 text-left font-semibold">Prestación (obra social)</th>
                <th className="px-3 py-2 text-left font-semibold">Prestación interna</th>
                <th className="px-3 py-2 text-right font-semibold">Valor OS</th>
                <th className="px-3 py-2 text-right font-semibold">Copago</th>
              </tr>
            </thead>
            <tbody>
              {cargando && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-gray-500">
                    Cargando...
                  </td>
                </tr>
              )}
              {!cargando && filas.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-gray-500">
                    No se encontraron prestaciones.
                  </td>
                </tr>
              )}
              {filas.map((f) => {
                const sugerido = calcularCopagoSugerido(Number(f.valor_os), f.obra_social, escalas, excepciones);
                const difiere = Math.abs(sugerido.copago - Number(f.copago_oficial)) > 1;
                return (
                  <tr
                    key={f.id}
                    onClick={() => setFilaEnEdicion(f)}
                    className="cursor-pointer border-t border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-3 py-2 text-gray-600">{f.codigo || "—"}</td>
                    <td className="px-3 py-2 text-gray-900">{f.prestacion_os}</td>
                    <td className="px-3 py-2 text-gray-600">{f.prestacion_interna || "—"}</td>
                    <td className="px-3 py-2 text-right text-gray-600">
                      ${Number(f.valor_os).toLocaleString("es-AR")}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={difiere ? "font-medium text-amber-600" : "text-gray-600"}>
                        ${Number(f.copago_oficial).toLocaleString("es-AR")}
                      </span>
                      {difiere && <span title="No coincide con la escala configurada"> ⚠</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {filaEnEdicion && (
        <NomencladorFilaModal
          fila={filaEnEdicion}
          escalas={escalas}
          excepciones={excepciones}
          onClose={() => setFilaEnEdicion(null)}
          onGuardado={async () => {
            await buscar();
            setFilaEnEdicion(null);
          }}
        />
      )}

      {mostrarConfig && (
        <ConfiguracionCopagoModal
          escalas={escalas}
          excepciones={excepciones}
          onClose={() => setMostrarConfig(false)}
          onCambiado={recargarConfig}
        />
      )}
    </main>
  );
}
