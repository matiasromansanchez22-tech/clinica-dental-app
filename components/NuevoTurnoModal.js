"use client";

import { useMemo, useState } from "react";
import {
  CONSULTORIOS,
  diaSemanaDeFecha,
  generarBloquesHorarios,
  hayConflictoDeHorario,
  NOMBRES_DIA_SEMANA,
  seMuestraEnGrilla,
} from "@/lib/agenda";
import { atiendeEseDia } from "@/lib/data/profesionales";
import { buscarProximosHorariosLibres } from "@/lib/data/buscadorHorario";
import { crearPaciente } from "@/lib/data/pacientes";
import { crearTurnoGeneral, obtenerTurnosGeneralPorFecha } from "@/lib/data/turnosGeneral";

const TIPOS_ATENCION = [
  "Primera consulta",
  "Consulta",
  "Tratamiento",
  "Control",
  "Urgencia",
  "Obra social",
];

const bloques = generarBloquesHorarios("08:00", "20:00", 30);

export default function NuevoTurnoModal({
  fecha,
  consultorioInicial,
  horaInicial,
  profesionales,
  pacientes,
  onClose,
  onCreado,
}) {
  const [fechaLocal, setFechaLocal] = useState(fecha);
  const [consultorio, setConsultorio] = useState(consultorioInicial);
  const [horaInicio, setHoraInicio] = useState(horaInicial);
  const [duracionMin, setDuracionMin] = useState(30);
  const [pacienteNombre, setPacienteNombre] = useState("");
  const [celular, setCelular] = useState("");
  const [profesionalDeTurnoId, setProfesionalDeTurnoId] = useState(profesionales[0]?.id ?? "");
  const [tipoAtencion, setTipoAtencion] = useState("Consulta");
  const [tipoPaciente, setTipoPaciente] = useState("Particular");
  const [obraSocial, setObraSocial] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const [mostrarBuscador, setMostrarBuscador] = useState(false);
  const [preferenciaBusqueda, setPreferenciaBusqueda] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultadosBusqueda, setResultadosBusqueda] = useState(null);

  const diaSemana = diaSemanaDeFecha(fechaLocal);
  const nombreDia = NOMBRES_DIA_SEMANA[diaSemana];

  const profesionalSeleccionado = profesionales.find((p) => p.id === profesionalDeTurnoId);
  const profesionalNoAtiendeEseDia =
    profesionalSeleccionado && !atiendeEseDia(profesionalSeleccionado, diaSemana);

  const pacienteExistente = useMemo(() => {
    const nombreNormalizado = pacienteNombre.trim().toLowerCase();
    if (!nombreNormalizado) return null;
    return pacientes.find((p) => p.apellido_y_nombre.trim().toLowerCase() === nombreNormalizado) ?? null;
  }, [pacienteNombre, pacientes]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg(null);

    if (!pacienteNombre.trim()) {
      setErrorMsg("Falta el nombre del paciente.");
      return;
    }
    if (!profesionalDeTurnoId) {
      setErrorMsg("Falta elegir el profesional.");
      return;
    }

    const turnosDelDia = await obtenerTurnosGeneralPorFecha(fechaLocal);
    const conflicto = hayConflictoDeHorario({
      turnosVisibles: turnosDelDia.filter(seMuestraEnGrilla),
      consultorio,
      profesionalDeTurnoId,
      horaInicio,
      duracionMin,
    });
    if (conflicto) {
      setErrorMsg(
        "Ese horario ya está ocupado en ese consultorio, o el profesional ya tiene otro turno a esa hora. Elegí otro horario."
      );
      return;
    }

    setGuardando(true);
    try {
      let pacienteId = pacienteExistente?.id;
      if (!pacienteId) {
        const nuevoPaciente = await crearPaciente({
          apellidoYNombre: pacienteNombre.trim(),
          celular,
          tipoPaciente,
          obraSocial: tipoPaciente === "Obra Social" ? obraSocial : null,
        });
        pacienteId = nuevoPaciente.id;
      }

      await crearTurnoGeneral({
        fecha: fechaLocal,
        horaInicio,
        duracionMin: Number(duracionMin),
        consultorio,
        pacienteId,
        celular,
        profesionalDeTurnoId,
        tipoAtencion,
        cobertura: tipoPaciente === "Obra Social" ? obraSocial || "Obra social" : "Particular",
        observaciones,
      });

      onCreado();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function buscarHorarios() {
    if (!profesionalDeTurnoId) {
      setErrorMsg("Elegí primero un profesional para poder buscar.");
      return;
    }
    setBuscando(true);
    setErrorMsg(null);
    try {
      const resultados = await buscarProximosHorariosLibres({
        profesionalId: profesionalDeTurnoId,
        duracionMin: Number(duracionMin),
        preferencia: preferenciaBusqueda || null,
      });
      setResultadosBusqueda(resultados);
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setBuscando(false);
    }
  }

  function elegirResultado(r) {
    setFechaLocal(r.fecha);
    setHoraInicio(r.hora);
    setConsultorio(r.consultorio);
    setMostrarBuscador(false);
    setResultadosBusqueda(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Nuevo turno</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            ✕
          </button>
        </div>

        <div className="mb-4 flex items-center gap-2">
          <input
            type="date"
            value={fechaLocal}
            onChange={(e) => setFechaLocal(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
          />
          <span className="text-sm capitalize text-gray-500">{nombreDia}</span>
          <button
            type="button"
            onClick={() => setMostrarBuscador((v) => !v)}
            className="ml-auto text-sm text-blue-600 hover:underline"
          >
            🔍 Buscar próximo horario libre
          </button>
        </div>

        {mostrarBuscador && (
          <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 p-3">
            <p className="mb-2 text-xs text-blue-800">
              Busca en los próximos 30 días según el profesional elegido abajo y su disponibilidad cargada.
            </p>
            <div className="flex items-center gap-2">
              <select
                value={preferenciaBusqueda}
                onChange={(e) => setPreferenciaBusqueda(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="">Mañana o tarde</option>
                <option value="manana">Mañana</option>
                <option value="tarde">Tarde</option>
              </select>
              <button
                type="button"
                onClick={buscarHorarios}
                disabled={buscando}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {buscando ? "Buscando..." : "Buscar"}
              </button>
            </div>

            {resultadosBusqueda && resultadosBusqueda.length === 0 && (
              <p className="mt-2 text-sm text-gray-600">No se encontraron horarios libres en los próximos 30 días.</p>
            )}
            {resultadosBusqueda && resultadosBusqueda.length > 0 && (
              <div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                {resultadosBusqueda.map((r, i) => (
                  <button
                    type="button"
                    key={i}
                    onClick={() => elegirResultado(r)}
                    className="rounded-md border border-blue-300 bg-white px-2 py-1 text-xs text-blue-700 hover:bg-blue-100"
                  >
                    {r.fecha} · {r.hora} · C{r.consultorio}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Consultorio
              <select
                value={consultorio}
                onChange={(e) => setConsultorio(Number(e.target.value))}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              >
                {CONSULTORIOS.map((c) => (
                  <option key={c} value={c}>
                    Consultorio {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Hora
              <select
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              >
                {bloques.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Duración
            <select
              value={duracionMin}
              onChange={(e) => setDuracionMin(Number(e.target.value))}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            >
              {[30, 60, 90, 120].map((min) => (
                <option key={min} value={min}>
                  {min} minutos
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Paciente
            <input
              list="lista-pacientes"
              value={pacienteNombre}
              onChange={(e) => setPacienteNombre(e.target.value)}
              placeholder="Nombre y apellido"
              className="rounded-md border border-gray-300 px-2 py-1.5"
            />
            <datalist id="lista-pacientes">
              {pacientes.map((p) => (
                <option key={p.id} value={p.apellido_y_nombre} />
              ))}
            </datalist>
            {pacienteExistente ? (
              <span className="text-xs text-emerald-600">Paciente ya existente, se va a vincular.</span>
            ) : (
              pacienteNombre.trim() && (
                <span className="text-xs text-blue-600">Es un paciente nuevo, se va a crear su ficha.</span>
              )
            )}
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Celular
            <input
              value={celular}
              onChange={(e) => setCelular(e.target.value)}
              placeholder="341..."
              className="rounded-md border border-gray-300 px-2 py-1.5"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Cobertura
              <select
                value={tipoPaciente}
                onChange={(e) => setTipoPaciente(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              >
                <option value="Particular">Particular</option>
                <option value="Obra Social">Obra Social</option>
              </select>
            </label>
            {tipoPaciente === "Obra Social" && (
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                Obra social
                <input
                  value={obraSocial}
                  onChange={(e) => setObraSocial(e.target.value)}
                  placeholder="Nombre de la obra social"
                  className="rounded-md border border-gray-300 px-2 py-1.5"
                />
              </label>
            )}
          </div>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Profesional de turno
            <select
              value={profesionalDeTurnoId}
              onChange={(e) => setProfesionalDeTurnoId(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            >
              {profesionales.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            {profesionalNoAtiendeEseDia && (
              <span className="text-xs text-amber-600">
                ⚠ Según su disponibilidad cargada, {profesionalSeleccionado.nombre} no atiende los {nombreDia.toLowerCase()}. Podés cargarlo igual si es una excepción.
              </span>
            )}
            {profesionalSeleccionado?.observaciones && (
              <span className="text-xs text-blue-600">ℹ {profesionalSeleccionado.observaciones}</span>
            )}
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Tipo de atención
            <select
              value={tipoAtencion}
              onChange={(e) => setTipoAtencion(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            >
              {TIPOS_ATENCION.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Observaciones
            <textarea
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
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
              {guardando ? "Guardando..." : "Guardar turno"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
