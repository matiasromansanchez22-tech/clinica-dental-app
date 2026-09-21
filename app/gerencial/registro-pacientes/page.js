"use client";

import { useEffect, useMemo, useState } from "react";
import SoloDuena from "@/components/SoloDuena";
import { fechaDeHoyISO } from "@/lib/agenda";
import { guardarMetaConsultas, obtenerMetasConsultasMes } from "@/lib/data/metas";
import { obtenerRegistroPacientesDelMes, obtenerValorConsultaGeneral } from "@/lib/data/registroPacientes";

const NOMBRES_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function formatoFecha(fechaISO) {
  if (!fechaISO) return "—";
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}

function formatoPesos(n) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

function PaginaRegistroPacientes() {
  const hoy = fechaDeHoyISO();
  const mesActual = hoy.slice(0, 7);
  const [mesElegido, setMesElegido] = useState(mesActual);
  const [especialidad, setEspecialidad] = useState("Todas");
  const [busqueda, setBusqueda] = useState("");
  const [filas, setFilas] = useState([]);
  const [valorConsulta, setValorConsulta] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [porcentajesConsulta, setPorcentajesConsulta] = useState({});
  const [porcentajesTratamiento, setPorcentajesTratamiento] = useState({});
  const [metasConsultas, setMetasConsultas] = useState({});
  const [guardandoMeta, setGuardandoMeta] = useState(null);

  useEffect(() => {
    obtenerValorConsultaGeneral().then(setValorConsulta);
  }, []);

  useEffect(() => {
    const [anio, mes] = mesElegido.split("-").map(Number);
    setCargando(true);
    Promise.all([obtenerRegistroPacientesDelMes(anio, mes), obtenerMetasConsultasMes(anio, mes)])
      .then(([f, m]) => {
        setFilas(f);
        setMetasConsultas(m);
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [mesElegido]);

  async function guardarMeta(profesionalId, valor) {
    const [anio, mes] = mesElegido.split("-").map(Number);
    setGuardandoMeta(profesionalId);
    setError(null);
    try {
      await guardarMetaConsultas(profesionalId, anio, mes, valor);
      setMetasConsultas((m) => ({ ...m, [profesionalId]: Number(valor) || 0 }));
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardandoMeta(null);
    }
  }

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

  // Por profesional: cuántas consultas se llevó cada uno ese mes (y cuánto
  // vale eso, a $ valorConsulta cada una — solo tiene sentido en General),
  // cuántas ya se transformaron en tratamiento y cuánto se cobró de esos
  // pacientes — la base para calcular el % que le corresponde a cada uno,
  // por un lado de las consultas y por otro de los tratamientos.
  const resumenPorProfesional = useMemo(() => {
    const grupos = new Map();
    for (const f of filasFiltradas) {
      const clave = `${f.profesionalId ?? "sin-asignar"}__${f.especialidad}`;
      if (!grupos.has(clave)) {
        grupos.set(clave, {
          clave,
          profesionalId: f.profesionalId ?? null,
          profesional: f.profesional,
          especialidad: f.especialidad,
          consultas: 0,
          empezaron: 0,
          montoCobrado: 0,
        });
      }
      const g = grupos.get(clave);
      g.consultas++;
      if (f.empezoTratamiento) g.empezaron++;
      g.montoCobrado += f.montoCobrado || 0;
    }
    return [...grupos.values()]
      .map((g) => ({ ...g, valorConsultas: g.especialidad === "General" ? g.consultas * valorConsulta : null }))
      .sort((a, b) => b.montoCobrado - a.montoCobrado);
  }, [filasFiltradas, valorConsulta]);

  const totales = useMemo(() => {
    return resumenPorProfesional.reduce(
      (acc, g) => {
        const comisionConsulta = (g.valorConsultas || 0) * (Number(porcentajesConsulta[g.clave]) || 0) / 100;
        const comisionTratamiento = g.montoCobrado * (Number(porcentajesTratamiento[g.clave]) || 0) / 100;
        acc.consultas += g.consultas;
        acc.valorConsultas += g.valorConsultas || 0;
        acc.empezaron += g.empezaron;
        acc.montoCobrado += g.montoCobrado;
        acc.comisionConsulta += comisionConsulta;
        acc.comisionTratamiento += comisionTratamiento;
        return acc;
      },
      { consultas: 0, valorConsultas: 0, empezaron: 0, montoCobrado: 0, comisionConsulta: 0, comisionTratamiento: 0 }
    );
  }, [resumenPorProfesional, porcentajesConsulta, porcentajesTratamiento]);

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">Registro de Pacientes por Profesional</h1>
      <p className="mt-0.5 text-sm text-gray-500">
        Solo visible para Dueña. Quién atendió la primera consulta de cada paciente, si esa consulta se transformó en
        tratamiento y cuánto se cobró — para calcular el % que le corresponde a cada profesional.
      </p>

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <input
          type="month"
          value={mesElegido}
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
            🎯 Meta de consultas y efectividad — {NOMBRES_MES[Number(mesElegido.split("-")[1]) - 1]}{" "}
            {mesElegido.split("-")[0]}
          </h2>
          <p className="mt-1 text-xs text-gray-500">
            Cuántas consultas nuevas le asignaste a cada profesional este mes, y de esas cuántas terminaron en
            tratamiento. Efectividad = vendidas ÷ meta asignada — usalo para decidir si el mes que viene le sumás más
            consultas.
          </p>
          <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-brand-brown text-white">
                  <th className="px-3 py-2 text-left font-semibold">Profesional</th>
                  <th className="px-3 py-2 text-left font-semibold">Espec.</th>
                  <th className="px-3 py-2 text-right font-semibold">Meta consultas</th>
                  <th className="px-3 py-2 text-right font-semibold">Consultas reales</th>
                  <th className="px-3 py-2 text-right font-semibold">Vendieron</th>
                  <th className="px-3 py-2 text-right font-semibold">Efectividad</th>
                </tr>
              </thead>
              <tbody>
                {resumenPorProfesional.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-3 text-center text-gray-500">
                      No hay consultas registradas para este filtro.
                    </td>
                  </tr>
                ) : (
                  resumenPorProfesional.map((g) => {
                    const meta = g.profesionalId ? metasConsultas[g.profesionalId] ?? 0 : 0;
                    const efectividad = meta > 0 ? (g.empezaron / meta) * 100 : null;
                    return (
                      <tr key={g.clave} className="border-t border-gray-100">
                        <td className="px-3 py-2 font-medium text-gray-900">{g.profesional}</td>
                        <td className="px-3 py-2 text-gray-600">{g.especialidad}</td>
                        <td className="px-3 py-2 text-right">
                          {g.profesionalId ? (
                            <input
                              type="number"
                              min="0"
                              defaultValue={meta || ""}
                              disabled={guardandoMeta === g.profesionalId}
                              onBlur={(e) => guardarMeta(g.profesionalId, e.target.value)}
                              placeholder="0"
                              className="w-16 rounded-md border border-gray-300 px-2 py-1 text-right text-sm disabled:opacity-50"
                            />
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600">{g.consultas}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{g.empezaron}</td>
                        <td className="px-3 py-2 text-right">
                          {efectividad === null ? (
                            <span className="text-gray-400">—</span>
                          ) : (
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                efectividad >= 90
                                  ? "bg-emerald-100 text-emerald-700"
                                  : efectividad >= 70
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-red-100 text-red-700"
                              }`}
                            >
                              {Math.round(efectividad)}%
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <h2 className="mt-8 text-sm font-semibold uppercase text-gray-500">
            Por profesional — {NOMBRES_MES[Number(mesElegido.split("-")[1]) - 1]} {mesElegido.split("-")[0]}
          </h2>
          {valorConsulta > 0 && (
            <p className="mt-1 text-xs text-gray-500">
              Consulta particular de General: {formatoPesos(valorConsulta)} c/u (del catálogo — si cambiás el precio
              ahí, se actualiza acá solo).
            </p>
          )}
          <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-brand-brown text-white">
                  <th className="px-3 py-2 text-left font-semibold">Profesional</th>
                  <th className="px-3 py-2 text-left font-semibold">Espec.</th>
                  <th className="px-3 py-2 text-right font-semibold">Consultas</th>
                  <th className="px-3 py-2 text-right font-semibold">Valor consultas</th>
                  <th className="px-3 py-2 text-center font-semibold">% consulta</th>
                  <th className="px-3 py-2 text-right font-semibold">Comisión consulta</th>
                  <th className="px-3 py-2 text-right font-semibold">Empezaron trat.</th>
                  <th className="px-3 py-2 text-right font-semibold">Cobrado trat.</th>
                  <th className="px-3 py-2 text-center font-semibold">% tratamiento</th>
                  <th className="px-3 py-2 text-right font-semibold">Comisión trat.</th>
                  <th className="px-3 py-2 text-right font-semibold">Total a pagar</th>
                </tr>
              </thead>
              <tbody>
                {resumenPorProfesional.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-3 py-3 text-center text-gray-500">
                      No hay consultas registradas para este filtro.
                    </td>
                  </tr>
                ) : (
                  resumenPorProfesional.map((g) => {
                    const pctConsulta = porcentajesConsulta[g.clave] ?? "";
                    const pctTratamiento = porcentajesTratamiento[g.clave] ?? "";
                    const comisionConsulta = ((g.valorConsultas || 0) * (Number(pctConsulta) || 0)) / 100;
                    const comisionTratamiento = (g.montoCobrado * (Number(pctTratamiento) || 0)) / 100;
                    return (
                      <tr key={g.clave} className="border-t border-gray-100">
                        <td className="px-3 py-2 font-medium text-gray-900">{g.profesional}</td>
                        <td className="px-3 py-2 text-gray-600">{g.especialidad}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{g.consultas}</td>
                        <td className="px-3 py-2 text-right text-gray-600">
                          {g.valorConsultas !== null ? formatoPesos(g.valorConsultas) : "—"}
                        </td>
                        <td className="px-3 py-2 text-center">
                          {g.valorConsultas !== null ? (
                            <>
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={pctConsulta}
                                onChange={(e) =>
                                  setPorcentajesConsulta((p) => ({ ...p, [g.clave]: e.target.value }))
                                }
                                placeholder="0"
                                className="w-14 rounded-md border border-gray-300 px-2 py-1 text-right text-sm"
                              />
                              %
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-emerald-700">
                          {comisionConsulta > 0 ? formatoPesos(comisionConsulta) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-600">{g.empezaron}</td>
                        <td className="px-3 py-2 text-right text-gray-600">{formatoPesos(g.montoCobrado)}</td>
                        <td className="px-3 py-2 text-center">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={pctTratamiento}
                            onChange={(e) =>
                              setPorcentajesTratamiento((p) => ({ ...p, [g.clave]: e.target.value }))
                            }
                            placeholder="0"
                            className="w-14 rounded-md border border-gray-300 px-2 py-1 text-right text-sm"
                          />
                          %
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-emerald-700">
                          {comisionTratamiento > 0 ? formatoPesos(comisionTratamiento) : "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-emerald-800">
                          {comisionConsulta + comisionTratamiento > 0
                            ? formatoPesos(comisionConsulta + comisionTratamiento)
                            : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {resumenPorProfesional.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold text-gray-900">
                    <td className="px-3 py-2" colSpan={2}>
                      Total
                    </td>
                    <td className="px-3 py-2 text-right">{totales.consultas}</td>
                    <td className="px-3 py-2 text-right">{formatoPesos(totales.valorConsultas)}</td>
                    <td></td>
                    <td className="px-3 py-2 text-right text-emerald-700">
                      {totales.comisionConsulta > 0 ? formatoPesos(totales.comisionConsulta) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right">{totales.empezaron}</td>
                    <td className="px-3 py-2 text-right">{formatoPesos(totales.montoCobrado)}</td>
                    <td></td>
                    <td className="px-3 py-2 text-right text-emerald-700">
                      {totales.comisionTratamiento > 0 ? formatoPesos(totales.comisionTratamiento) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-emerald-800">
                      {totales.comisionConsulta + totales.comisionTratamiento > 0
                        ? formatoPesos(totales.comisionConsulta + totales.comisionTratamiento)
                        : "—"}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <p className="mt-1 text-[11px] text-gray-400">
            Los "%" son solo para calcular en pantalla — se recalculan solos, pero no se guardan. Si recargás la
            página vuelven a quedar en blanco. "Valor consultas" solo aplica a General (a Ortodoncia no le
            corresponde ese precio de consulta particular).
          </p>

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
                  <th className="px-3 py-2 text-right font-semibold">Cobrado</th>
                </tr>
              </thead>
              <tbody>
                {filasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-3 text-center text-gray-500">
                      No hay pacientes para este filtro.
                    </td>
                  </tr>
                ) : (
                  filasFiltradas.map((f) => (
                    <tr key={`${f.especialidad}-${f.pacienteId}`} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-medium text-gray-900">{f.paciente}</td>
                      <td className="px-3 py-2 text-gray-600">{f.profesional}</td>
                      <td className="px-3 py-2 text-gray-600">{f.especialidad}</td>
                      <td className="px-3 py-2 text-gray-600">
                        {formatoFecha(f.fechaConsulta)}
                        {f.fechaConsulta > hoy && <span className="ml-1 text-xs text-amber-600">(a futuro)</span>}
                      </td>
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
                      <td className="px-3 py-2 text-right text-gray-600">
                        {f.montoCobrado > 0 ? formatoPesos(f.montoCobrado) : "—"}
                      </td>
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
        más adelante en cuanto acepte un presupuesto o pague algo más que la consulta (en Ortodoncia, cuando arranca
        el tratamiento), aunque siga apareciendo en el mes de su primera consulta. Si un paciente solo pagó la
        consulta (nada más), NO cuenta como que empezó tratamiento — así no se mezcla con lo que ya se calcula aparte
        en "Valor consultas". "Cobrado" es la plata que ese paciente pagó en Caja hasta hoy más allá de la consulta
        (no solo ese mes), para que el número no quede corto si el tratamiento se sigue pagando en cuotas más
        adelante.
      </p>
      <p className="mt-2 text-xs text-gray-400">
        "Primera consulta" cuenta pacientes NUEVOS de verdad, no cualquier turno: en Ortodoncia es el turno cargado
        específicamente como "Consulta de ortodoncia"; en General es la fecha en que se dio de alta la ficha del
        paciente (que se crea justo al agendarle el primer turno). Así quedan afuera los pacientes viejos que ya
        estaban cargados de antes, aunque recién ahora se les cargue un turno de control.
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
