"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CONSULTORIOS,
  diaSemanaDeFecha,
  generarBloquesHorarios,
  hayConflictoDeHorario,
  minutosDesdeHora,
  NOMBRES_DIA_SEMANA,
  seMuestraEnGrilla,
} from "@/lib/agenda";
import { atiendeEseDia, obtenerDisponibilidadProfesional } from "@/lib/data/profesionales";
import { buscarProximosHorariosLibres } from "@/lib/data/buscadorHorario";
import { obtenerCatalogo } from "@/lib/data/catalogo";
import { obtenerPrestacionesObraSocial } from "@/lib/data/caja";
import { crearPaciente } from "@/lib/data/pacientes";
import { calcularEdad } from "@/lib/pacientes";
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
const MAX_PRESTACIONES_TURNO = 4;

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

  const [preferenciaHoraria, setPreferenciaHoraria] = useState("");
  const [horasDisponibles, setHorasDisponibles] = useState(null); // null = todavía no calculado / sin filtrar
  const [calculandoHoras, setCalculandoHoras] = useState(false);

  const [catalogoCompleto, setCatalogoCompleto] = useState([]);
  const [prestacionesDisponibles, setPrestacionesDisponibles] = useState([]);
  const [prestacionesTurno, setPrestacionesTurno] = useState([]);

  useEffect(() => {
    obtenerCatalogo().then(setCatalogoCompleto);
  }, []);

  const catalogoPorId = useMemo(() => {
    const mapa = new Map();
    catalogoCompleto.forEach((c) => mapa.set(c.id, c));
    return mapa;
  }, [catalogoCompleto]);

  // Regla del doc 3.1: hasta 4 prestaciones por turno, cada una con su
  // propia duración estimada — según la cobertura, se eligen del Catálogo
  // (Particular) o del Nomenclador de la obra social correspondiente.
  useEffect(() => {
    setPrestacionesTurno([{ itemId: "", prestacion: "", tiempoEstimadoMin: 0 }]);
    if (tipoPaciente === "Particular") {
      setPrestacionesDisponibles(
        catalogoCompleto
          .filter((c) => c.estado === "Activo" && c.particular)
          .map((c) => ({ itemId: c.id, prestacion: c.prestacion, tiempoEstimadoMin: c.tiempo_estimado_min || 0 }))
      );
      return;
    }
    if (tipoPaciente === "Obra Social" && obraSocial) {
      obtenerPrestacionesObraSocial(obraSocial).then((filas) => {
        setPrestacionesDisponibles(
          filas.map((f) => ({
            itemId: f.id,
            prestacion: f.prestacion_os,
            codigo: f.codigo,
            tiempoEstimadoMin: catalogoPorId.get(f.id_catalogo)?.tiempo_estimado_min || 0,
          }))
        );
      });
    } else {
      setPrestacionesDisponibles([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoPaciente, obraSocial, catalogoCompleto]);

  function agregarPrestacionTurno() {
    if (prestacionesTurno.length >= MAX_PRESTACIONES_TURNO) return;
    setPrestacionesTurno((f) => [...f, { itemId: "", prestacion: "", tiempoEstimadoMin: 0 }]);
  }

  function actualizarPrestacionTurno(indice, itemId) {
    const item = prestacionesDisponibles.find((p) => p.itemId === itemId);
    setPrestacionesTurno((filas) => {
      const nuevas = [...filas];
      nuevas[indice] = item
        ? { itemId: item.itemId, prestacion: item.prestacion, tiempoEstimadoMin: item.tiempoEstimadoMin }
        : { itemId: "", prestacion: "", tiempoEstimadoMin: 0 };
      const suma = nuevas.reduce((acc, p) => acc + (Number(p.tiempoEstimadoMin) || 0), 0);
      if (suma > 0) setDuracionMin(suma);
      return nuevas;
    });
  }

  function quitarPrestacionTurno(indice) {
    setPrestacionesTurno((filas) => {
      const nuevas = filas.filter((_, i) => i !== indice);
      const suma = nuevas.reduce((acc, p) => acc + (Number(p.tiempoEstimadoMin) || 0), 0);
      if (suma > 0) setDuracionMin(suma);
      return nuevas;
    });
  }

  const diaSemana = diaSemanaDeFecha(fechaLocal);
  const nombreDia = NOMBRES_DIA_SEMANA[diaSemana];

  const profesionalSeleccionado = profesionales.find((p) => p.id === profesionalDeTurnoId);
  const profesionalNoAtiendeEseDia =
    profesionalSeleccionado && !atiendeEseDia(profesionalSeleccionado, diaSemana);

  // Regla del doc 3.1: mostrar solo los horarios realmente libres de ese
  // profesional ese día (según su disponibilidad cargada), para que no se
  // pisen turnos ni se sobrecargue la sala de espera.
  useEffect(() => {
    if (!profesionalDeTurnoId) {
      setHorasDisponibles(null);
      return;
    }
    let cancelado = false;
    setCalculandoHoras(true);
    (async () => {
      try {
        const disponibilidad = await obtenerDisponibilidadProfesional(profesionalDeTurnoId);
        const bloquesDelDia = disponibilidad.filter((d) => d.dia_semana === diaSemana);
        if (bloquesDelDia.length === 0) {
          if (!cancelado) setHorasDisponibles([]);
          return;
        }

        const turnosDelDia = await obtenerTurnosGeneralPorFecha(fechaLocal);
        const turnosVisibles = turnosDelDia.filter(seMuestraEnGrilla);

        const libres = [];
        for (const bloque of bloquesDelDia) {
          const finBloqueMin = minutosDesdeHora(bloque.hora_fin.slice(0, 5));
          for (const hora of generarBloquesHorarios(bloque.hora_inicio.slice(0, 5), bloque.hora_fin.slice(0, 5), 30)) {
            if (minutosDesdeHora(hora) + Number(duracionMin) > finBloqueMin) continue;
            if (preferenciaHoraria === "manana" && minutosDesdeHora(hora) >= 12 * 60) continue;
            if (preferenciaHoraria === "tarde" && minutosDesdeHora(hora) < 12 * 60) continue;

            const conflicto = hayConflictoDeHorario({
              turnosVisibles,
              consultorio: bloque.consultorio,
              profesionalDeTurnoId,
              horaInicio: hora,
              duracionMin: Number(duracionMin),
            });
            if (!conflicto) libres.push({ hora, consultorio: bloque.consultorio });
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
  }, [profesionalDeTurnoId, fechaLocal, duracionMin, preferenciaHoraria, diaSemana]);

  function elegirHoraDisponible(opcion) {
    setHoraInicio(opcion.hora);
    setConsultorio(opcion.consultorio);
  }

  const pacienteExistente = useMemo(() => {
    const nombreNormalizado = pacienteNombre.trim().toLowerCase();
    if (!nombreNormalizado) return null;
    return pacientes.find((p) => p.apellido_y_nombre.trim().toLowerCase() === nombreNormalizado) ?? null;
  }, [pacienteNombre, pacientes]);

  // Al encontrar un paciente ya cargado, completar solo lo que ya sabemos de
  // su ficha (celular, cobertura, profesional habitual), para no volver a
  // preguntarle a la secretaria datos que ya están en Alta de Pacientes.
  useEffect(() => {
    if (!pacienteExistente) return;
    setCelular(pacienteExistente.celular || "");
    if (pacienteExistente.tipo_paciente === "Obra Social") {
      setTipoPaciente("Obra Social");
      setObraSocial(pacienteExistente.obra_social || "");
    } else {
      setTipoPaciente("Particular");
      setObraSocial(pacienteExistente.obra_social || "");
    }
    // No autocompletar el profesional de turno con el "habitual" del
    // paciente: son dos cosas distintas (a quién pertenece la ficha vs.
    // quién lo atiende hoy), y forzarlo acá generaba falsos choques de
    // horario cuando el habitual estaba ocupado pero hoy lo atendía otro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteExistente?.id]);

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
        profesionalResponsableId: pacienteExistente?.profesional_responsable_id || null,
        tipoAtencion,
        cobertura: tipoPaciente === "Obra Social" ? obraSocial || "Obra social" : "Particular",
        prestaciones: prestacionesTurno
          .filter((p) => p.itemId)
          .map((p) => ({ prestacion: p.prestacion, tiempoEstimadoMin: p.tiempoEstimadoMin })),
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
          <div className="mb-4 rounded-md border border-brand-mint/40 bg-brand-mint/15 p-3">
            <p className="mb-2 text-xs text-brand-green">
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

          {pacienteExistente && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
              <p className="mb-1 text-xs font-semibold uppercase text-emerald-700">Ficha del paciente</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                <span>DNI: {pacienteExistente.dni || "—"}</span>
                <span>
                  Edad: {pacienteExistente.fecha_nacimiento ? `${calcularEdad(pacienteExistente.fecha_nacimiento)} años` : "—"}
                </span>
                <span>Celular: {pacienteExistente.celular || "—"}</span>
                <span>
                  Cobertura: {pacienteExistente.tipo_paciente}
                  {pacienteExistente.obra_social ? ` · ${pacienteExistente.obra_social}` : ""}
                </span>
                {pacienteExistente.numero_afiliado && <span>N.º afiliado: {pacienteExistente.numero_afiliado}</span>}
                <span>Profesional habitual: {pacienteExistente.profesional_responsable?.nombre || "—"}</span>
                {pacienteExistente.localidad && <span>Localidad: {pacienteExistente.localidad}</span>}
                {pacienteExistente.email && <span>Email: {pacienteExistente.email}</span>}
                {pacienteExistente.estado_administrativo && (
                  <span>Estado administrativo: {pacienteExistente.estado_administrativo}</span>
                )}
                {pacienteExistente.estado_clinico && <span>Estado clínico: {pacienteExistente.estado_clinico}</span>}
              </div>
            </div>
          )}

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

          <div>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase text-gray-400">
                Prestaciones (hasta {MAX_PRESTACIONES_TURNO}) — a qué viene
              </p>
              {prestacionesTurno.length < MAX_PRESTACIONES_TURNO && (
                <button type="button" onClick={agregarPrestacionTurno} className="text-xs text-blue-600 hover:underline">
                  + Agregar
                </button>
              )}
            </div>
            {tipoPaciente === "Obra Social" && !obraSocial && (
              <p className="text-xs text-gray-500">Completá la obra social para ver sus prestaciones.</p>
            )}
            <div className="flex flex-col gap-2">
              {prestacionesTurno.map((fila, i) => (
                <div key={i} className="flex items-center gap-2">
                  {tipoPaciente === "Obra Social" && (
                    <input
                      type="text"
                      placeholder="Código"
                      title="Escribí el código que te pasó el profesional y se elige sola la prestación"
                      onChange={(e) => {
                        const codigo = e.target.value.trim();
                        if (!codigo) return;
                        const item = prestacionesDisponibles.find((p) => p.codigo === codigo);
                        if (item) {
                          actualizarPrestacionTurno(i, item.itemId);
                          e.target.value = "";
                        }
                      }}
                      className="w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  )}
                  <select
                    value={fila.itemId}
                    onChange={(e) => actualizarPrestacionTurno(i, e.target.value)}
                    className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  >
                    <option value="">(elegir prestación)</option>
                    {prestacionesDisponibles.map((p) => (
                      <option key={p.itemId} value={p.itemId}>
                        {p.prestacion}
                      </option>
                    ))}
                  </select>
                  <span className="w-16 text-right text-xs text-gray-500">
                    {fila.tiempoEstimadoMin ? `${fila.tiempoEstimadoMin} min` : ""}
                  </span>
                  <button type="button" onClick={() => quitarPrestacionTurno(i)} className="text-gray-400 hover:text-red-600">
                    ✕
                  </button>
                </div>
              ))}
            </div>
            {prestacionesTurno.some((p) => p.tiempoEstimadoMin > 0) && (
              <p className="mt-1 text-xs text-gray-500">
                Duración sugerida según las prestaciones:{" "}
                {prestacionesTurno.reduce((acc, p) => acc + (Number(p.tiempoEstimadoMin) || 0), 0)} min (ya aplicada
                abajo, la podés cambiar si hace falta).
              </p>
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

          {profesionalDeTurnoId && (
            <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase text-gray-500">
                  Horarios libres de {profesionalSeleccionado?.nombre} este día
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
                  No hay horarios libres calculados para este día (no atiende, o ya está todo ocupado). Podés elegir
                  la hora y el consultorio manualmente arriba si es una excepción.
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
                          elegido
                            ? "border-gray-900 bg-brand-brown text-white"
                            : "border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
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
              className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
            >
              {guardando ? "Guardando..." : "Guardar turno"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
