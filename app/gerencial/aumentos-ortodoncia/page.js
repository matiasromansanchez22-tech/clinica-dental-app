"use client";

import { useEffect, useMemo, useState } from "react";
import SoloDuena from "@/components/SoloDuena";
import { fechaDeHoyISO } from "@/lib/agenda";
import { calcularEstadoAumento } from "@/lib/ortodoncia";
import {
  aplicarAumentoCuota,
  obtenerConfiguracionOrtodoncia,
  obtenerPacientesOrtodoncia,
} from "@/lib/data/pacientesOrtodoncia";

function AumentosOrtodonciaContenido() {
  const [pacientes, setPacientes] = useState([]);
  const [config, setConfig] = useState({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [cuotasEditadas, setCuotasEditadas] = useState({});
  const [aplicando, setAplicando] = useState(null);

  async function recargar() {
    setCargando(true);
    try {
      const [p, c] = await Promise.all([obtenerPacientesOrtodoncia(), obtenerConfiguracionOrtodoncia()]);
      setPacientes(p);
      setConfig(c);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    recargar();
  }, []);

  const porcentajeAumento = config.aumento_porcentaje ?? 25;
  const mesesEntreAumentos = config.meses_entre_aumentos ?? 6;

  const filas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();
    return pacientes
      .filter((p) => p.estadoPaciente === "Activo")
      .filter((p) => !texto || p.nombre.toLowerCase().includes(texto))
      .map((p) => {
        const estado = calcularEstadoAumento(p.proximoAumento);
        const cuotaSugerida = p.valorControl
          ? Math.round((Number(p.valorControl) * (1 + porcentajeAumento / 100)) / 100) * 100
          : 0;
        return { paciente: p, estado, cuotaSugerida };
      })
      .filter((f) => mostrarTodos || f.estado.emoji === "🔴" || f.estado.emoji === "🟡")
      .sort((a, b) => {
        if (!a.paciente.proximoAumento) return 1;
        if (!b.paciente.proximoAumento) return -1;
        return a.paciente.proximoAumento < b.paciente.proximoAumento ? -1 : 1;
      });
  }, [pacientes, busqueda, mostrarTodos, porcentajeAumento]);

  async function aplicar(fila) {
    const nuevoValor = cuotasEditadas[fila.paciente.id] ?? fila.cuotaSugerida;
    if (!nuevoValor || Number(nuevoValor) <= 0) {
      setError("La nueva cuota tiene que ser mayor a cero.");
      return;
    }
    setAplicando(fila.paciente.id);
    setError(null);
    try {
      const actualizado = await aplicarAumentoCuota(fila.paciente.id, Number(nuevoValor), fechaDeHoyISO(), mesesEntreAumentos);
      setPacientes((ps) => ps.map((p) => (p.id === actualizado.id ? actualizado : p)));
    } catch (e) {
      setError(e.message);
    } finally {
      setAplicando(null);
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">Aumento de cuota — Ortodoncia</h1>
      <p className="mt-1 text-sm text-gray-500">
        Pacientes a los que hay que aumentarles la cuota mensual de control, cuánto les correspondería (
        {porcentajeAumento}% sobre la cuota actual) y desde cuándo.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre..."
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        />
        <label className="flex items-center gap-1.5 text-sm text-gray-700">
          <input type="checkbox" checked={mostrarTodos} onChange={(e) => setMostrarTodos(e.target.checked)} />
          Mostrar todos (incluye al día y sin definir)
        </label>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-brand-brown text-white">
              <th className="px-3 py-2 text-left font-semibold">Paciente</th>
              <th className="px-3 py-2 text-left font-semibold">Ortodoncista</th>
              <th className="px-3 py-2 text-left font-semibold">Estado</th>
              <th className="px-3 py-2 text-left font-semibold">Próximo aumento</th>
              <th className="px-3 py-2 text-right font-semibold">Cuota actual</th>
              <th className="px-3 py-2 text-right font-semibold">Cuota nueva</th>
              <th className="px-3 py-2 text-left font-semibold">Acción</th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-gray-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!cargando && filas.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-gray-500">
                  No hay pacientes con aumento pendiente. 🎉
                </td>
              </tr>
            )}
            {filas.map((f) => (
              <tr key={f.paciente.id} className="border-t border-gray-100">
                <td className="px-3 py-2 font-medium text-gray-900">{f.paciente.nombre}</td>
                <td className="px-3 py-2 text-gray-600">{f.paciente.ortodoncista}</td>
                <td className={`px-3 py-2 font-medium ${f.estado.color}`}>
                  {f.estado.emoji} {f.estado.texto}
                </td>
                <td className="px-3 py-2 text-gray-600">{f.paciente.proximoAumento || "—"}</td>
                <td className="px-3 py-2 text-right text-gray-600">
                  {f.paciente.valorControl ? `$${Number(f.paciente.valorControl).toLocaleString("es-AR")}` : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  <input
                    type="number"
                    defaultValue={f.cuotaSugerida || ""}
                    onChange={(e) =>
                      setCuotasEditadas((c) => ({ ...c, [f.paciente.id]: Number(e.target.value) }))
                    }
                    className="w-28 rounded-md border border-gray-300 px-2 py-1 text-right"
                  />
                </td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => aplicar(f)}
                    disabled={aplicando === f.paciente.id}
                    className="rounded-md bg-brand-brown px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
                  >
                    {aplicando === f.paciente.id ? "Aplicando..." : "Aplicar aumento"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-gray-500">
        Al aplicar, se actualiza la cuota del paciente y se recalcula el próximo aumento a {mesesEntreAumentos} meses
        desde hoy.
      </p>
    </main>
  );
}

export default function AumentosOrtodonciaPage() {
  return (
    <SoloDuena>
      <AumentosOrtodonciaContenido />
    </SoloDuena>
  );
}
