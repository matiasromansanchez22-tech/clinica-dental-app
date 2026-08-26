"use client";

import { useEffect, useMemo, useState } from "react";
import {
  diaSemanaDeFecha,
  generarBloquesHorarios,
  hayConflictoDeHorario,
  minutosDesdeHora,
  NOMBRES_DIA_SEMANA,
  seMuestraEnGrilla,
} from "@/lib/agenda";
import { calcularEdad, calcularEstadoAumento } from "@/lib/ortodoncia";
import { atiendeEseDia, obtenerDisponibilidadProfesional } from "@/lib/data/profesionales";
import { buscarProximosHorariosLibresOrtodoncia } from "@/lib/data/buscadorHorarioOrtodoncia";
import { crearPacienteOrtodoncia } from "@/lib/data/pacientesOrtodoncia";
import { crearTurnoOrtodoncia, obtenerTurnosOrtodonciaPorFecha } from "@/lib/data/turnosOrtodoncia";

const CONSULTORIOS_ORTO = [2, 3];
const CONCEPTOS = [
  "Consulta de ortodoncia",
  "Control",
  "Instalación superior",
  "Instalación inferior",
  "Reposición",
  "Retiro",
  "Urgencia",
];
const bloques = generarBloquesHorarios("08:00", "19:30", 15);

export default function NuevoTurnoOrtodonciaModal({
  fecha,
  consultorioInicial,
  horaInicial,
  ortodoncistas,
  pacientes,
  duraciones,
  onClose,
  onCreado,
}) {
  const [fechaLocal, setFechaLocal] = useState(fecha);
  const [consultorio, setConsultorio] = useState(consultorioInicial);
  const [horaInicio, setHoraInicio] = useState(horaInicial);
  const [concepto, setConcepto] = useState("Control");
  const [bracketDespegado, setBracketDespegado] = useState(false);
  const [duracionMin, setDuracionMin] = useState(duraciones["Control"] || 15);
  const [pacienteNombre, setPacienteNombre] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [ortodoncistaId, setOrtodoncistaId] = useState(ortodoncistas[0]?.id ?? "");
  const [valor, setValor] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const [mostrarBuscador, setMostrarBuscador] = useState(false);
  const [preferenciaBusqueda, setPreferenciaBusqueda] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultadosBusqueda, setResultadosBusqueda] = useState(null);

  const [preferenciaHoraria, setPreferenciaHoraria] = useState("");
  const [horasDisponibles, setHorasDisponibles] = useState(null);
  const [calculandoHoras, setCalculandoHoras] = useState(false);

  const diaSemana = diaSemanaDeFecha(fechaLocal);
  const nombreDia = NOMBRES_DIA_SEMANA[diaSemana];

  const ortodoncistaSeleccionado = ortodoncistas.find((p) => p.id === ortodoncistaId);
  const noAtiendeEseDia = ortodoncistaSeleccionado && !atiendeEseDia(ortodoncistaSeleccionado, diaSemana);

  // La duración sale de la config por concepto + 15 min extra si se despegó un bracket.
  useEffect(() => {
    const base = duraciones[concepto] ?? 15;
    setDuracionMin(base + (bracketDespegado ? 15 : 0));
  }, [concepto, bracketDespegado, duraciones]);

  useEffect(() => {
    if (!ortodoncistaId) {
      setHorasDisponibles(null);
      return;
    }
    let cancelado = false;
    setCalculandoHoras(true);
    (async () => {
      try {
        const disponibilidad = await obtenerDisponibilidadProfesional(ortodoncistaId);
        const bloquesDelDia = disponibilidad.filter((d) => d.dia_semana === diaSemana);
        if (bloquesDelDia.length === 0) {
          if (!cancelado) setHorasDisponibles([]);
          return;
        }
        const turnosDelDia = await obtenerTurnosOrtodonciaPorFecha(fechaLocal);
        const turnosVisibles = turnosDelDia.filter(seMuestraEnGrilla);

        const libres = [];
        for (const bloque of bloquesDelDia) {
          const finBloqueMin = minutosDesdeHora(bloque.hora_fin.slice(0, 5));
          const cons = bloque.consultorio || 2;
          for (const hora of generarBloquesHorarios(bloque.hora_inicio.slice(0, 5), bloque.hora_fin.slice(0, 5), 15)) {
            if (minutosDesdeHora(hora) + Number(duracionMin) > finBloqueMin) continue;
            if (preferenciaHoraria === "manana" && minutosDesdeHora(hora) >= 12 * 60) continue;
            if (preferenciaHoraria === "tarde" && minutosDesdeHora(hora) < 12 * 60) continue;

            const conflicto = hayConflictoDeHorario({
              turnosVisibles,
              consultorio: cons,
              profesionalDeTurnoId: ortodoncistaId,
              horaInicio: hora,
              duracionMin: Number(duracionMin),
            });
            if (!conflicto) libres.push({ hora, consultorio: cons });
          }
        }
        if (!cancelado) setHorasDisponibles(libres);
      } catch {
        if (!cancelado) setHorasDisponibles(null);
      } finally {
        if (!cancelado) setCalculandoHoras(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [ortodoncistaId, fechaLocal, duracionMin, preferenciaHoraria, diaSemana]);

  function elegirHoraDisponible(opcion) {
    setHoraInicio(opcion.hora);
    setConsultorio(opcion.consultorio);
  }

  const pacienteExistente = useMemo(() => {
    const nombreNormalizado = pacienteNombre.trim().toLowerCase();
    if (!nombreNormalizado) return null;
    return pacientes.find((p) => p.nombre.trim().toLowerCase() === nombreNormalizado) ?? null;
  }, [pacienteNombre, pacientes]);

  useEffect(() => {
    if (!pacienteExistente) return;
    setWhatsapp(pacienteExistente.whatsapp || "");
    if (pacienteExistente.ortodoncistaId) setOrtodoncistaId(pacienteExistente.ortodoncistaId);
    if (concepto === "Control" && pacienteExistente.valorControl) setValor(pacienteExistente.valorControl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteExistente?.id]);

  async function buscarHorarios() {
    if (!ortodoncistaId) {
      setErrorMsg("Elegí primero un ortodoncista para poder buscar.");
      return;
    }
    setBuscando(true);
    setErrorMsg(null);
    try {
      const resultados = await buscarProximosHorariosLibresOrtodoncia({
        profesionalId: ortodoncistaId,
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

  async function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg(null);

    if (!pacienteNombre.trim()) {
      setErrorMsg("Falta el nombre del paciente.");
      return;
    }
    if (!ortodoncistaId) {
      setErrorMsg("Falta elegir el ortodoncista.");
      return;
    }

    const turnosDelDia = await obtenerTurnosOrtodonciaPorFecha(fechaLocal);
    const conflicto = hayConflictoDeHorario({
      turnosVisibles: turnosDelDia.filter(seMuestraEnGrilla),
      consultorio,
      profesionalDeTurnoId: ortodoncistaId,
      horaInicio,
      duracionMin,
    });
    if (conflicto) {
      setErrorMsg("Ese horario ya está ocupado en ese consultorio, o el ortodoncista ya tiene otro turno a esa hora.");
      return;
    }

    setGuardando(true);
    try {
      let pacienteId = pacienteExistente?.id;
      if (!pacienteId) {
        const nuevoPaciente = await crearPacienteOrtodoncia({
          nombre: pacienteNombre.trim(),
          whatsapp,
          ortodoncistaId,
        });
        pacienteId = nuevoPaciente.id;
      }

      await crearTurnoOrtodoncia({
        fecha: fechaLocal,
        horaInicio,
        duracionMin: Number(duracionMin),
        consultorio,
        pacienteId,
        whatsapp,
        profesionalDeTurnoId: ortodoncistaId,
        concepto,
        valor: valor ? Number(valor) : null,
        observaciones,
      });

      onCreado();
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setGuardando(false);
    }
  }

  const aumento = pacienteExistente?.proximoAumento ? calcularEstadoAumento(pacienteExistente.proximoAumento) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Nuevo turno de Ortodoncia</h2>
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
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{errorMsg}</div>
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
                {CONSULTORIOS_ORTO.map((c) => (
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
            Paciente
            <input
              list="lista-pacientes-orto"
              value={pacienteNombre}
              onChange={(e) => setPacienteNombre(e.target.value)}
              placeholder="Nombre y apellido"
              className="rounded-md border border-gray-300 px-2 py-1.5"
            />
            <datalist id="lista-pacientes-orto">
              {pacientes.map((p) => (
                <option key={p.id} value={p.nombre} />
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

          {pacienteExistente && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
              <p className="mb-1 text-xs font-semibold uppercase text-emerald-700">Ficha del paciente</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                <span>Edad: {pacienteExistente.fechaNacimiento ? `${calcularEdad(pacienteExistente.fechaNacimiento)} años` : "—"}</span>
                <span>WhatsApp: {pacienteExistente.whatsapp || "—"}</span>
                <span>Brackets: {pacienteExistente.tipoBrackets || "—"}</span>
                <span>Ortodoncista habitual: {pacienteExistente.ortodoncista}</span>
                <span>Cuota control: {pacienteExistente.valorControl ? `$${Number(pacienteExistente.valorControl).toLocaleString("es-AR")}` : "—"}</span>
                {aumento && (
                  <span>
                    Aumento: {aumento.emoji} {aumento.texto}
                  </span>
                )}
              </div>
            </div>
          )}

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            WhatsApp
            <input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="341..."
              className="rounded-md border border-gray-300 px-2 py-1.5"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Ortodoncista
            <select
              value={ortodoncistaId}
              onChange={(e) => setOrtodoncistaId(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            >
              {ortodoncistas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            {noAtiendeEseDia && (
              <span className="text-xs text-amber-600">
                ⚠ Según su disponibilidad cargada, {ortodoncistaSeleccionado.nombre} no atiende los{" "}
                {nombreDia.toLowerCase()}. Podés cargarlo igual si es una excepción.
              </span>
            )}
          </label>

          {ortodoncistaId && (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase text-gray-500">
                  Horarios libres de {ortodoncistaSeleccionado?.nombre} este día
                </p>
                <select
                  value={preferenciaHoraria}
                  onChange={(e) => setPreferenciaHoraria(e.target.value)}
                  className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                >
                  <option value="">Mañana o tarde</option>
                  <option value="manana">Mañana</option>
                  <option value="tarde">Tarde</option>
                </select>
              </div>
              {calculandoHoras && <p className="text-xs text-gray-500">Calculando...</p>}
              {!calculandoHoras && horasDisponibles !== null && horasDisponibles.length === 0 && (
                <p className="text-xs text-gray-500">
                  No hay horarios libres calculados para este día. Podés elegir manualmente arriba si es una excepción.
                </p>
              )}
              {!calculandoHoras && horasDisponibles && horasDisponibles.length > 0 && (
                <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
                  {horasDisponibles.map((op, i) => {
                    const elegido = op.hora === horaInicio && op.consultorio === consultorio;
                    return (
                      <button
                        type="button"
                        key={i}
                        onClick={() => elegirHoraDisponible(op)}
                        className={`rounded-md border px-2 py-1 text-xs ${
                          elegido ? "border-gray-900 bg-gray-900 text-white" : "border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        {op.hora} · C{op.consultorio}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Concepto
              <select
                value={concepto}
                onChange={(e) => setConcepto(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              >
                {CONCEPTOS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm text-gray-700">
              Valor
              <input
                type="number"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1.5"
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={bracketDespegado} onChange={(e) => setBracketDespegado(e.target.checked)} />
            Se despegó un bracket (+15 min)
          </label>
          <p className="-mt-2 text-xs text-gray-500">Duración de este turno: {duracionMin} minutos.</p>

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
