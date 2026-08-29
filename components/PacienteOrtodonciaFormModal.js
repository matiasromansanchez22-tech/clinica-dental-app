"use client";

import { useEffect, useState } from "react";
import { calcularEdad } from "@/lib/ortodoncia";
import { actualizarPacienteOrtodoncia, crearPacienteOrtodoncia } from "@/lib/data/pacientesOrtodoncia";
import {
  crearEntradaHistorial,
  eliminarEntradaHistorial,
  obtenerHistorialClinico,
} from "@/lib/data/historialClinicoOrtodoncia";

const TIPOS_BRACKETS = ["Metalicos", "Porcelana"];
const ESTADOS_PACIENTE = ["Activo", "Inactivo", "Finalizado", "Abandonó"];
const FORMAS_PAGO = ["Contado", "2 Cuotas"];
const ORIGENES_PACIENTE = ["Nuevo", "Continuación de otra clínica"];

const VACIO = {
  nombre: "",
  whatsapp: "",
  fechaNacimiento: "",
  fechaInstalacion: "",
  tipoBrackets: "",
  cuotaInicial: "",
  formaPagoInstalacion: "",
  estadoInstalacion: "",
  valorControl: "",
  ortodoncistaId: "",
  estadoPaciente: "Activo",
  ultimoControl: "",
  proximoTurno: "",
  observacionesClinicas: "",
  ultimoAumento: "",
  referidoPor: "",
  email: "",
  origenPaciente: "Nuevo",
  clinicaProcedencia: "",
  historialClinico: "",
  fotografias: "",
  rxInicial: "",
  rx6Meses: "",
  rx12Meses: "",
  consentimiento: "",
  enfermedades: "",
  patologias: "",
  alergias: "",
  medicacion: "",
  atm: "",
};

export default function PacienteOrtodonciaFormModal({ paciente, profesionales, config, onClose, onGuardado }) {
  const [form, setForm] = useState(
    paciente
      ? {
          nombre: paciente.nombre || "",
          whatsapp: paciente.whatsapp || "",
          fechaNacimiento: paciente.fechaNacimiento || "",
          fechaInstalacion: paciente.fechaInstalacion || "",
          tipoBrackets: paciente.tipoBrackets || "",
          cuotaInicial: paciente.cuotaInicial || "",
          formaPagoInstalacion: paciente.formaPagoInstalacion || "",
          estadoInstalacion: paciente.estadoInstalacion || "",
          valorControl: paciente.valorControl || "",
          ortodoncistaId: paciente.ortodoncistaId || "",
          estadoPaciente: paciente.estadoPaciente || "Activo",
          ultimoControl: paciente.ultimoControl || "",
          proximoTurno: paciente.proximoTurno || "",
          observacionesClinicas: paciente.observacionesClinicas || "",
          ultimoAumento: paciente.ultimoAumento || "",
          referidoPor: paciente.referidoPor || "",
          email: paciente.email || "",
          origenPaciente: paciente.origenPaciente || "Nuevo",
          clinicaProcedencia: paciente.clinicaProcedencia || "",
          historialClinico: paciente.historialClinico || "",
          fotografias: paciente.fotografias || "",
          rxInicial: paciente.rxInicial || "",
          rx6Meses: paciente.rx6Meses || "",
          rx12Meses: paciente.rx12Meses || "",
          consentimiento: paciente.consentimiento || "",
          enfermedades: paciente.enfermedades || "",
          patologias: paciente.patologias || "",
          alergias: paciente.alergias || "",
          medicacion: paciente.medicacion || "",
          atm: paciente.atm || "",
        }
      : VACIO
  );
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  function set(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  const edad = calcularEdad(form.fechaNacimiento);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    if (!form.nombre.trim()) {
      setError("Falta el nombre del paciente.");
      return;
    }
    setGuardando(true);
    try {
      const datos = { ...form, mesesEntreAumentos: config.meses_entre_aumentos || 6 };
      if (paciente) {
        await actualizarPacienteOrtodoncia(paciente.id, datos);
      } else {
        await crearPacienteOrtodoncia(datos);
      }
      onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{paciente ? "Editar paciente" : "Nuevo paciente de Ortodoncia"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 flex flex-col gap-1 text-sm text-gray-700">
              Nombre
              <input
                value={form.nombre}
                onChange={(e) => set("nombre", e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              WhatsApp
              <input
                value={form.whatsapp}
                onChange={(e) => set("whatsapp", e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Email
              <input
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Fecha de nacimiento
              <input
                type="date"
                value={form.fechaNacimiento}
                onChange={(e) => set("fechaNacimiento", e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
            </label>
            <div className="flex flex-col gap-1 text-sm text-gray-700">
              Edad
              <div className="rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-gray-500">
                {edad === null ? "—" : `${edad} años`}
              </div>
            </div>
          </div>

          <hr className="border-gray-200" />

          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-gray-400">Ficha médica</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                Enfermedades
                <input
                  value={form.enfermedades}
                  onChange={(e) => set("enfermedades", e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1.5"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                Patologías
                <input
                  value={form.patologias}
                  onChange={(e) => set("patologias", e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1.5"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                Alergias
                <input
                  value={form.alergias}
                  onChange={(e) => set("alergias", e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1.5"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                Medicación
                <input
                  value={form.medicacion}
                  onChange={(e) => set("medicacion", e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1.5"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                ATM
                <input
                  value={form.atm}
                  onChange={(e) => set("atm", e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1.5"
                />
              </label>
            </div>
          </div>

          <hr className="border-gray-200" />

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Origen del paciente
              <select
                value={form.origenPaciente}
                onChange={(e) => set("origenPaciente", e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              >
                {ORIGENES_PACIENTE.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            {form.origenPaciente === "Continuación de otra clínica" && (
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                Clínica de procedencia
                <input
                  value={form.clinicaProcedencia}
                  onChange={(e) => set("clinicaProcedencia", e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1.5"
                />
              </label>
            )}
          </div>

          <hr className="border-gray-200" />

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Ortodoncista
              <select
                value={form.ortodoncistaId}
                onChange={(e) => set("ortodoncistaId", e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              >
                <option value="">(sin asignar)</option>
                {profesionales.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Estado del paciente
              <select
                value={form.estadoPaciente}
                onChange={(e) => set("estadoPaciente", e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              >
                {ESTADOS_PACIENTE.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Tipo de brackets
              <select
                value={form.tipoBrackets}
                onChange={(e) => set("tipoBrackets", e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              >
                <option value="">(sin definir)</option>
                {TIPOS_BRACKETS.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Fecha de instalación
              <input
                type="date"
                value={form.fechaInstalacion}
                onChange={(e) => set("fechaInstalacion", e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Forma de pago instalación
              <select
                value={form.formaPagoInstalacion}
                onChange={(e) => set("formaPagoInstalacion", e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              >
                <option value="">(sin definir)</option>
                {FORMAS_PAGO.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Cuota inicial
              <input
                type="number"
                value={form.cuotaInicial}
                onChange={(e) => set("cuotaInicial", e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Valor del control mensual
              <input
                type="number"
                value={form.valorControl}
                onChange={(e) => set("valorControl", e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Estado de instalación
              <input
                value={form.estadoInstalacion}
                onChange={(e) => set("estadoInstalacion", e.target.value)}
                placeholder="Ej. Pagado"
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
            </label>
          </div>

          <hr className="border-gray-200" />

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Último aumento de cuota
              <input
                type="date"
                value={form.ultimoAumento}
                onChange={(e) => set("ultimoAumento", e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
              <span className="text-xs text-gray-500">
                El próximo aumento se calcula solo ({config.meses_entre_aumentos || 6} meses después).
              </span>
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Último control
              <input
                type="date"
                value={form.ultimoControl}
                onChange={(e) => set("ultimoControl", e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Próximo turno
              <input
                type="date"
                value={form.proximoTurno}
                onChange={(e) => set("proximoTurno", e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Referido por
              <input
                value={form.referidoPor}
                onChange={(e) => set("referidoPor", e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
            </label>
          </div>

          <hr className="border-gray-200" />

          <div>
            <p className="mb-2 text-xs font-semibold uppercase text-gray-400">
              Documentación clínica — dónde está guardada (link de Drive, carpeta, etc.)
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                Historial clínico
                <input
                  value={form.historialClinico}
                  onChange={(e) => set("historialClinico", e.target.value)}
                  placeholder="Link o ubicación"
                  className="rounded-md border border-gray-300 px-2 py-1.5"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                Fotografías
                <input
                  value={form.fotografias}
                  onChange={(e) => set("fotografias", e.target.value)}
                  placeholder="Link o ubicación"
                  className="rounded-md border border-gray-300 px-2 py-1.5"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                RX inicial
                <input
                  value={form.rxInicial}
                  onChange={(e) => set("rxInicial", e.target.value)}
                  placeholder="Link o ubicación"
                  className="rounded-md border border-gray-300 px-2 py-1.5"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                RX 6 meses
                <input
                  value={form.rx6Meses}
                  onChange={(e) => set("rx6Meses", e.target.value)}
                  placeholder="Link o ubicación"
                  className="rounded-md border border-gray-300 px-2 py-1.5"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                RX 12 meses
                <input
                  value={form.rx12Meses}
                  onChange={(e) => set("rx12Meses", e.target.value)}
                  placeholder="Link o ubicación"
                  className="rounded-md border border-gray-300 px-2 py-1.5"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                Consentimiento firmado
                <input
                  value={form.consentimiento}
                  onChange={(e) => set("consentimiento", e.target.value)}
                  placeholder="Link o ubicación"
                  className="rounded-md border border-gray-300 px-2 py-1.5"
                />
              </label>
            </div>
          </div>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Observaciones clínicas
            <textarea
              value={form.observacionesClinicas}
              onChange={(e) => set("observacionesClinicas", e.target.value)}
              rows={2}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            />
          </label>

          {paciente && <HistorialClinicoSeccion pacienteId={paciente.id} profesionales={profesionales} />}

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
            >
              {guardando ? "Guardando..." : "Guardar paciente"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function HistorialClinicoSeccion({ pacienteId, profesionales }) {
  const [entradas, setEntradas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [mostrarNueva, setMostrarNueva] = useState(false);
  const [nueva, setNueva] = useState({ fecha: "", profesionalId: "", nota: "" });
  const [guardando, setGuardando] = useState(false);

  async function cargar() {
    setCargando(true);
    try {
      setEntradas(await obtenerHistorialClinico(pacienteId));
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteId]);

  async function guardarNueva() {
    if (!nueva.fecha || !nueva.nota.trim()) {
      setError("Completá la fecha y la nota.");
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      await crearEntradaHistorial({ pacienteId, ...nueva });
      setNueva({ fecha: "", profesionalId: "", nota: "" });
      setMostrarNueva(false);
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(id) {
    if (!window.confirm("¿Borrar esta entrada del historial?")) return;
    try {
      await eliminarEntradaHistorial(id);
      setEntradas((es) => es.filter((e) => e.id !== id));
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      <hr className="mb-4 border-gray-200" />
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase text-gray-400">Historial clínico</p>
        <button
          type="button"
          onClick={() => setMostrarNueva((v) => !v)}
          className="rounded-md border border-brand-brown/40 px-3 py-1 text-xs font-medium text-brand-brown hover:bg-brand-tan/30"
        >
          + Nuevo historial clínico
        </button>
      </div>

      {error && <p className="mb-2 text-xs text-red-700">{error}</p>}

      {mostrarNueva && (
        <div className="mb-3 flex flex-col gap-2 rounded-md border border-gray-200 bg-gray-50 p-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs text-gray-700">
              Fecha
              <input
                type="date"
                value={nueva.fecha}
                onChange={(e) => setNueva((n) => ({ ...n, fecha: e.target.value }))}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-700">
              Quién lo hizo
              <select
                value={nueva.profesionalId}
                onChange={(e) => setNueva((n) => ({ ...n, profesionalId: e.target.value }))}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="">(sin especificar)</option>
                {profesionales.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1 text-xs text-gray-700">
            Nota
            <textarea
              value={nueva.nota}
              onChange={(e) => setNueva((n) => ({ ...n, nota: e.target.value }))}
              rows={3}
              placeholder="Ej. Niti 0,16 sup + resorte para el 12..."
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setMostrarNueva(false)}
              className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-white"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={guardarNueva}
              disabled={guardando}
              className="rounded-md bg-brand-brown px-3 py-1 text-xs font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
            >
              {guardando ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      )}

      {cargando ? (
        <p className="text-xs text-gray-500">Cargando historial...</p>
      ) : entradas.length === 0 ? (
        <p className="text-xs text-gray-500">Todavía no hay entradas cargadas.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entradas.map((e) => (
            <li key={e.id} className="rounded-md border border-gray-200 px-3 py-2 text-sm">
              <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                <span className="font-medium text-gray-700">
                  {e.fecha}
                  {e.profesional ? ` — ${e.profesional}` : ""}
                </span>
                <button type="button" onClick={() => borrar(e.id)} className="text-red-600 hover:underline">
                  Borrar
                </button>
              </div>
              <p className="whitespace-pre-wrap text-gray-700">{e.nota}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
