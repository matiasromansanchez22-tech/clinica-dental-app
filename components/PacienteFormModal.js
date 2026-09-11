"use client";

import { useEffect, useState } from "react";
import { calcularEdad, formatearDni } from "@/lib/pacientes";
import {
  actualizarPaciente,
  buscarPosiblesDuplicados,
  crearPacienteCompleto,
  crearVinculoFamiliar,
  eliminarPaciente,
  eliminarVinculoFamiliar,
  obtenerFamiliaresDePaciente,
  obtenerPacientes,
  RELACIONES_FAMILIARES,
} from "@/lib/data/pacientes";

const COMO_NOS_CONOCIO = ["Instagram", "Facebook", "Google", "Referido", "Obra Social", "Cartel", "Página Web", "Otro"];
const ESTADO_ADMINISTRATIVO = ["Al Día", "Presupuesto Pendiente", "Plan de Financiación", "Pago Pendiente", "Inactivo"];
const ESTADO_CLINICO = ["Primera Consulta", "En Tratamiento", "En Control", "Tratamiento Finalizado", "Derivado", "Suspendido"];

const VACIO = {
  apellidoYNombre: "",
  dni: "",
  celular: "",
  fechaNacimiento: "",
  tipoPaciente: "Particular",
  obraSocial: "",
  numeroAfiliado: "",
  estado: "Activo",
  email: "",
  direccion: "",
  localidad: "",
  comoNosConocio: "",
  pacienteReferidoPor: "",
  estadoAdministrativo: "",
  estadoClinico: "",
  historiaClinicaCompleta: false,
  consentimientosFirmados: false,
  profesionalResponsableId: "",
};

export default function PacienteFormModal({
  paciente,
  profesionales,
  obrasSocialesSugeridas = [],
  onClose,
  onGuardado,
  onAbrirOtroPaciente,
}) {
  const [form, setForm] = useState(paciente ? mapearAFormulario(paciente) : VACIO);
  const [duplicados, setDuplicados] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [borrando, setBorrando] = useState(false);

  const [familiares, setFamiliares] = useState([]);
  const [mostrarBuscadorFamiliar, setMostrarBuscadorFamiliar] = useState(false);
  const [busquedaFamiliar, setBusquedaFamiliar] = useState("");
  const [resultadosBusquedaFamiliar, setResultadosBusquedaFamiliar] = useState([]);
  const [familiarElegido, setFamiliarElegido] = useState(null);
  const [relacionElegida, setRelacionElegida] = useState(RELACIONES_FAMILIARES[0]);
  const [vinculando, setVinculando] = useState(false);
  const [errorFamiliar, setErrorFamiliar] = useState(null);

  async function recargarFamiliares() {
    if (!paciente) return;
    const data = await obtenerFamiliaresDePaciente(paciente.id);
    setFamiliares(data);
  }

  useEffect(() => {
    recargarFamiliares().catch((e) => setErrorFamiliar(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paciente?.id]);

  useEffect(() => {
    const texto = busquedaFamiliar.trim();
    if (!texto || !paciente) {
      setResultadosBusquedaFamiliar([]);
      return;
    }
    const timeout = setTimeout(() => {
      obtenerPacientes({ busqueda: texto })
        .then((data) =>
          setResultadosBusquedaFamiliar(
            data.filter((p) => p.id !== paciente.id && !familiares.some((f) => f.pacienteId === p.id))
          )
        )
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timeout);
  }, [busquedaFamiliar, paciente, familiares]);

  async function confirmarVinculoFamiliar() {
    if (!familiarElegido) return;
    setVinculando(true);
    setErrorFamiliar(null);
    try {
      await crearVinculoFamiliar(paciente.id, familiarElegido.id, relacionElegida);
      await recargarFamiliares();
      setMostrarBuscadorFamiliar(false);
      setBusquedaFamiliar("");
      setFamiliarElegido(null);
      setResultadosBusquedaFamiliar([]);
    } catch (e) {
      setErrorFamiliar(e.message);
    } finally {
      setVinculando(false);
    }
  }

  async function quitarVinculoFamiliar(vinculoId) {
    if (!window.confirm("¿Sacar este vínculo familiar?")) return;
    try {
      await eliminarVinculoFamiliar(vinculoId);
      await recargarFamiliares();
    } catch (e) {
      setErrorFamiliar(e.message);
    }
  }

  function mapearAFormulario(p) {
    return {
      apellidoYNombre: p.apellidoYNombre || "",
      dni: p.dni || "",
      celular: p.celular || "",
      fechaNacimiento: p.fechaNacimiento || "",
      tipoPaciente: p.tipoPaciente || "Particular",
      obraSocial: p.obraSocial || "",
      numeroAfiliado: p.numeroAfiliado || "",
      estado: p.estado || "Activo",
      email: p.email || "",
      direccion: p.direccion || "",
      localidad: p.localidad || "",
      comoNosConocio: p.comoNosConocio || "",
      pacienteReferidoPor: p.pacienteReferidoPor || "",
      estadoAdministrativo: p.estadoAdministrativo || "",
      estadoClinico: p.estadoClinico || "",
      historiaClinicaCompleta: p.historiaClinicaCompleta || false,
      consentimientosFirmados: p.consentimientosFirmados || false,
      profesionalResponsableId: p.profesionalResponsableId || "",
    };
  }

  function set(campo, valor) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  useEffect(() => {
    const dni = form.dni.trim();
    const celular = form.celular.trim();
    if (!dni && !celular) {
      setDuplicados([]);
      return;
    }
    const timeout = setTimeout(() => {
      buscarPosiblesDuplicados({ dni: dni || null, celular: celular || null, idExcluido: paciente?.id })
        .then(setDuplicados)
        .catch(() => {});
    }, 400);
    return () => clearTimeout(timeout);
  }, [form.dni, form.celular, paciente?.id]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!form.apellidoYNombre.trim()) {
      setError("Falta el nombre del paciente.");
      return;
    }

    setGuardando(true);
    try {
      const datos = { ...form, dni: formatearDni(form.dni) };
      if (paciente) {
        await actualizarPaciente(paciente.id, datos);
      } else {
        await crearPacienteCompleto(datos);
      }
      onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function handleBorrar() {
    if (!window.confirm(`¿Enviar a la papelera de reciclaje a "${paciente.apellidoYNombre}"? Se puede restaurar después.`)) return;
    setBorrando(true);
    setError(null);
    try {
      await eliminarPaciente(paciente.id);
      onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setBorrando(false);
    }
  }

  const edad = calcularEdad(form.fechaNacimiento);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{paciente ? "Editar paciente" : "Nuevo paciente"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            ✕
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        )}

        {duplicados.length > 0 && (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            ⚠ Posible duplicado: ya existe {duplicados.map((d) => d.apellido_y_nombre).join(", ")} con el mismo DNI o celular. Podés guardar igual si son personas distintas.
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 flex flex-col gap-1 text-sm text-gray-700">
              Apellido y Nombre
              <input
                value={form.apellidoYNombre}
                onChange={(e) => set("apellidoYNombre", e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-gray-700">
              DNI
              <input
                value={form.dni}
                onChange={(e) => set("dni", e.target.value)}
                onBlur={(e) => set("dni", formatearDni(e.target.value))}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Celular
              <input
                value={form.celular}
                onChange={(e) => set("celular", e.target.value)}
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

            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Email
              <input
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Localidad
              <input
                value={form.localidad}
                onChange={(e) => set("localidad", e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
            </label>

            <label className="col-span-2 flex flex-col gap-1 text-sm text-gray-700">
              Dirección
              <input
                value={form.direccion}
                onChange={(e) => set("direccion", e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
            </label>
          </div>

          <hr className="border-gray-200" />

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Profesional habitual
              <select
                value={form.profesionalResponsableId}
                onChange={(e) => set("profesionalResponsableId", e.target.value)}
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
              Estado
              <select
                value={form.estado}
                onChange={(e) => set("estado", e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              >
                <option value="Activo">Activo</option>
                <option value="Inactivo">Inactivo</option>
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Tipo de paciente
              <select
                value={form.tipoPaciente}
                onChange={(e) => set("tipoPaciente", e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              >
                <option value="Particular">Particular</option>
                <option value="Obra Social">Obra Social</option>
                <option value="Mixto">Mixto</option>
              </select>
            </label>

            {form.tipoPaciente !== "Particular" && (
              <>
                <label className="flex flex-col gap-1 text-sm text-gray-700">
                  Obra social
                  <input
                    list="obras-sociales-sugeridas"
                    value={form.obraSocial}
                    onChange={(e) => set("obraSocial", e.target.value)}
                    placeholder="Elegí una o escribí una nueva"
                    className="rounded-md border border-gray-300 px-2 py-1.5"
                  />
                  <datalist id="obras-sociales-sugeridas">
                    {obrasSocialesSugeridas.map((o) => (
                      <option key={o} value={o} />
                    ))}
                  </datalist>
                </label>
                <label className="flex flex-col gap-1 text-sm text-gray-700">
                  N.º de afiliado
                  <input
                    value={form.numeroAfiliado}
                    onChange={(e) => set("numeroAfiliado", e.target.value)}
                    className="rounded-md border border-gray-300 px-2 py-1.5"
                  />
                </label>
              </>
            )}
          </div>

          {paciente && (
            <>
              <hr className="border-gray-200" />
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase text-gray-400">Familiares vinculados</p>
                  {!mostrarBuscadorFamiliar && (
                    <button
                      type="button"
                      onClick={() => setMostrarBuscadorFamiliar(true)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      + Vincular familiar
                    </button>
                  )}
                </div>

                {errorFamiliar && <p className="mb-1 text-xs text-red-600">{errorFamiliar}</p>}

                {familiares.length === 0 && !mostrarBuscadorFamiliar && (
                  <p className="text-xs text-gray-400">Todavía no tiene familiares vinculados.</p>
                )}

                <div className="flex flex-col gap-1">
                  {familiares.map((f) => (
                    <div
                      key={f.vinculoId}
                      className="flex items-center justify-between gap-2 rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm"
                    >
                      <button
                        type="button"
                        onClick={() => onAbrirOtroPaciente?.(f.pacienteId)}
                        className="text-left text-blue-700 hover:underline"
                      >
                        {f.nombre} <span className="text-gray-500">({f.relacion})</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => quitarVinculoFamiliar(f.vinculoId)}
                        className="text-xs text-gray-400 hover:text-red-600"
                      >
                        ✕ Quitar
                      </button>
                    </div>
                  ))}
                </div>

                {mostrarBuscadorFamiliar && (
                  <div className="mt-2 flex flex-col gap-2 rounded-md border border-gray-200 p-3">
                    {!familiarElegido ? (
                      <>
                        <input
                          autoFocus
                          value={busquedaFamiliar}
                          onChange={(e) => setBusquedaFamiliar(e.target.value)}
                          placeholder="Buscar paciente por nombre, DNI o celular..."
                          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                        />
                        {resultadosBusquedaFamiliar.length > 0 && (
                          <div className="flex flex-col gap-1">
                            {resultadosBusquedaFamiliar.slice(0, 8).map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => setFamiliarElegido(p)}
                                className="rounded-md px-2 py-1 text-left text-sm hover:bg-gray-100"
                              >
                                {p.apellidoYNombre}
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-gray-900">{familiarElegido.apellidoYNombre}</span>
                        <span className="text-gray-500">es</span>
                        <select
                          value={relacionElegida}
                          onChange={(e) => setRelacionElegida(e.target.value)}
                          className="rounded-md border border-gray-300 px-2 py-1 text-sm"
                        >
                          {RELACIONES_FAMILIARES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                        <span className="text-gray-500">de {form.apellidoYNombre || "este paciente"}</span>
                      </div>
                    )}
                    <div className="flex gap-2">
                      {familiarElegido && (
                        <button
                          type="button"
                          disabled={vinculando}
                          onClick={confirmarVinculoFamiliar}
                          className="rounded-md bg-brand-brown px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
                        >
                          {vinculando ? "Vinculando..." : "Vincular"}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setMostrarBuscadorFamiliar(false);
                          setBusquedaFamiliar("");
                          setFamiliarElegido(null);
                          setResultadosBusquedaFamiliar([]);
                        }}
                        className="rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <hr className="border-gray-200" />

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Estado administrativo
              <select
                value={form.estadoAdministrativo}
                onChange={(e) => set("estadoAdministrativo", e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              >
                <option value="">(sin definir)</option>
                {ESTADO_ADMINISTRATIVO.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Estado clínico
              <select
                value={form.estadoClinico}
                onChange={(e) => set("estadoClinico", e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              >
                <option value="">(sin definir)</option>
                {ESTADO_CLINICO.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm text-gray-700">
              ¿Cómo nos conoció?
              <select
                value={form.comoNosConocio}
                onChange={(e) => set("comoNosConocio", e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              >
                <option value="">(sin definir)</option>
                {COMO_NOS_CONOCIO.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Paciente referido por
              <input
                value={form.pacienteReferidoPor}
                onChange={(e) => set("pacienteReferidoPor", e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
            </label>
          </div>

          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.historiaClinicaCompleta}
                onChange={(e) => set("historiaClinicaCompleta", e.target.checked)}
              />
              Historia clínica completa
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.consentimientosFirmados}
                onChange={(e) => set("consentimientosFirmados", e.target.checked)}
              />
              Consentimientos firmados
            </label>
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            {paciente ? (
              <button
                type="button"
                onClick={handleBorrar}
                disabled={borrando}
                className="text-sm text-red-600 hover:underline disabled:opacity-50"
              >
                {borrando ? "Borrando..." : "🗑️ Borrar paciente"}
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
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
          </div>
        </form>
      </div>
    </div>
  );
}
