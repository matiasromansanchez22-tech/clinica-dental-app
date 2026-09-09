"use client";

import { useState } from "react";
import { leerComprobanteConIA } from "@/lib/data/comprobantes";

// Selector de archivo + botón "Leer con IA": el padre recibe el archivo
// elegido (para subirlo recién al guardar de verdad) y lo que la IA pudo
// sugerir, y decide qué hacer con eso — acá no se carga nada solo.
// `leerFn` permite reusar este mismo selector con otras lecturas con IA
// (ej. facturas de proveedores) en vez de duplicar el componente.
export default function LeerComprobanteIA({
  categoriasDisponibles = [],
  onArchivoElegido,
  onLeido,
  leerFn = leerComprobanteConIA,
  titulo = "📷 Comprobante o factura (opcional)",
}) {
  const [archivo, setArchivo] = useState(null);
  const [leyendo, setLeyendo] = useState(false);
  const [error, setError] = useState(null);
  const [leido, setLeido] = useState(false);

  function elegirArchivo(e) {
    const f = e.target.files?.[0] || null;
    setArchivo(f);
    setLeido(false);
    setError(null);
    onArchivoElegido?.(f);
  }

  async function leer() {
    if (!archivo) return;
    setLeyendo(true);
    setError(null);
    try {
      const sugerencia = await leerFn(archivo, categoriasDisponibles);
      setLeido(true);
      onLeido?.(sugerencia);
    } catch (err) {
      setError(err.message);
    } finally {
      setLeyendo(false);
    }
  }

  return (
    <div className="rounded-md border border-dashed border-brand-tan bg-brand-tan/10 p-3">
      <p className="mb-2 text-xs font-semibold uppercase text-brand-brown">{titulo}</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={elegirArchivo}
          className="flex-1 text-xs text-gray-600 file:mr-2 file:rounded-md file:border-0 file:bg-white file:px-2 file:py-1.5 file:text-xs file:font-medium file:text-brand-brown"
        />
        <button
          type="button"
          onClick={leer}
          disabled={!archivo || leyendo}
          className="whitespace-nowrap rounded-md bg-brand-brown px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
        >
          {leyendo ? "Leyendo..." : "🔍 Leer con IA"}
        </button>
      </div>
      {leido && !error && (
        <p className="mt-2 text-xs text-emerald-700">
          ✓ Listo — revisá los datos de abajo, la IA a veces se equivoca. Se guarda igual aunque no leas nada.
        </p>
      )}
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
