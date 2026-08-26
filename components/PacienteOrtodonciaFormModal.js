"use client";

import { useState } from "react";
import { calcularEdad } from "@/lib/ortodoncia";
import { actualizarPacienteOrtodoncia, crearPacienteOrtodoncia } from "@/lib/data/pacientesOrtodoncia";

const TIPOS_BRACKETS = ["Metalicos", "Porcelana"];
const ESTADOS_PACIENTE = ["Activo", "Inactivo", "Finalizado", "Abandonó"];
const FORMAS_PAGO = ["Contado", "2 Cuotas"];

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

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Observaciones clínicas
            <textarea
              value={form.observacionesClinicas}
              onChange={(e) => set("observacionesClinicas", e.target.value)}
              rows={2}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            />
          </label>

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
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-50"
            >
              {guardando ? "Guardando..." : "Guardar paciente"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
