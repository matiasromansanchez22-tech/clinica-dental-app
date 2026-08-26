"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fechaDeHoyISO } from "@/lib/agenda";
import {
  actualizarMesControl,
  actualizarObservacionesControl,
  calcularMesesAdeudados,
  MESES,
  obtenerControlesOrtodoncia,
} from "@/lib/data/controlesOrtodoncia";
import { obtenerPacientesOrtodoncia } from "@/lib/data/pacientesOrtodoncia";

const ANIOS = [2025, 2026, 2027];
const OPCIONES_MES = ["", "Pago", "Pagado Anticipado"];

function colorCelda(valor) {
  if (valor === "Pago") return "bg-emerald-100 text-emerald-800";
  if (valor === "Pagado Anticipado") return "bg-sky-100 text-sky-800";
  return "bg-white text-gray-400";
}

export default function ControlesOrtodonciaPage() {
  const [anio, setAnio] = useState(2026);
  const [pacientes, setPacientes] = useState([]);
  const [controles, setControles] = useState({});
  const [busqueda, setBusqueda] = useState("");
  const [soloActivos, setSoloActivos] = useState(true);
  const [soloConDeuda, setSoloConDeuda] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [pacienteObservacion, setPacienteObservacion] = useState(null);
  const [celdasGuardando, setCeldasGuardando] = useState({});
  const celdasEnVuelo = useRef(new Set());

  const hoy = useMemo(() => new Date(fechaDeHoyISO() + "T12:00:00"), []);

  useEffect(() => {
    setCargando(true);
    Promise.all([obtenerPacientesOrtodoncia(), obtenerControlesOrtodoncia(anio)])
      .then(([p, c]) => {
        setPacientes(p);
        setControles(c);
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [anio]);

  const filas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return pacientes
      .filter((p) => !soloActivos || p.estadoPaciente === "Activo")
      .filter((p) => !texto || p.nombre.toLowerCase().includes(texto))
      .map((p) => {
        const control = controles[p.id];
        const { mesesAdeudados, mesesVencidos } = calcularMesesAdeudados({
          control,
          fechaInstalacion: p.fechaInstalacion,
          anio,
          hoy,
        });
        const deudaTotal = mesesAdeudados * Number(p.valorControl || 0);
        return { paciente: p, control, mesesAdeudados, mesesVencidos, deudaTotal };
      })
      .filter((f) => !soloConDeuda || f.mesesAdeudados > 0)
      .sort((a, b) => b.mesesAdeudados - a.mesesAdeudados || a.paciente.nombre.localeCompare(b.paciente.nombre));
  }, [pacientes, controles, busqueda, soloActivos, soloConDeuda, anio, hoy]);

  const deudaTotalGeneral = filas.reduce((acc, f) => acc + f.deudaTotal, 0);

  async function cambiarMes(pacienteId, mesClave, valorActual) {
    const claveCelda = `${pacienteId}-${mesClave}`;
    if (celdasEnVuelo.current.has(claveCelda)) return;
    celdasEnVuelo.current.add(claveCelda);
    setCeldasGuardando((c) => ({ ...c, [claveCelda]: true }));
    const indiceActual = OPCIONES_MES.indexOf(valorActual || "");
    const siguiente = OPCIONES_MES[(indiceActual + 1) % OPCIONES_MES.length];
    try {
      const actualizado = await actualizarMesControl(pacienteId, anio, mesClave, siguiente);
      setControles((c) => ({ ...c, [pacienteId]: actualizado }));
    } catch (e) {
      setError(e.message);
    } finally {
      celdasEnVuelo.current.delete(claveCelda);
      setCeldasGuardando((c) => {
        const { [claveCelda]: _omitida, ...resto } = c;
        return resto;
      });
    }
  }

  return (
    <main className="mx-auto max-w-7xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">Controles {anio} — Ortodoncia</h1>
      <p className="mt-1 text-sm text-gray-500">
        Hacé clic en cada mes para marcarlo Pago / Pagado Anticipado / vacío. Los meses adeudados y la deuda se
        calculan solos.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <select
          value={anio}
          onChange={(e) => setAnio(Number(e.target.value))}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          {ANIOS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre..."
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        />
        <label className="flex items-center gap-1.5 text-sm text-gray-700">
          <input type="checkbox" checked={soloActivos} onChange={(e) => setSoloActivos(e.target.checked)} />
          Solo pacientes activos
        </label>
        <label className="flex items-center gap-1.5 text-sm text-gray-700">
          <input type="checkbox" checked={soloConDeuda} onChange={(e) => setSoloConDeuda(e.target.checked)} />
          Solo con deuda
        </label>
        <div className="ml-auto rounded-md bg-gray-900 px-3 py-2 text-sm text-white">
          Deuda total: <span className="font-semibold">${deudaTotalGeneral.toLocaleString("es-AR")}</span>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="sticky left-0 z-10 bg-gray-800 px-3 py-2 text-left font-semibold">Paciente</th>
              {MESES.map((m) => (
                <th key={m.clave} className="px-2 py-2 text-center font-semibold">
                  {m.etiqueta}
                </th>
              ))}
              <th className="px-2 py-2 text-center font-semibold">Adeudados</th>
              <th className="px-3 py-2 text-right font-semibold">Deuda</th>
              <th className="px-3 py-2 text-left font-semibold">Obs.</th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr>
                <td colSpan={16} className="px-3 py-4 text-center text-gray-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!cargando && filas.length === 0 && (
              <tr>
                <td colSpan={16} className="px-3 py-4 text-center text-gray-500">
                  No se encontraron pacientes.
                </td>
              </tr>
            )}
            {filas.map(({ paciente, control, mesesAdeudados, mesesVencidos, deudaTotal }) => (
              <tr key={paciente.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="sticky left-0 z-10 bg-white px-3 py-1.5 font-medium text-gray-900">{paciente.nombre}</td>
                {MESES.map((m) => {
                  const guardando = celdasGuardando[`${paciente.id}-${m.clave}`];
                  return (
                    <td
                      key={m.clave}
                      onClick={() => cambiarMes(paciente.id, m.clave, control?.[m.clave])}
                      className={`cursor-pointer border-l border-gray-100 px-1 py-1.5 text-center ${colorCelda(control?.[m.clave])} ${
                        mesesVencidos.includes(m.clave) ? "ring-1 ring-inset ring-red-300" : ""
                      } ${guardando ? "opacity-40" : ""}`}
                      title={control?.[m.clave] || "Sin marcar"}
                    >
                      {control?.[m.clave] === "Pago" ? "✓" : control?.[m.clave] === "Pagado Anticipado" ? "✓A" : ""}
                    </td>
                  );
                })}
                <td className={`px-2 py-1.5 text-center font-semibold ${mesesAdeudados > 0 ? "text-red-600" : "text-emerald-600"}`}>
                  {mesesAdeudados}
                </td>
                <td className={`px-3 py-1.5 text-right font-medium ${deudaTotal > 0 ? "text-red-600" : "text-gray-500"}`}>
                  {deudaTotal > 0 ? `$${deudaTotal.toLocaleString("es-AR")}` : "—"}
                </td>
                <td className="px-3 py-1.5 text-gray-600">
                  <button
                    onClick={() => setPacienteObservacion({ id: paciente.id, nombre: paciente.nombre, observaciones: control?.observaciones || "" })}
                    className="max-w-[10rem] truncate text-left hover:underline"
                    title={control?.observaciones || "Agregar observación"}
                  >
                    {control?.observaciones || "＋"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pacienteObservacion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Observación — {pacienteObservacion.nombre}</h2>
              <button
                onClick={() => setPacienteObservacion(null)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
            <textarea
              value={pacienteObservacion.observaciones}
              onChange={(e) => setPacienteObservacion((p) => ({ ...p, observaciones: e.target.value }))}
              rows={4}
              className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setPacienteObservacion(null)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  try {
                    const actualizado = await actualizarObservacionesControl(
                      pacienteObservacion.id,
                      anio,
                      pacienteObservacion.observaciones
                    );
                    setControles((c) => ({ ...c, [pacienteObservacion.id]: actualizado }));
                    setPacienteObservacion(null);
                  } catch (e) {
                    setError(e.message);
                  }
                }}
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
