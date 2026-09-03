"use client";

import { useEffect, useMemo, useState } from "react";
import PacienteFormModal from "@/components/PacienteFormModal";
import { calcularEdad } from "@/lib/pacientes";
import { actualizarBanderasPaciente, obtenerPacientes } from "@/lib/data/pacientes";
import { obtenerProfesionales } from "@/lib/data/profesionales";

export default function PacientesPage() {
  const [pacientes, setPacientes] = useState([]);
  const [profesionales, setProfesionales] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [pacienteEnEdicion, setPacienteEnEdicion] = useState(null);
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [soloIncompletos, setSoloIncompletos] = useState(false);
  const [actualizando, setActualizando] = useState(null);

  async function recargar() {
    const data = await obtenerPacientes({ busqueda });
    setPacientes(data);
  }

  useEffect(() => {
    setCargando(true);
    Promise.all([obtenerPacientes({ busqueda }), obtenerProfesionales()])
      .then(([p, prof]) => {
        setPacientes(p);
        setProfesionales(prof);
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

  const resumen = useMemo(() => {
    const total = pacientes.length;
    const conHistorial = pacientes.filter((p) => p.historiaClinicaCompleta).length;
    const conConsentimiento = pacientes.filter((p) => p.consentimientosFirmados).length;
    const completos = pacientes.filter(
      (p) => p.dni && p.celular && p.fechaNacimiento && p.historiaClinicaCompleta && p.consentimientosFirmados
    ).length;
    return { total, conHistorial, conConsentimiento, incompletos: total - completos };
  }, [pacientes]);

  const pacientesMostrados = soloIncompletos
    ? pacientes.filter((p) => !p.historiaClinicaCompleta || !p.consentimientosFirmados)
    : pacientes;

  async function alternarBandera(paciente, campo, e) {
    e.stopPropagation();
    setActualizando(paciente.id);
    setError(null);
    try {
      const nuevoValor = !paciente[campo];
      await actualizarBanderasPaciente(paciente.id, {
        historiaClinicaCompleta: campo === "historiaClinicaCompleta" ? nuevoValor : paciente.historiaClinicaCompleta,
        consentimientosFirmados: campo === "consentimientosFirmados" ? nuevoValor : paciente.consentimientosFirmados,
      });
      setPacientes((ps) => ps.map((p) => (p.id === paciente.id ? { ...p, [campo]: nuevoValor } : p)));
    } catch (err) {
      setError(err.message);
    } finally {
      setActualizando(null);
    }
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alta de Pacientes</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {cargando ? "Cargando..." : `${resumen.total} paciente${resumen.total === 1 ? "" : "s"}${busqueda ? " (filtrado)" : ""}`}
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
            📋 Con historia clínica: {resumen.conHistorial}
          </span>
          <span className="rounded-md bg-sky-50 px-3 py-1.5 font-medium text-sky-700">
            ✍️ Con consentimiento firmado: {resumen.conConsentimiento}
          </span>
          <span className="rounded-md bg-amber-50 px-3 py-1.5 font-medium text-amber-700">
            ⚠️ Les falta información para estar completos: {resumen.incompletos}
          </span>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre, DNI o celular..."
          className="w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-1.5 text-sm text-gray-700">
          <input type="checkbox" checked={soloIncompletos} onChange={(e) => setSoloIncompletos(e.target.checked)} />
          Mostrar solo incompletos
        </label>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-brand-brown text-white">
              <th className="px-3 py-2 text-left font-semibold">Apellido y Nombre</th>
              <th className="px-3 py-2 text-left font-semibold">Edad</th>
              <th className="px-3 py-2 text-left font-semibold">DNI</th>
              <th className="px-3 py-2 text-left font-semibold">Celular</th>
              <th className="px-3 py-2 text-left font-semibold">Cobertura</th>
              <th className="px-3 py-2 text-left font-semibold">Profesional habitual</th>
              <th className="px-3 py-2 text-left font-semibold">Estado</th>
              <th className="px-2 py-2 text-center font-semibold">Historia clínica</th>
              <th className="px-2 py-2 text-center font-semibold">Consentimiento</th>
              <th className="px-3 py-2"></th>
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
            {!cargando && pacientesMostrados.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-4 text-center text-gray-500">
                  No se encontraron pacientes.
                </td>
              </tr>
            )}
            {pacientesMostrados.map((p) => (
              <tr
                key={p.id}
                onClick={() => setPacienteEnEdicion(p)}
                className="cursor-pointer border-t border-gray-100 hover:bg-gray-50"
              >
                <td className="px-3 py-2 font-medium text-gray-900">{p.apellidoYNombre}</td>
                <td className="px-3 py-2 text-gray-600">{calcularEdad(p.fechaNacimiento) ?? "—"}</td>
                <td className="px-3 py-2 text-gray-600">{p.dni || "—"}</td>
                <td className="px-3 py-2 text-gray-600">{p.celular || "—"}</td>
                <td className="px-3 py-2 text-gray-600">
                  {p.tipoPaciente === "Particular" ? "Particular" : `${p.tipoPaciente} · ${p.obraSocial || ""}`}
                </td>
                <td className="px-3 py-2 text-gray-600">{p.profesionalResponsable || "—"}</td>
                <td className="px-3 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.estado === "Activo" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {p.estado}
                  </span>
                </td>
                <td className="px-2 py-2 text-center">
                  <button
                    onClick={(e) => alternarBandera(p, "historiaClinicaCompleta", e)}
                    disabled={actualizando === p.id}
                    title="Marcar historia clínica completa"
                    className="text-lg disabled:opacity-40"
                  >
                    {p.historiaClinicaCompleta ? "✅" : "⬜"}
                  </button>
                </td>
                <td className="px-2 py-2 text-center">
                  <button
                    onClick={(e) => alternarBandera(p, "consentimientosFirmados", e)}
                    disabled={actualizando === p.id}
                    title="Marcar consentimiento firmado"
                    className="text-lg disabled:opacity-40"
                  >
                    {p.consentimientosFirmados ? "✅" : "⬜"}
                  </button>
                </td>
                <td className="px-3 py-2 text-right">
                  <span className="text-xs font-medium text-brand-brown hover:underline">✏️ Editar</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(mostrarNuevo || pacienteEnEdicion) && (
        <PacienteFormModal
          paciente={pacienteEnEdicion}
          profesionales={profesionales}
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
