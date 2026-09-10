"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import SoloDuenaYCM from "@/components/SoloDuenaYCM";
import {
  CATEGORIAS_MARCA,
  eliminarDeBiblioteca,
  obtenerBibliotecaMarca,
  obtenerUrlBiblioteca,
  subirABiblioteca,
} from "@/lib/data/bibliotecaMarca";

const COLORES_MARCA = [
  { nombre: "Marrón", variable: "--color-brand-brown", hex: "#6d3c1b" },
  { nombre: "Marrón oscuro", variable: "--color-brand-brown-dark", hex: "#522c14" },
  { nombre: "Tostado", variable: "--color-brand-tan", hex: "#edcfaa" },
  { nombre: "Crema", variable: "--color-brand-cream", hex: "#fffbf5" },
  { nombre: "Menta", variable: "--color-brand-mint", hex: "#87dec2" },
  { nombre: "Verde", variable: "--color-brand-green", hex: "#2d5447" },
  { nombre: "Carbón", variable: "--color-brand-charcoal", hex: "#2c282d" },
];

function Swatch({ color }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(color.hex);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      // si el navegador no deja copiar, no pasa nada grave
    }
  }

  return (
    <button
      type="button"
      onClick={copiar}
      className="flex flex-col items-center gap-1 rounded-md border border-gray-200 p-2 text-center hover:border-brand-brown"
    >
      <div className="h-12 w-12 rounded-md border border-gray-200" style={{ backgroundColor: color.hex }} />
      <span className="text-xs font-medium text-gray-700">{color.nombre}</span>
      <span className="text-[11px] text-gray-400">{copiado ? "¡Copiado!" : color.hex}</span>
    </button>
  );
}

function BibliotecaContenido() {
  const { perfil } = useAuth();
  const esDuena = perfil?.rol === "Duena";

  const [items, setItems] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [archivo, setArchivo] = useState(null);
  const [categoria, setCategoria] = useState(CATEGORIAS_MARCA[0]);
  const [subiendo, setSubiendo] = useState(false);

  function recargar() {
    setCargando(true);
    obtenerBibliotecaMarca()
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }

  useEffect(() => {
    recargar();
  }, []);

  async function subir() {
    if (!archivo) {
      setError("Elegí un archivo primero.");
      return;
    }
    setSubiendo(true);
    setError(null);
    try {
      await subirABiblioteca(archivo, categoria);
      setArchivo(null);
      recargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setSubiendo(false);
    }
  }

  async function abrir(item) {
    try {
      const url = await obtenerUrlBiblioteca(item.storagePath);
      window.open(url, "_blank");
    } catch (e) {
      setError(e.message);
    }
  }

  async function borrar(item) {
    if (!window.confirm(`¿Borrar "${item.nombreArchivo}"?`)) return;
    try {
      await eliminarDeBiblioteca(item.id, item.storagePath);
      recargar();
    } catch (e) {
      setError(e.message);
    }
  }

  const itemsPorCategoria = CATEGORIAS_MARCA.map((cat) => ({
    categoria: cat,
    items: items.filter((i) => i.categoria === cat),
  }));

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">🎨 Biblioteca de marca</h1>
      <p className="mt-1 text-sm text-gray-500">
        Colores, logo y plantillas de la clínica, todo en un solo lugar para armar contenido sin tener que pedirlo
        cada vez.
      </p>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      <h2 className="mt-6 mb-2 text-sm font-semibold uppercase text-gray-500">Colores de la marca</h2>
      <p className="mb-2 text-xs text-gray-400">Tocá un color para copiar su código.</p>
      <div className="flex flex-wrap gap-2">
        {COLORES_MARCA.map((c) => (
          <Swatch key={c.variable} color={c} />
        ))}
      </div>

      {esDuena && (
        <div className="mt-6 rounded-lg border border-gray-200 p-4">
          <p className="mb-3 text-sm font-semibold text-gray-700">Subir archivo</p>
          <div className="flex flex-wrap items-end gap-2">
            <input
              type="file"
              onChange={(e) => setArchivo(e.target.files?.[0] || null)}
              className="flex-1 text-xs text-gray-600 file:mr-2 file:rounded-md file:border-0 file:bg-brand-tan/30 file:px-2 file:py-1.5 file:text-xs file:font-medium file:text-brand-brown"
            />
            <select
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            >
              {CATEGORIAS_MARCA.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={subir}
              disabled={subiendo}
              className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
            >
              {subiendo ? "Subiendo..." : "Subir"}
            </button>
          </div>
        </div>
      )}

      {cargando && <p className="mt-6 text-sm text-gray-500">Cargando...</p>}

      {!cargando &&
        itemsPorCategoria.map(
          (grupo) =>
            grupo.items.length > 0 && (
              <div key={grupo.categoria} className="mt-6">
                <h2 className="mb-2 text-sm font-semibold uppercase text-gray-500">{grupo.categoria}</h2>
                <div className="flex flex-col gap-2">
                  {grupo.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2 text-sm"
                    >
                      <button type="button" onClick={() => abrir(item)} className="text-left text-brand-brown hover:underline">
                        📎 {item.nombreArchivo}
                      </button>
                      {esDuena && (
                        <button type="button" onClick={() => borrar(item)} className="text-xs text-red-600 hover:underline">
                          Borrar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
        )}

      {!cargando && items.length === 0 && (
        <p className="mt-6 text-sm text-gray-500">
          Todavía no hay archivos subidos{esDuena ? " — usá el formulario de arriba." : "."}
        </p>
      )}
    </main>
  );
}

export default function BibliotecaMarcaPage() {
  return (
    <SoloDuenaYCM>
      <BibliotecaContenido />
    </SoloDuenaYCM>
  );
}
