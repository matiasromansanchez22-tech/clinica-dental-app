"use client";

import { useEffect, useMemo, useState } from "react";
import SoloDuena from "@/components/SoloDuena";
import { fechaDeHoyISO } from "@/lib/agenda";
import { obtenerRegistroPacientesDelMes } from "@/lib/data/registroPacientes";

const NOMBRES_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function formatoFecha(fechaISO) {
  if (!fechaISO) return "—";
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}

function PaginaRegistroPacientes() {
  const hoy = fechaDeHoyISO();
  const mesActual = hoy.slice(0, 7);
  const [mesElegido, setMesElegido] = useState(mesActual);
  const [especialidad, setEspecialidad] = useState("Todas");
  const [busqueda, setBusqueda] = useState("");
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const [anio, mes] = mesElegido.split("-").map(Number);
    setCargando(true);
    obtenerRegistroPacientesDelMes(anio, mes)
      .then(setFilas)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [mesElegido]);

  const filasFiltradas = useMemo(() => {
    let resultado = filas;
    if (especialidad !== "Todas") resultado = resultado.filter((f) => f.especialidad === especialidad);
    if (busqueda.trim()) {
      const texto = busqueda.trim().toLowerCase();
      resultado = resultado.filter(
        (f) => f.paciente.toLowerCase().includes(texto) || f.profesional.toLowerCase().includes(texto)
      );
    }
    return resultado;
  }, [filas, especialidad, busqueda]);

  // Por profesional: cuántas consultas se llevó cada uno ese mes y cuántas
  // de esas ya se transformaron en tratamiento — la base para calcular el %.
  const resumenPorProfesional = useMemo(() => {
    const grupos = new Map();
    for (const f of filasFiltradas) {
      const clave = `${f.profesionalId ?? "sin-asignar"}__${f.especialidad}`;
      if (!grupos.has(clave)) {
        grupos.set(clave, { profesional: f.profesional, especialidad: f.especialidad, consultas: 0, empezaron: 0 });
      }
      const g = grupos.get(clave);
      g.consultas++;
      if (f.empezoTratamiento) g.empezaron++;
    }
    return [...grupos.values()].sort((a, b) => b.consultas - a.consultas);
  }, [filasFiltradas]);

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">Registro de Pacientes por Profesional</h1>
      <p className="mt-0.5 text-sm text-gray-500">
        Solo visible para Dueña. Quién atendió la primera consulta de cada paciente y si esa consulta se transformó
        en tratamiento — para repartir el % de cada profesional.
      </p>

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <input
          type="month"
          value={mesElegido}
          max={mesActual}
          onChange={(e) => setMesElegido(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
        <div className="flex overflow-hidden rounded-md border border-gray-300 text-sm">
          {["Todas", "General", "Ortodoncia"].map((op) => (
            <button
              key={op}
              onClick={() => setEspecialidad(op)}
              className={`px-3 py-1.5 ${
                especialidad === op ? "bg-brand-brown text-white" : "bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              {op}
            </button>
          ))}
        </div>
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por paciente o profesional..."
          className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        />
      </div>

      {cargando ? (
        <p className="mt-6 text-sm text-gray-500">Cargando...</p>
      ) : (
        <>
          <h2 className="mt-6 text-sm font-semibold uppercase text-gray-500">
            Por profesional — {NOMBRES_MES[Number(mesElegido.split("-")[1]) - 1]} {mesElegido.split("-")[0]}
          </h2>
          <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-brand-brown text-white">
                  <th className="px-3 py-2 text-left font-semibold">Profesional</th>
                  <th className="px-3 py-2 text-left font-semibold">Especialidad</th>
                  <th className="px-3 py-2 text-right font-semibold">Consultas</th>
                  <th className="px-3 py-2 text-right font-semibold">Empezaron tratamiento</th>
                  <th className="px-3 py-2 text-right font-semibold">% conversión</th>
                </tr>
              </thead>
              <tbody>
                {resumenPorProfesional.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-3 text-center text-gray-500">
                      No hay consultas registradas para este filtro.
                    </td>
                  </tr>
                ) : (
                  resumenPorProfesional.map((g) => (
                    <tr key={`${g.profesional}-${g.especialidad}`} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-medium text-gray-900">{g.profesional}</td>
                      <td className="px-3 py-2 text-gray-600">{g.especialidad}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{g.consultas}</td>
                      <td className="px-3 py-2 text-right text-gray-600">{g.empezaron}</td>
                      <td className="px-3 py-2 text-right font-medium text-gray-900">
                        {g.consultas > 0 ? `${Math.round((g.empezaron / g.consultas) * 100)}%` : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <h2 className="mt-6 text-sm font-semibold uppercase text-gray-500">
            Detalle ({filasFiltradas.length} paciente{filasFiltradas.length === 1 ? "" : "s"})
          </h2>
          <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100 text-gray-600">
                  <th className="px-3 py-2 text-left font-semibold">Paciente</th>
                  <th className="px-3 py-2 text-left font-semibold">Profesional</th>
                  <th className="px-3 py-2 text-left font-semibold">Especialidad</th>
                  <th className="px-3 py-2 text-left font-semibold">Primera consulta</th>
                  <th className="px-3 py-2 text-left font-semibold">¿Empezó tratamiento?</th>
                  <th className="px-3 py-2 text-left font-semibold">Fecha que empezó</th>
                </tr>
              </thead>
              <tbody>
                {filasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-3 text-center text-gray-500">
                      No hay pacientes para este filtro.
                    </td>
                  </tr>
                ) : (
                  filasFiltradas.map((f) => (
                    <tr key={`${f.especialidad}-${f.pacienteId}`} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-medium text-gray-900">{f.paciente}</td>
                      <td className="px-3 py-2 text-gray-600">{f.profesional}</td>
                      <td className="px-3 py-2 text-gray-600">{f.especialidad}</td>
                      <td className="px-3 py-2 text-gray-600">{formatoFecha(f.fechaConsulta)}</td>
                      <td className="px-3 py-2">
                        {f.empezoTratamiento ? (
                          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                            ✅ Sí
                          </span>
                        ) : (
                          <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                            Todavía no
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-600">{formatoFecha(f.fechaEmpezo)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="mt-4 text-xs text-gray-400">
        "Empezó tratamiento" se sigue actualizando con el tiempo: un paciente que consultó este mes puede sumarse acá
        más adelante en cuanto acepte un presupuesto o arranque el tratamiento de ortodoncia, aunque siga apareciendo
        en el mes de su primera consulta.
      </p>
    </main>
  );
}

export default function RegistroPacientesPage() {
  return (
    <SoloDuena>
      <PaginaRegistroPacientes />
    </SoloDuena>
  );
}
