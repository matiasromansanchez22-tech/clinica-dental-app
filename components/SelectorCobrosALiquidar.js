"use client";

import { useEffect, useMemo, useState } from "react";
import { obtenerCobrosPendientesDeLiquidar } from "@/lib/data/cobrosLiquidados";

function formatoFecha(fechaISO) {
  const [, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}`;
}

function formatoPesos(n) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

function FilaCobro({ cobro, tildado, onAlternar, sangria }) {
  return (
    <label className={`flex cursor-pointer items-start gap-2 py-1.5 pr-2 text-xs hover:bg-brand-tan/20 ${sangria ? "pl-7" : "pl-2"}`}>
      <input type="checkbox" checked={tildado} onChange={onAlternar} className="mt-0.5 shrink-0" />
      <span className="min-w-0 flex-1">
        {!sangria && <span className="font-medium text-gray-900">{cobro.paciente}</span>}
        <span className={`block truncate ${sangria ? "text-gray-700" : "text-gray-500"}`}>{cobro.detalle}</span>
      </span>
      <span className="shrink-0 text-right text-gray-700">
        <span className="block font-medium tabular-nums">{formatoPesos(cobro.monto)}</span>
        <span className="block text-[10px] text-gray-400">
          {formatoFecha(cobro.fecha)} · {cobro.cobertura}
        </span>
      </span>
    </label>
  );
}

// Lista de los cobros recientes del profesional que todavía no se le liquidaron, agrupados
// por paciente, para tildar cuáles cubre este pago (un paciente completo con su casilla, o
// cobro por cobro). Es opcional: si no se tilda nada, el pago se registra igual (solo como
// monto a favor del profesional, como siempre). Además se puede indicar que con este pago
// se saldó todo el tratamiento de los pacientes elegidos.
//   seleccion: [{ clave, tipo, id }]   onChange(nuevaSeleccion)
//   tratamientoSaldado / onTratamientoSaldadoChange: la casilla "se saldó todo el tratamiento"
export default function SelectorCobrosALiquidar({ profesionalId, seleccion, onChange, tratamientoSaldado, onTratamientoSaldadoChange }) {
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

  const cargando = cargado.profesionalId !== profesionalId;
  const cobros = useMemo(() => (cargando ? [] : cargado.cobros), [cargando, cargado.cobros]);
  const error = cargando ? null : cargado.error;

  const claves = new Set(seleccion.map((s) => s.clave));
  const texto = busqueda.trim().toLowerCase();

  // Un grupo por paciente (la lista ya viene de más nuevo a más viejo, así que los grupos
  // quedan ordenados por su cobro más reciente).
  const grupos = useMemo(() => {
    const visibles = texto ? cobros.filter((c) => `${c.paciente} ${c.detalle}`.toLowerCase().includes(texto)) : cobros;
    const mapa = new Map();
    for (const c of visibles) {
      if (!mapa.has(c.paciente)) mapa.set(c.paciente, []);
      mapa.get(c.paciente).push(c);
    }
    return [...mapa.entries()].map(([paciente, lista]) => ({ paciente, cobros: lista }));
  }, [cobros, texto]);

  if (!profesionalId) return null;

  const totalSeleccionado = cobros.filter((c) => claves.has(c.clave)).reduce((a, c) => a + c.monto, 0);
  const pacientesElegidos = new Set(cobros.filter((c) => claves.has(c.clave)).map((c) => c.paciente)).size;

  function alternarCobro(c) {
    if (claves.has(c.clave)) onChange(seleccion.filter((s) => s.clave !== c.clave));
    else onChange([...seleccion, { clave: c.clave, tipo: c.tipo, id: c.id }]);
  }

  // Tilda (o destilda) todos los cobros pendientes de un paciente de una vez.
  function alternarPaciente(grupo) {
    const todosTildados = grupo.cobros.every((c) => claves.has(c.clave));
    if (todosTildados) {
      const aSacar = new Set(grupo.cobros.map((c) => c.clave));
      onChange(seleccion.filter((s) => !aSacar.has(s.clave)));
    } else {
      const nuevos = grupo.cobros.filter((c) => !claves.has(c.clave)).map((c) => ({ clave: c.clave, tipo: c.tipo, id: c.id }));
      onChange([...seleccion, ...nuevos]);
    }
  }

  return (
    <div className="col-span-2 rounded-md border border-gray-200 bg-gray-50 p-2">
      <button type="button" onClick={() => setAbierto((a) => !a)} className="flex w-full items-center justify-between gap-2 text-left">
        <span className="text-xs font-semibold text-gray-700">
          {abierto ? "▾" : "▸"} ¿Qué pacientes cubre este pago? <span className="font-normal text-gray-400">(opcional)</span>
        </span>
        {seleccion.length > 0 && (
          <span className="text-[11px] font-medium text-brand-brown">
            {pacientesElegidos} paciente{pacientesElegidos === 1 ? "" : "s"} · cobrado {formatoPesos(totalSeleccionado)}
          </span>
        )}
      </button>

      {seleccion.length > 0 && onTratamientoSaldadoChange && (
        <label className="mt-1.5 flex cursor-pointer items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1.5 text-xs text-emerald-900">
          <input
            type="checkbox"
            checked={Boolean(tratamientoSaldado)}
            onChange={(e) => onTratamientoSaldadoChange(e.target.checked)}
            className="mt-0.5 shrink-0"
          />
          <span>
            <strong>Con este pago se saldó todo el tratamiento.</strong> El paciente pagó todo y a la profesional se le pagó el
            total: queda como <strong>Tratamiento saldado ✓</strong>.
          </span>
        </label>
      )}

      {abierto && (
        <>
          <p className="mt-1.5 text-[11px] text-gray-500">
            Cobros de los últimos 60 días que todavía no se le liquidaron. Tildá al paciente para marcar todos sus cobros, o elegí
            uno por uno.
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
          {grupos.length > 0 && (
            <ul className="mt-1.5 max-h-44 overflow-y-auto rounded-md border border-gray-200 bg-white">
              {grupos.map((g) => {
                if (g.cobros.length === 1) {
                  const c = g.cobros[0];
                  return (
                    <li key={g.paciente} className="border-b border-gray-100 last:border-b-0">
                      <FilaCobro cobro={c} tildado={claves.has(c.clave)} onAlternar={() => alternarCobro(c)} />
                    </li>
                  );
                }
                const tildados = g.cobros.filter((c) => claves.has(c.clave)).length;
                const totalGrupo = g.cobros.reduce((a, c) => a + c.monto, 0);
                return (
                  <li key={g.paciente} className="border-b border-gray-100 last:border-b-0">
                    <label className="flex cursor-pointer items-center gap-2 bg-gray-50 px-2 py-1.5 text-xs hover:bg-brand-tan/20">
                      <input
                        type="checkbox"
                        checked={tildados === g.cobros.length}
                        ref={(el) => {
                          if (el) el.indeterminate = tildados > 0 && tildados < g.cobros.length;
                        }}
                        onChange={() => alternarPaciente(g)}
                        className="shrink-0"
                      />
                      <span className="min-w-0 flex-1 font-medium text-gray-900">
                        {g.paciente} <span className="font-normal text-gray-400">· {g.cobros.length} cobros</span>
                      </span>
                      <span className="shrink-0 font-medium tabular-nums text-gray-700">{formatoPesos(totalGrupo)}</span>
                    </label>
                    {g.cobros.map((c) => (
                      <FilaCobro key={c.clave} cobro={c} sangria tildado={claves.has(c.clave)} onAlternar={() => alternarCobro(c)} />
                    ))}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
