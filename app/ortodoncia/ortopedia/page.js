"use client";

import { useEffect, useMemo, useState } from "react";
import NoContador from "@/components/NoContador";
import PacienteOrtodonciaFormModal from "@/components/PacienteOrtodonciaFormModal";
import { calcularCuotaConAumento, calcularEdad, calcularEstadoAumento, cuotaControlSugerida } from "@/lib/ortodoncia";
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

  const porcentajeAumento = config.aumento_porcentaje ?? 25;

  const resumen = useMemo(() => {
    const activos = pacientes.filter((p) => p.estadoPaciente === "Activo").length;
    return { total: pacientes.length, activos, otros: pacientes.length - activos };
  }, [pacientes]);

  // Igual que en Ortodoncia: cuántos están al día con el aumento de la cuota del control, cuántos lo tienen próximo o vencido.
  const resumenAumento = useMemo(() => {
    const conteo = { "Al día": 0, "Próximo aumento": 0, Aumentar: 0, "Sin definir": 0 };
    for (const p of pacientes) {
      if (p.estadoPaciente !== "Activo") continue;
      conteo[calcularEstadoAumento(p.proximoAumento).texto] += 1;
    }
    return conteo;
  }, [pacientes]);
  const sinCuota = useMemo(() => pacientes.filter((p) => p.estadoPaciente === "Activo" && !Number(p.valorControl)).length, [pacientes]);

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

      {!cargando && !busqueda && (
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <span className="rounded-md bg-emerald-50 px-3 py-1.5 font-medium text-emerald-700">🟢 Al día: {resumenAumento["Al día"]}</span>
          <span className="rounded-md bg-amber-50 px-3 py-1.5 font-medium text-amber-700">🟡 Próximo aumento: {resumenAumento["Próximo aumento"]}</span>
          <span className="rounded-md bg-red-50 px-3 py-1.5 font-medium text-red-700">🔴 Aumentar (vencido): {resumenAumento["Aumentar"]}</span>
          <span className="rounded-md bg-gray-100 px-3 py-1.5 font-medium text-gray-500">⚪ Sin fecha de aumento: {resumenAumento["Sin definir"]}</span>
          {sinCuota > 0 && <span className="rounded-md bg-amber-50 px-3 py-1.5 font-medium text-amber-700">💲 Sin cuota por control cargada: {sinCuota}</span>}
        </div>
      )}

      <input
        type="search"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por nombre o WhatsApp..."
        className="mt-4 w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm"
      />

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead>
            <tr className="bg-brand-brown text-white">
              <th className="px-3 py-2 text-left font-semibold">Paciente</th>
              <th className="px-3 py-2 text-left font-semibold">Edad</th>
              <th className="px-3 py-2 text-left font-semibold">WhatsApp</th>
              <th className="px-3 py-2 text-left font-semibold">Profesional</th>
              <th className="px-3 py-2 text-left font-semibold">Estado</th>
              <th className="px-3 py-2 text-left font-semibold">Próximo turno</th>
              <th className="px-3 py-2 text-left font-semibold">Última visita</th>
              <th className="px-3 py-2 text-right font-semibold">Cuota por control</th>
              <th className="px-3 py-2 text-left font-semibold">Próximo aumento</th>
              <th className="px-3 py-2 text-left font-semibold">Estado del aumento</th>
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
            {!cargando && pacientes.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-4 text-center text-gray-500">
                  {busqueda ? "No se encontraron pacientes de ortopedia con ese nombre." : "Todavía no hay pacientes de ortopedia cargados."}
                </td>
              </tr>
            )}
            {pacientes.map((p) => {
              const aumento = calcularEstadoAumento(p.proximoAumento);
              const cuotaNueva = p.valorControl && (aumento.texto === "Aumentar" || aumento.texto === "Próximo aumento") ? calcularCuotaConAumento(p.valorControl, porcentajeAumento, cuotaControlSugerida(p.tipoBrackets, config)) : null;
              return (
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
                <td className="px-3 py-2 text-right text-gray-600">{p.valorControl ? `$${Number(p.valorControl).toLocaleString("es-AR")}` : "—"}</td>
                <td className="px-3 py-2 tabular-nums text-gray-600">{formatoFecha(p.proximoAumento)}</td>
                <td className={`px-3 py-2 font-medium ${aumento.color}`}>
                  {aumento.emoji} {aumento.texto}
                  {cuotaNueva ? <span className="block text-xs font-normal text-gray-500">cuota nueva ${Number(cuotaNueva).toLocaleString("es-AR")}</span> : null}
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
