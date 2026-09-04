"use client";

import { useEffect, useMemo, useState } from "react";
import RegistroHorarioFormModal from "@/components/RegistroHorarioFormModal";
import SoloDuena from "@/components/SoloDuena";
import { fechaDeHoyISO } from "@/lib/agenda";
import {
  actualizarValorHora,
  eliminarRegistro,
  formatoHoras,
  horasTrabajadas,
  obtenerPersonalConHorario,
  obtenerTodosLosRegistros,
} from "@/lib/data/horarios";

function primerYUltimoDiaDelMes(fechaISO) {
  const [anio, mes] = fechaISO.split("-").map(Number);
  const primero = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const ultimoDia = new Date(anio, mes, 0).getDate();
  const ultimo = `${anio}-${String(mes).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
  return { primero, ultimo };
}

function formatoFecha(fechaISO) {
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}

function formatoPesos(n) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

function FilaPersona({ persona, registros, onCambiarValorHora, onEditar, onNuevo, onBorrar }) {
  const [abierto, setAbierto] = useState(false);
  const [valorHoraLocal, setValorHoraLocal] = useState(persona.valorHora ?? "");

  const totalHoras = registros.reduce((acc, r) => acc + (horasTrabajadas(r) || 0), 0);
  const totalPagar = persona.valorHora ? totalHoras * persona.valorHora : null;

  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
      <button
        onClick={() => setAbierto((a) => !a)}
        className="flex w-full flex-wrap items-center justify-between gap-2 bg-gray-50 px-4 py-2.5 text-left hover:bg-gray-100"
      >
        <span className="font-semibold text-gray-800">
          {abierto ? "▾" : "▸"} {persona.nombre} <span className="text-xs font-normal text-gray-400">({persona.rol})</span>
        </span>
        <span className="flex items-center gap-3 text-sm">
          <span className="text-gray-600">{formatoHoras(totalHoras)}</span>
          {totalPagar !== null && <span className="font-semibold text-brand-brown">{formatoPesos(totalPagar)}</span>}
        </span>
      </button>
      {abierto && (
        <div className="p-3">
          <div className="mb-3 flex items-center gap-2 text-sm">
            <label className="flex items-center gap-1.5 text-xs text-gray-600">
              $/hora:
              <input
                type="number"
                min={0}
                value={valorHoraLocal}
                onChange={(e) => setValorHoraLocal(e.target.value)}
                onBlur={() => onCambiarValorHora(persona.id, valorHoraLocal)}
                className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm"
              />
            </label>
            <button
              onClick={() => onNuevo(persona)}
              className="ml-auto rounded-md border border-brand-brown/40 px-3 py-1 text-xs font-medium text-brand-brown hover:bg-brand-tan/30"
            >
              + Agregar registro
            </button>
          </div>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="text-gray-500">
                <th className="px-2 py-1 text-left font-medium">Fecha</th>
                <th className="px-2 py-1 text-left font-medium">Entrada</th>
                <th className="px-2 py-1 text-left font-medium">Salida</th>
                <th className="px-2 py-1 text-right font-medium">Horas</th>
                <th className="px-2 py-1"></th>
              </tr>
            </thead>
            <tbody>
              {registros.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-2 py-3 text-center text-gray-400">
                    Sin registros en el período.
                  </td>
                </tr>
              )}
              {registros.map((r) => (
                <tr key={r.id} className="border-t border-gray-100">
                  <td className="px-2 py-1.5">{formatoFecha(r.fecha)}</td>
                  <td className="px-2 py-1.5">{r.horaEntrada || "—"}</td>
                  <td className="px-2 py-1.5">{r.horaSalida || "—"}</td>
                  <td className="px-2 py-1.5 text-right">{formatoHoras(horasTrabajadas(r))}</td>
                  <td className="px-2 py-1.5 text-right whitespace-nowrap">
                    <button onClick={() => onEditar(r)} className="text-blue-600 hover:underline">
                      Editar
                    </button>
                    <button onClick={() => onBorrar(r)} className="ml-2 text-red-600 hover:underline">
                      Borrar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function HorariosContenido() {
  const hoy = fechaDeHoyISO();
  const { primero, ultimo } = primerYUltimoDiaDelMes(hoy);
  const [fechaInicio, setFechaInicio] = useState(primero);
  const [fechaFin, setFechaFin] = useState(ultimo);
  const [personal, setPersonal] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [modal, setModal] = useState(null); // { registro, usuarioId, usuarioNombre }

  async function recargar() {
    setCargando(true);
    setError(null);
    try {
      const [p, r] = await Promise.all([obtenerPersonalConHorario(), obtenerTodosLosRegistros({ fechaInicio, fechaFin })]);
      setPersonal(p);
      setRegistros(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaInicio, fechaFin]);

  function irAEsteMes() {
    setFechaInicio(primero);
    setFechaFin(ultimo);
  }

  async function alCambiarValorHora(usuarioId, valor) {
    try {
      await actualizarValorHora(usuarioId, valor);
      await recargar();
    } catch (e) {
      setError(e.message);
    }
  }

  async function borrar(registro) {
    if (!window.confirm(`¿Borrar el registro del ${formatoFecha(registro.fecha)}?`)) return;
    try {
      await eliminarRegistro(registro.id);
      await recargar();
    } catch (e) {
      setError(e.message);
    }
  }

  const registrosPorPersona = useMemo(() => {
    const mapa = {};
    for (const r of registros) {
      if (!mapa[r.usuarioId]) mapa[r.usuarioId] = [];
      mapa[r.usuarioId].push(r);
    }
    return mapa;
  }, [registros]);

  // Por ahora esto es para el personal que marca entrada/salida (los
  // secretarios) — a un odontólogo/laboratorio no le corresponde liquidarse
  // por hora, ya se les liquida por producción u honorarios.
  const personalSecretarias = personal.filter((p) => p.rol === "Secretaria");

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">🕐 Horarios y liquidación</h1>
      <p className="mt-1 text-sm text-gray-500">Horas trabajadas por persona, para liquidar a fin de mes.</p>

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

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      {cargando && <p className="mt-4 text-sm text-gray-500">Cargando...</p>}

      {!cargando && personalSecretarias.length === 0 && (
        <p className="mt-4 text-sm text-gray-500">No hay personal con rol Secretaria cargado.</p>
      )}

      {!cargando &&
        personalSecretarias.map((p) => (
          <FilaPersona
            key={p.id}
            persona={p}
            registros={registrosPorPersona[p.id] || []}
            onCambiarValorHora={alCambiarValorHora}
            onEditar={(registro) => setModal({ registro, usuarioId: p.id, usuarioNombre: p.nombre })}
            onNuevo={(persona) => setModal({ registro: null, usuarioId: persona.id, usuarioNombre: persona.nombre })}
            onBorrar={borrar}
          />
        ))}

      {modal && (
        <RegistroHorarioFormModal
          registro={modal.registro}
          usuarioId={modal.usuarioId}
          usuarioNombre={modal.usuarioNombre}
          onClose={() => setModal(null)}
          onGuardado={async () => {
            setModal(null);
            await recargar();
          }}
        />
      )}
    </main>
  );
}

export default function HorariosPage() {
  return (
    <SoloDuena>
      <HorariosContenido />
    </SoloDuena>
  );
}
