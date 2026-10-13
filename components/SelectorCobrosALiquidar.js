"use client";

import { useEffect, useState } from "react";
import { obtenerCobrosPendientesDeLiquidar } from "@/lib/data/cobrosLiquidados";

function formatoFecha(fechaISO) {
  const [, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}`;
}

function formatoPesos(n) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

// Lista de los cobros recientes del profesional que todavía no se le liquidaron, para
// tildar cuáles cubre este pago. Es opcional: si no se tilda nada, el pago se registra
// igual (solo como monto a favor del profesional, como siempre).
//   seleccion: [{ clave, tipo, id }]   onChange(nuevaSeleccion)
export default function SelectorCobrosALiquidar({ profesionalId, seleccion, onChange }) {
  // Se guarda para qué profesional se cargó la lista: mientras no coincida con el elegido
  // ahora, se muestra "Cargando..." (así no aparece la lista de otro profesional).
  const [cargado, setCargado] = useState({ profesionalId: null, cobros: [], error: null });
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!profesionalId) return;
    let activo = true;
    obtenerCobrosPendientesDeLiquidar(profesionalId)
      .then((cobros) => activo && setCargado({ profesionalId, cobros, error: null }))
      .catch((e) => activo && setCargado({ profesionalId, cobros: [], error: e.message }));
    return () => {
      activo = false;
    };
  }, [profesionalId]);

  if (!profesionalId) return null;

  const cargando = cargado.profesionalId !== profesionalId;
  const cobros = cargando ? [] : cargado.cobros;
  const error = cargando ? null : cargado.error;

  const claves = new Set(seleccion.map((s) => s.clave));
  const texto = busqueda.trim().toLowerCase();
  const visibles = texto ? cobros.filter((c) => `${c.paciente} ${c.detalle}`.toLowerCase().includes(texto)) : cobros;
  const totalSeleccionado = cobros.filter((c) => claves.has(c.clave)).reduce((a, c) => a + c.monto, 0);

  function alternar(c) {
    if (claves.has(c.clave)) onChange(seleccion.filter((s) => s.clave !== c.clave));
    else onChange([...seleccion, { clave: c.clave, tipo: c.tipo, id: c.id }]);
  }

  return (
    <div className="col-span-2 rounded-md border border-gray-200 bg-gray-50 p-2">
      <button type="button" onClick={() => setAbierto((a) => !a)} className="flex w-full items-center justify-between gap-2 text-left">
        <span className="text-xs font-semibold text-gray-700">
          {abierto ? "▾" : "▸"} ¿Qué pacientes cubre este pago? <span className="font-normal text-gray-400">(opcional)</span>
        </span>
        {seleccion.length > 0 && (
          <span className="text-[11px] font-medium text-brand-brown">
            {seleccion.length} elegido{seleccion.length === 1 ? "" : "s"} · cobrado {formatoPesos(totalSeleccionado)}
          </span>
        )}
      </button>
      {abierto && (
        <>
      <p className="mt-0.5 text-[11px] text-gray-500">
        Cobros de los últimos 60 días que todavía no se le liquidaron. Los que tildes quedan como <strong>Liquidado ✓</strong>.
      </p>
      {cobros.length > 6 && (
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar paciente o prestación..."
          className="mt-1.5 w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
        />
      )}
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
      {cargando && <p className="mt-1 text-xs text-gray-500">Cargando cobros...</p>}
      {!cargando && !error && cobros.length === 0 && (
        <p className="mt-1 text-xs text-gray-500">No hay cobros pendientes de liquidar de este profesional.</p>
      )}
      {visibles.length > 0 && (
        <ul className="mt-1.5 max-h-44 overflow-y-auto rounded-md border border-gray-200 bg-white">
          {visibles.map((c) => (
            <li key={c.clave} className="border-b border-gray-100 last:border-b-0">
              <label className="flex cursor-pointer items-start gap-2 px-2 py-1.5 text-xs hover:bg-brand-tan/20">
                <input type="checkbox" checked={claves.has(c.clave)} onChange={() => alternar(c)} className="mt-0.5 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="font-medium text-gray-900">{c.paciente}</span>
                  <span className="block truncate text-gray-500">{c.detalle}</span>
                </span>
                <span className="shrink-0 text-right text-gray-700">
                  <span className="block font-medium tabular-nums">{formatoPesos(c.monto)}</span>
                  <span className="block text-[10px] text-gray-400">
                    {formatoFecha(c.fecha)} · {c.cobertura}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
        </>
      )}
    </div>
  );
}
