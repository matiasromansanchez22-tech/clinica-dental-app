"use client";

import { useEffect, useMemo, useState } from "react";
import { fechaDeHoyISO } from "@/lib/agenda";
import {
  actualizarGestionControl,
  calcularMesesAdeudados,
  ESTADOS_GESTION,
  obtenerControlesOrtodoncia,
  obtenerFechaInicioDeudaOrtodoncia,
} from "@/lib/data/controlesOrtodoncia";
import { obtenerPacientesOrtodoncia } from "@/lib/data/pacientesOrtodoncia";

const ANIOS = [2025, 2026, 2027];

function colorEstadoGestion(estado) {
  if (estado === "Pagó") return "text-emerald-600";
  if (estado === "No va a pagar") return "text-gray-400";
  if (estado === "Contactado - acordó pago") return "text-sky-600";
  if (estado === "Contactado - sin respuesta") return "text-amber-600";
  return "text-red-600";
}

export default function CuentasPorCobrarOrtodonciaPage() {
  const [anio, setAnio] = useState(2026);
  const [pacientes, setPacientes] = useState([]);
  const [controles, setControles] = useState({});
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [gestionEnEdicion, setGestionEnEdicion] = useState(null);
  const [fechaInicioDeuda, setFechaInicioDeuda] = useState(null);

  const hoy = useMemo(() => new Date(fechaDeHoyISO() + "T12:00:00"), []);

  useEffect(() => {
    obtenerFechaInicioDeudaOrtodoncia()
      .then(setFechaInicioDeuda)
      .catch((e) => setError(e.message));
  }, []);

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
      .filter((p) => !texto || p.nombre.toLowerCase().includes(texto))
      .map((p) => {
        const control = controles[p.id];
        const { mesesAdeudados } = calcularMesesAdeudados({
          control,
          fechaInstalacion: p.fechaInstalacion,
          anio,
          hoy,
          fechaInicioSeguimiento: fechaInicioDeuda,
        });
        const deudaTotal = mesesAdeudados * Number(p.valorControl || 0);
        return { paciente: p, control, mesesAdeudados, deudaTotal };
      })
      .filter((f) => f.deudaTotal > 0)
      .sort((a, b) => a.paciente.nombre.localeCompare(b.paciente.nombre));
  }, [pacientes, controles, busqueda, anio, hoy, fechaInicioDeuda]);

  const deudaTotalGeneral = filas.reduce((acc, f) => acc + f.deudaTotal, 0);

  async function cambiarEstadoGestion(pacienteId, nuevoEstado) {
    try {
      const cambios = { estado_gestion: nuevoEstado || null };
      const esGestionActiva = nuevoEstado && nuevoEstado !== "Sin gestionar";
      const controlActual = controles[pacienteId];
      if (esGestionActiva && !controlActual?.fecha_ultimo_contacto) {
        cambios.fecha_ultimo_contacto = fechaDeHoyISO();
      }
      const actualizado = await actualizarGestionControl(pacienteId, anio, cambios);
      setControles((c) => ({ ...c, [pacienteId]: actualizado }));
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <main className="mx-auto max-w-7xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">Cuentas por cobrar — Ortodoncia</h1>
      <p className="mt-1 text-sm text-gray-500">
        Pacientes con controles adeudados. Registrá acá el seguimiento de cobranza de cada uno.
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
        <div className="ml-auto rounded-md bg-gray-900 px-3 py-2 text-sm text-white">
          Deuda total: <span className="font-semibold">${deudaTotalGeneral.toLocaleString("es-AR")}</span>
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="px-3 py-2 text-left font-semibold">Paciente</th>
              <th className="px-3 py-2 text-left font-semibold">WhatsApp</th>
              <th className="px-3 py-2 text-left font-semibold">Ortodoncista</th>
              <th className="px-2 py-2 text-center font-semibold">Meses</th>
              <th className="px-3 py-2 text-right font-semibold">Deuda</th>
              <th className="px-3 py-2 text-left font-semibold">Último control</th>
              <th className="px-3 py-2 text-left font-semibold">Estado paciente</th>
              <th className="px-3 py-2 text-left font-semibold">Estado de gestión</th>
              <th className="px-3 py-2 text-left font-semibold">Último contacto</th>
              <th className="px-3 py-2 text-left font-semibold">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr>
                <td colSpan={10} className="px-3 py-4 text-center text-gray-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!cargando && filas.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-4 text-center text-gray-500">
                  No hay pacientes con deuda. 🎉
                </td>
              </tr>
            )}
            {filas.map(({ paciente, control, mesesAdeudados, deudaTotal }) => (
              <tr key={paciente.id} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2 font-medium text-gray-900">{paciente.nombre}</td>
                <td className="px-3 py-2 text-gray-600">{paciente.whatsapp || "—"}</td>
                <td className="px-3 py-2 text-gray-600">{paciente.ortodoncista}</td>
                <td className="px-2 py-2 text-center font-semibold text-red-600">{mesesAdeudados}</td>
                <td className="px-3 py-2 text-right font-medium text-red-600">${deudaTotal.toLocaleString("es-AR")}</td>
                <td className="px-3 py-2 text-gray-600">{paciente.ultimoControl || "—"}</td>
                <td className="px-3 py-2 text-gray-600">{paciente.estadoPaciente}</td>
                <td className="px-3 py-2">
                  <select
                    value={control?.estado_gestion || "Sin gestionar"}
                    onChange={(e) => cambiarEstadoGestion(paciente.id, e.target.value)}
                    className={`rounded-md border border-gray-300 px-2 py-1 text-xs font-medium ${colorEstadoGestion(control?.estado_gestion)}`}
                  >
                    {ESTADOS_GESTION.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-gray-600">{control?.fecha_ultimo_contacto || "—"}</td>
                <td className="px-3 py-2 text-gray-600">
                  <button
                    onClick={() =>
                      setGestionEnEdicion({
                        id: paciente.id,
                        nombre: paciente.nombre,
                        detalle: control?.detalle_gestion || "",
                        fecha: control?.fecha_ultimo_contacto || fechaDeHoyISO(),
                      })
                    }
                    className="max-w-[10rem] truncate text-left hover:underline"
                    title={control?.detalle_gestion || "Agregar detalle"}
                  >
                    {control?.detalle_gestion || "＋"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {gestionEnEdicion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Gestión de cobro — {gestionEnEdicion.nombre}</h2>
              <button
                onClick={() => setGestionEnEdicion(null)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Fecha de contacto
              <input
                type="date"
                value={gestionEnEdicion.fecha}
                onChange={(e) => setGestionEnEdicion((g) => ({ ...g, fecha: e.target.value }))}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
            </label>
            <label className="mt-3 flex flex-col gap-1 text-sm text-gray-700">
              Detalle
              <textarea
                value={gestionEnEdicion.detalle}
                onChange={(e) => setGestionEnEdicion((g) => ({ ...g, detalle: e.target.value }))}
                rows={4}
                placeholder="Ej. Habló con la mamá, dijo que paga el viernes."
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setGestionEnEdicion(null)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  try {
                    const actualizado = await actualizarGestionControl(gestionEnEdicion.id, anio, {
                      detalle_gestion: gestionEnEdicion.detalle,
                      fecha_ultimo_contacto: gestionEnEdicion.fecha,
                    });
                    setControles((c) => ({ ...c, [gestionEnEdicion.id]: actualizado }));
                    setGestionEnEdicion(null);
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
