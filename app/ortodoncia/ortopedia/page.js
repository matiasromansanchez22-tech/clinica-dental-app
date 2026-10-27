"use client";

import { useEffect, useMemo, useState } from "react";
import NoContador from "@/components/NoContador";
import PacienteOrtodonciaFormModal from "@/components/PacienteOrtodonciaFormModal";
import { calcularEdad } from "@/lib/ortodoncia";
import { obtenerConfiguracionOrtodoncia } from "@/lib/data/pacientesOrtodoncia";
import { obtenerPacientesOrtopedia } from "@/lib/data/ortopedia";
import { obtenerProfesionales } from "@/lib/data/profesionales";

function formatoFecha(fechaISO) {
  if (!fechaISO) return "—";
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}

const ESTILO_ESTADO = {
  Activo: "bg-emerald-100 text-emerald-800",
  Consulta: "bg-sky-100 text-sky-800",
  Inactivo: "bg-gray-100 text-gray-600",
  Finalizado: "bg-violet-100 text-violet-800",
  Abandonó: "bg-red-100 text-red-800",
};

function PacientesOrtopediaContenido() {
  const [pacientes, setPacientes] = useState([]);
  const [profesionales, setProfesionales] = useState([]);
  const [config, setConfig] = useState({});
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [pacienteEnEdicion, setPacienteEnEdicion] = useState(null);
  const [mostrarNuevo, setMostrarNuevo] = useState(false);

  async function recargar() {
    setPacientes(await obtenerPacientesOrtopedia({ busqueda }));
  }

  useEffect(() => {
    Promise.all([obtenerProfesionales(), obtenerConfiguracionOrtodoncia()])
      .then(([prof, conf]) => {
        setProfesionales(prof.filter((pr) => pr.especialidad === "Ortodoncia"));
        setConfig(conf);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      recargar()
        .catch((e) => setError(e.message))
        .finally(() => setCargando(false));
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda]);

  const resumen = useMemo(() => {
    const activos = pacientes.filter((p) => p.estadoPaciente === "Activo").length;
    return { total: pacientes.length, activos, otros: pacientes.length - activos };
  }, [pacientes]);

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🦴 Pacientes Ortopedia</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {cargando ? "Cargando..." : `${resumen.activos} activos${resumen.otros > 0 ? ` · ${resumen.otros} en otro estado` : ""}${busqueda ? " (filtrado)" : ""}`}
          </p>
        </div>
        <button onClick={() => setMostrarNuevo(true)} className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark">
          + Nuevo paciente de ortopedia
        </button>
      </div>
      <p className="mt-2 text-xs text-gray-500">
        Comparten la agenda y la caja de Ortodoncia. Están acá aparte y no cuentan en el seguimiento de ortodoncia, la tarjeta de fidelidad ni el plan de referidos.
        Para pasar a un paciente de ortodoncia a esta lista, abrí su ficha y tildá «Paciente de ortopedia».
      </p>

      <input
        type="search"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre o WhatsApp..."
        className="mt-4 w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm"
      />

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="bg-brand-brown text-white">
              <th className="px-3 py-2 text-left font-semibold">Paciente</th>
              <th className="px-3 py-2 text-left font-semibold">Edad</th>
              <th className="px-3 py-2 text-left font-semibold">WhatsApp</th>
              <th className="px-3 py-2 text-left font-semibold">Profesional</th>
              <th className="px-3 py-2 text-left font-semibold">Estado</th>
              <th className="px-3 py-2 text-left font-semibold">Próximo turno</th>
              <th className="px-3 py-2 text-left font-semibold">Última visita</th>
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
            {!cargando && pacientes.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-center text-gray-500">
                  {busqueda ? "No se encontraron pacientes de ortopedia con ese nombre." : "Todavía no hay pacientes de ortopedia cargados."}
                </td>
              </tr>
            )}
            {pacientes.map((p) => (
              <tr key={p.id} onClick={() => setPacienteEnEdicion(p)} className="cursor-pointer border-t border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2 font-medium text-gray-900">{p.nombre}</td>
                <td className="px-3 py-2 text-gray-600">{p.fechaNacimiento ? `${calcularEdad(p.fechaNacimiento)} años` : "—"}</td>
                <td className="px-3 py-2 text-gray-600">{p.whatsapp || "—"}</td>
                <td className="px-3 py-2 text-gray-600">{p.ortodoncista}</td>
                <td className="px-3 py-2">
                  <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${ESTILO_ESTADO[p.estadoPaciente] || "bg-gray-100 text-gray-600"}`}>{p.estadoPaciente}</span>
                </td>
                <td className="px-3 py-2 text-gray-600">
                  {p.proximoTurnoFecha ? (
                    <>
                      <span className="tabular-nums">{formatoFecha(p.proximoTurnoFecha)}</span>
                      <span className="block text-xs text-gray-400">{p.proximoTurnoConcepto}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2 tabular-nums text-gray-600">{formatoFecha(p.ultimaVisita)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(mostrarNuevo || pacienteEnEdicion) && (
        <PacienteOrtodonciaFormModal
          paciente={pacienteEnEdicion}
          esOrtopediaInicial
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

export default function PacientesOrtopediaPage() {
  return (
    <NoContador>
      <PacientesOrtopediaContenido />
    </NoContador>
  );
}
