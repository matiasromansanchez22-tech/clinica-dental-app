"use client";

import { useEffect, useMemo, useState } from "react";
import PacienteOrtodonciaFormModal from "@/components/PacienteOrtodonciaFormModal";
import { calcularEdad, calcularEstadoAumento } from "@/lib/ortodoncia";
import { obtenerConfiguracionOrtodoncia, obtenerPacientesOrtodoncia } from "@/lib/data/pacientesOrtodoncia";
import { obtenerProfesionales } from "@/lib/data/profesionales";

function documentosDe(p) {
  return [p.historialClinico, p.fotografias, p.rxInicial, p.rx6Meses, p.rx12Meses, p.consentimiento];
}

export default function PacientesOrtodonciaPage() {
  const [pacientes, setPacientes] = useState([]);
  const [profesionales, setProfesionales] = useState([]);
  const [config, setConfig] = useState({});
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [pacienteEnEdicion, setPacienteEnEdicion] = useState(null);
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [soloDocIncompleta, setSoloDocIncompleta] = useState(false);

  async function recargar() {
    const data = await obtenerPacientesOrtodoncia({ busqueda });
    setPacientes(data);
  }

  useEffect(() => {
    setCargando(true);
    Promise.all([obtenerPacientesOrtodoncia({ busqueda }), obtenerProfesionales(), obtenerConfiguracionOrtodoncia()])
      .then(([p, prof, conf]) => {
        setPacientes(p);
        setProfesionales(prof.filter((pr) => pr.especialidad === "Ortodoncia"));
        setConfig(conf);
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      recargar().catch((e) => setError(e.message));
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda]);

  const resumenAumento = useMemo(() => {
    const conteo = { "Al día": 0, "Próximo aumento": 0, Aumentar: 0, "Sin definir": 0 };
    for (const p of pacientes) {
      const { texto } = calcularEstadoAumento(p.proximoAumento);
      conteo[texto] = (conteo[texto] || 0) + 1;
    }
    return conteo;
  }, [pacientes]);

  const resumenDocumentacion = useMemo(() => {
    let completos = 0;
    for (const p of pacientes) {
      const documentos = documentosDe(p);
      if (documentos.filter(Boolean).length === documentos.length) completos++;
    }
    return { completos, incompletos: pacientes.length - completos };
  }, [pacientes]);

  const pacientesMostrados = soloDocIncompleta
    ? pacientes.filter((p) => {
        const documentos = documentosDe(p);
        return documentos.filter(Boolean).length < documentos.length;
      })
    : pacientes;

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pacientes de Ortodoncia</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {cargando ? "Cargando..." : `${pacientes.length} paciente${pacientes.length === 1 ? "" : "s"}${busqueda ? " (filtrado)" : ""}`}
          </p>
        </div>
        <button
          onClick={() => setMostrarNuevo(true)}
          className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark"
        >
          + Nuevo paciente
        </button>
      </div>

      {!cargando && (
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <span className="rounded-md bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700">
            🟢 Al día: {resumenAumento["Al día"]}
          </span>
          <span className="rounded-md bg-amber-50 px-3 py-1.5 font-medium text-amber-700">
            🟡 Próximo aumento: {resumenAumento["Próximo aumento"]}
          </span>
          <span className="rounded-md bg-red-50 px-3 py-1.5 font-medium text-red-700">
            🔴 Aumentar (vencido): {resumenAumento["Aumentar"]}
          </span>
          <span className="rounded-md bg-gray-100 px-3 py-1.5 font-medium text-gray-500">
            ⚪ Sin fecha de aumento: {resumenAumento["Sin definir"]}
          </span>
          <span className="rounded-md bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700">
            📎 Documentación completa: {resumenDocumentacion.completos}
          </span>
          <span className="rounded-md bg-amber-50 px-3 py-1.5 font-medium text-amber-700">
            📎 Documentación incompleta: {resumenDocumentacion.incompletos}
          </span>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o WhatsApp..."
          className="w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-1.5 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={soloDocIncompleta}
            onChange={(e) => setSoloDocIncompleta(e.target.checked)}
          />
          Mostrar solo documentación incompleta
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
              <th className="px-3 py-2 text-left font-semibold">Edad</th>
              <th className="px-3 py-2 text-left font-semibold">Brackets</th>
              <th className="px-3 py-2 text-left font-semibold">Ortodoncista</th>
              <th className="px-3 py-2 text-right font-semibold">Cuota</th>
              <th className="px-3 py-2 text-left font-semibold">Próximo aumento</th>
              <th className="px-3 py-2 text-left font-semibold">Estado</th>
              <th className="px-3 py-2 text-left font-semibold">Documentación</th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-gray-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!cargando && pacientesMostrados.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-gray-500">
                  No se encontraron pacientes.
                </td>
              </tr>
            )}
            {pacientesMostrados.map((p) => {
              const aumento = calcularEstadoAumento(p.proximoAumento);
              const documentos = documentosDe(p);
              const completos = documentos.filter(Boolean).length;
              return (
                <tr
                  key={p.id}
                  onClick={() => setPacienteEnEdicion(p)}
                  className="cursor-pointer border-t border-gray-100 hover:bg-gray-50"
                >
                  <td className="px-3 py-2 font-medium text-gray-900">{p.nombre}</td>
                  <td className="px-3 py-2 text-gray-600">{calcularEdad(p.fechaNacimiento) ?? "—"}</td>
                  <td className="px-3 py-2 text-gray-600">{p.tipoBrackets || "—"}</td>
                  <td className="px-3 py-2 text-gray-600">{p.ortodoncista}</td>
                  <td className="px-3 py-2 text-right text-gray-600">
                    {p.valorControl ? `$${Number(p.valorControl).toLocaleString("es-AR")}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{p.proximoAumento || "—"}</td>
                  <td className={`px-3 py-2 font-medium ${aumento.color}`}>
                    {aumento.emoji} {aumento.texto}
                  </td>
                  <td
                    className={`px-3 py-2 font-medium ${
                      completos === documentos.length ? "text-emerald-600" : "text-amber-600"
                    }`}
                  >
                    📎 {completos}/{documentos.length}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {(mostrarNuevo || pacienteEnEdicion) && (
        <PacienteOrtodonciaFormModal
          paciente={pacienteEnEdicion}
          profesionales={profesionales}
          config={config}
          onClose={() => {
            setMostrarNuevo(false);
            setPacienteEnEdicion(null);
          }}
          onGuardado={async () => {
            await recargar();
            setMostrarNuevo(false);
            setPacienteEnEdicion(null);
          }}
        />
      )}
    </main>
  );
}
