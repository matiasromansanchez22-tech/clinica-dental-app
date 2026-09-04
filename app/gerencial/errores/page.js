"use client";

import { useEffect, useState } from "react";
import SoloDuena from "@/components/SoloDuena";
import { eliminarError, obtenerErroresApp, registrarError } from "@/lib/data/erroresApp";

function formatoFechaHora(iso) {
  const fecha = new Date(iso);
  return fecha.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

function ErroresContenido() {
  const [errores, setErrores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [expandido, setExpandido] = useState(null);

  async function recargar() {
    setCargando(true);
    setError(null);
    try {
      setErrores(await obtenerErroresApp());
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    recargar();
  }, []);

  async function borrar(e, item) {
    e.stopPropagation();
    try {
      await eliminarError(item.id);
      setErrores((es) => es.filter((x) => x.id !== item.id));
    } catch (err) {
      setError(err.message);
    }
  }

  async function probar() {
    await registrarError({ mensaje: "Error de prueba", contexto: "prueba manual", url: window.location.href });
    await recargar();
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-900">🚨 Errores</h1>
        <button
          onClick={probar}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          🧪 Generar error de prueba
        </button>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Se guardan solos cuando algo falla en la app, sin que nadie tenga que avisar. Los últimos 200.
      </p>

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      {cargando && <p className="mt-6 text-sm text-gray-500">Cargando...</p>}

      {!cargando && errores.length === 0 && (
        <p className="mt-6 text-sm text-gray-500">Sin errores registrados. 🎉</p>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {errores.map((e) => (
          <div
            key={e.id}
            onClick={() => setExpandido(expandido === e.id ? null : e.id)}
            className="cursor-pointer rounded-lg border border-red-200 bg-red-50 px-4 py-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-red-800">{e.mensaje || "(sin mensaje)"}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {formatoFechaHora(e.creadoEn)} · {e.nombreUsuario || "—"} · {e.contexto || "?"}
                </p>
              </div>
              <button onClick={(ev) => borrar(ev, e)} className="shrink-0 text-xs text-red-600 hover:underline">
                Borrar
              </button>
            </div>
            {expandido === e.id && (
              <div className="mt-2 space-y-1 border-t border-red-200 pt-2 text-xs text-gray-600">
                {e.url && <p className="break-all">📍 {e.url}</p>}
                {e.stack && <pre className="mt-1 overflow-x-auto whitespace-pre-wrap text-[11px] text-gray-500">{e.stack}</pre>}
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}

export default function ErroresPage() {
  return (
    <SoloDuena>
      <ErroresContenido />
    </SoloDuena>
  );
}
