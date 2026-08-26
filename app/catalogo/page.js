"use client";

import { useEffect, useState } from "react";
import CatalogoFilaModal from "@/components/CatalogoFilaModal";
import NuevaPrestacionModal from "@/components/NuevaPrestacionModal";
import { obtenerCatalogo } from "@/lib/data/catalogo";

export default function CatalogoPage() {
  const [prestaciones, setPrestaciones] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [filaEnEdicion, setFilaEnEdicion] = useState(null);
  const [mostrarNueva, setMostrarNueva] = useState(false);

  async function recargar() {
    const data = await obtenerCatalogo(busqueda);
    setPrestaciones(data);
  }

  useEffect(() => {
    setCargando(true);
    obtenerCatalogo(busqueda)
      .then(setPrestaciones)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      recargar().catch((e) => setError(e.message));
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda]);

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Catálogo de Prestaciones</h1>
        <button
          onClick={() => setMostrarNueva(true)}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
        >
          + Nueva prestación
        </button>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Lista maestra de prestaciones de la clínica, con sus precios de Lista y Efectivo.
      </p>

      <input
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar prestación, ID o categoría..."
        className="mt-4 w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm"
      />

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="px-3 py-2 text-left font-semibold">ID</th>
              <th className="px-3 py-2 text-left font-semibold">Prestación</th>
              <th className="px-3 py-2 text-left font-semibold">Categoría</th>
              <th className="px-3 py-2 text-right font-semibold">Precio Lista</th>
              <th className="px-3 py-2 text-right font-semibold">Precio Efectivo</th>
              <th className="px-3 py-2 text-left font-semibold">Estado</th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-gray-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!cargando && prestaciones.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-gray-500">
                  No se encontraron prestaciones.
                </td>
              </tr>
            )}
            {prestaciones.map((p) => (
              <tr
                key={p.id}
                onClick={() => setFilaEnEdicion(p)}
                className="cursor-pointer border-t border-gray-100 hover:bg-gray-50"
              >
                <td className="px-3 py-2 text-gray-500">{p.id}</td>
                <td className="px-3 py-2 font-medium text-gray-900">{p.prestacion}</td>
                <td className="px-3 py-2 text-gray-600">{p.categoria || "—"}</td>
                <td className="px-3 py-2 text-right text-gray-600">
                  ${Number(p.valor_lista).toLocaleString("es-AR")}
                </td>
                <td className="px-3 py-2 text-right text-gray-600">
                  ${Number(p.valor_efectivo).toLocaleString("es-AR")}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.estado === "Activo" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {p.estado}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filaEnEdicion && (
        <CatalogoFilaModal
          prestacion={filaEnEdicion}
          onClose={() => setFilaEnEdicion(null)}
          onGuardado={async () => {
            await recargar();
            setFilaEnEdicion(null);
          }}
        />
      )}

      {mostrarNueva && (
        <NuevaPrestacionModal
          onClose={() => setMostrarNueva(false)}
          onGuardado={async () => {
            await recargar();
            setMostrarNueva(false);
          }}
        />
      )}
    </main>
  );
}
