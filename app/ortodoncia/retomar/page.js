"use client";

import { useEffect, useMemo, useState } from "react";
import SoloDuenaYSecretaria from "@/components/SoloDuenaYSecretaria";
import RegistroRetomar from "@/components/RegistroRetomar";
import { linkWhatsApp } from "@/lib/whatsapp";
import { fechaDeHoyISO } from "@/lib/agenda";
import { marcarAltaPaciente } from "@/lib/data/altasOrtodoncia";
import { ESTADOS_MES, SEGMENTOS, estadoEnElMes, obtenerSeguimientoOrtodoncia } from "@/lib/data/seguimientoOrtodoncia";
import {
  ESTADOS_RETOMAR,
  cambiosDeContacto,
  guardarGestionRetomar,
  guardarWhatsAppPacienteOrtodoncia,
  marcarComoConsulta,
  verificarAntesDeEscribir,
  mensajeAgendarControlOrtodoncia,
  mensajeReprogramarTurnoOrtodoncia,
  mensajeRetomarOrtodoncia,
  obtenerGestionRetomar,
} from "@/lib/data/retomarOrtodoncia";

const NOMBRES_MES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function formatoFecha(fechaISO) {
  if (!fechaISO) return "—";
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}

function nombreMes(claveMes) {
  if (!claveMes) return "—";
  const [anio, mes] = claveMes.split("-");
  return `${NOMBRES_MES[Number(mes) - 1]} ${anio}`;
}

const ESTILO_ESTADO = {
  "Por contactar": "text-red-700",
  "Mensaje enviado": "text-sky-700",
  "Sin respuesta": "text-amber-700",
  "Quiere retomar": "text-emerald-700",
  "Turno agendado": "text-emerald-700",
  "No quiere seguir": "text-gray-500",
  "Ya no es paciente": "text-gray-500",
};

// Los que se alejaron con algún rastro de tratamiento van primero; los "sin ningún movimiento"
// (fichas del traspaso que nunca tuvieron registro) quedan aparte y se muestran si se pide.
// En la lista "sin turno este mes", los que vinieron hace poco (al día) van primero: son los más fáciles de agendar.
const ORDEN_SEGMENTO = {
  [SEGMENTOS.AL_DIA]: 0,
  [SEGMENTOS.SE_ALEJO]: 1,
  [SEGMENTOS.SOLO_CUADERNO]: 2,
  [SEGMENTOS.SIN_MOVIMIENTO]: 3,
};

function tieneWhatsApp(p) {
  return Boolean(p.whatsapp && String(p.whatsapp).trim());
}

function FilaPaciente({ p, gestion, onGuardar, onGuardarWhatsApp, onAlta, onConsulta, elegido, onElegir, modoFaltaron }) {
  const [pidiendoAlta, setPidiendoAlta] = useState(false);
  const [fechaAltaFila, setFechaAltaFila] = useState(fechaDeHoyISO());
  const [dandoAlta, setDandoAlta] = useState(false);
  const estado = gestion?.estado || "Por contactar";
  const [nota, setNota] = useState(gestion?.nota || "");
  const [numero, setNumero] = useState("");
  const [guardando, setGuardando] = useState(false);
  // Si vino hace poco solo falta agendar el control; si se alejó, se le pregunta si quiere retomar.
  // En "No asistieron a su turno" se le ofrece reprogramar el turno que perdió.
  const turnoPerdido = modoFaltaron
    ? p.turnos
        .filter((t) => t.situacion !== "Por venir" && t.situacion !== "Asistió")
        .sort((a, b) => b.fecha.localeCompare(a.fecha))[0] || null
    : null;
  const mensaje = modoFaltaron
    ? mensajeReprogramarTurnoOrtodoncia(p.nombre, turnoPerdido?.fecha)
    : p.segmento === SEGMENTOS.AL_DIA
      ? mensajeAgendarControlOrtodoncia(p.nombre)
      : mensajeRetomarOrtodoncia(p.nombre);
  const link = linkWhatsApp(p.whatsapp, mensaje);

  async function escribir() {
    // Antes de abrir WhatsApp se revisa que siga sin turno ni visita reciente (la lista puede estar desactualizada).
    try {
      const { proximoTurno, ultimaVisita } = await verificarAntesDeEscribir(p.id);
      if (proximoTurno || ultimaVisita) {
        const motivo = proximoTurno
          ? `ya tiene turno el ${formatoFecha(proximoTurno.fecha)}`
          : `ya vino/pagó el ${formatoFecha(ultimaVisita)} (hace menos de 30 días)`;
        if (!window.confirm(`⚠️ ${p.nombre} ${motivo}. Capaz no hace falta escribirle.\n\n¿Escribirle igual?`)) return;
      }
    } catch {
      // Si no se puede verificar, se sigue como siempre.
    }
    window.open(link, "_blank", "noopener,noreferrer");
    // Al abrir el mensaje queda anotado que se le escribió (si todavía no tenía otro estado).
    if (estado === "Por contactar") await onGuardar(p.id, cambiosDeContacto("Mensaje enviado"));
  }

  async function guardarNumero() {
    if (!numero.trim()) return;
    setGuardando(true);
    try {
      await onGuardarWhatsApp(p.id, numero);
      setNumero("");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <tr className="border-t border-gray-100 align-top">
      <td className="px-3 py-2">
        <input type="checkbox" checked={elegido} onChange={() => onElegir(p.id)} aria-label={`Elegir a ${p.nombre}`} />
      </td>
      <td className="px-3 py-2">
        <p className="font-medium text-gray-900">{p.nombre}</p>
        <p className="text-xs text-gray-500">{p.ortodoncista}</p>
      </td>
      <td className="px-3 py-2 text-xs text-gray-600">
        <p>{p.segmento}</p>
        {turnoPerdido && (
          <p className="mt-0.5 font-medium text-amber-700">
            No vino a su turno del {formatoFecha(turnoPerdido.fecha)} ({turnoPerdido.situacion === "Sin marcar" ? "sin marcar" : "No asistió"})
          </p>
        )}
        {p.posibleConsulta && (
          <p className="mt-0.5">
            <span className="rounded bg-violet-100 px-1.5 py-0.5 font-medium text-violet-800" title="No tiene instalación, brackets ni cuota cargados, o solo vino a una consulta">
              posible consulta
            </span>
          </p>
        )}
        {p.proximoTurno && <p className="font-medium text-sky-700">Próximo turno: {formatoFecha(p.proximoTurno)}</p>}
        {p.fechaInstalacion && p.segmento === SEGMENTOS.SIN_MOVIMIENTO && <p className="text-gray-500">Empezó el tratamiento: {nombreMes(p.fechaInstalacion.slice(0, 7))}</p>}
        <p className="text-gray-500">
          {p.ultimaVisita ? `Última visita ${formatoFecha(p.ultimaVisita)}` : p.ultimoMesPago ? `Último pago: ${nombreMes(p.ultimoMesPago)}` : "Sin registros"}
        </p>
      </td>
      <td className="px-3 py-2">
        {p.whatsapp ? (
          <div className="flex flex-col items-start gap-1">
            <span className="text-xs text-gray-600">{p.whatsapp}</span>
            {link ? (
              <button
                onClick={escribir}
                className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700"
              >
                💬 Escribirle
              </button>
            ) : (
              <span className="text-xs text-amber-700">Número no válido</span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <input
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="Cargar número"
              className="w-32 rounded-md border border-gray-300 px-2 py-1 text-xs"
            />
            <button
              onClick={guardarNumero}
              disabled={guardando || !numero.trim()}
              className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
            >
              Guardar
            </button>
          </div>
        )}
      </td>
      <td className="px-3 py-2">
        <select
          value={estado}
          onChange={(e) => onGuardar(p.id, cambiosDeContacto(e.target.value))}
          className={`rounded-md border border-gray-300 px-2 py-1 text-xs font-medium ${ESTILO_ESTADO[estado]}`}
        >
          {ESTADOS_RETOMAR.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        {gestion?.fecha_ultimo_contacto && (
          <p className="mt-1 text-[11px] text-gray-500">Último contacto: {formatoFecha(gestion.fecha_ultimo_contacto)}</p>
        )}
        {pidiendoAlta ? (
          <div className="mt-2 flex flex-col gap-1 rounded-md border border-emerald-300 bg-emerald-50 p-2">
            <label className="flex items-center gap-1 text-[11px] text-emerald-900">
              Fecha del alta
              <input type="date" value={fechaAltaFila} onChange={(e) => setFechaAltaFila(e.target.value)} className="rounded border border-gray-300 px-1 py-0.5 text-[11px]" />
            </label>
            <div className="flex gap-1">
              <button
                disabled={dandoAlta}
                onClick={async () => {
                  setDandoAlta(true);
                  await onAlta(p.id, fechaAltaFila);
                  setDandoAlta(false);
                }}
                className="rounded bg-emerald-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {dandoAlta ? "..." : "Confirmar alta"}
              </button>
              <button onClick={() => setPidiendoAlta(false)} className="rounded border border-gray-300 px-2 py-0.5 text-[11px] text-gray-700 hover:bg-white">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex flex-col items-start gap-1">
          {p.posibleConsulta && (
            <button
              onClick={() => window.confirm(`¿${p.nombre} solo vino a una consulta? Pasa a "Consulta" y sale de esta lista.`) && onConsulta(p.id)}
              className="rounded-md border border-violet-400 px-2 py-1 text-[11px] font-medium text-violet-800 hover:bg-violet-50"
            >
              💬 Es una consulta
            </button>
          )}
          <button
            onClick={() => setPidiendoAlta(true)}
            title="Terminó el tratamiento: pasa a Altas y se le escribe cada 6 meses"
            className="mt-2 rounded-md border border-emerald-400 px-2 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-50"
          >
            🏁 Ya tiene el alta
          </button>
          </div>
        )}
      </td>
      <td className="px-3 py-2">
        <input
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          onBlur={() => nota !== (gestion?.nota || "") && onGuardar(p.id, { estado, nota: nota.trim() || null })}
          placeholder="Nota (ej: viaja, vuelve en marzo)"
          className="w-56 rounded-md border border-gray-300 px-2 py-1 text-xs"
        />
      </td>
    </tr>
  );
}

function PaginaRetomar() {
  const [pacientes, setPacientes] = useState([]);
  const [gestion, setGestion] = useState({});
  const [disponible, setDisponible] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [conWhatsApp, setConWhatsApp] = useState("todos"); // "todos" | "con" | "sin"
  const [soloPosiblesConsultas, setSoloPosiblesConsultas] = useState(false);
  // "mes": activos sin turno ni visita en el mes en curso. "alejados": no vienen hace más de un mes y no tienen turno a futuro.
  // "retomar": fichas activas sin ningún movimiento (ni cobros, ni visitas, ni pagos en el cuaderno).
  const [criterio, setCriterio] = useState("mes");
  // Por defecto se ocultan los que ya tienen turno en un mes que viene: a esos no hace falta escribirles.
  const [sinNingunTurnoFuturo, setSinNingunTurnoFuturo] = useState(true);
  const [estadoElegido, setEstadoElegido] = useState("pendientes");
  const [ortodoncista, setOrtodoncista] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  // Selección para dar de alta a varios a la vez.
  const [elegidos, setElegidos] = useState(new Set());
  const [fechaAlta, setFechaAlta] = useState(fechaDeHoyISO());
  const [dandoDeAlta, setDandoDeAlta] = useState(false);

  function alternarElegido(id) {
    setElegidos((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(id)) nuevo.delete(id);
      else nuevo.add(id);
      return nuevo;
    });
  }

  async function darDeAltaElegidos() {
    if (elegidos.size === 0) return;
    if (!window.confirm(`¿Marcar de alta a ${elegidos.size} paciente${elegidos.size === 1 ? "" : "s"} con fecha ${formatoFecha(fechaAlta)}? Pasan a "Finalizado" y salen de esta lista.`)) return;
    setDandoDeAlta(true);
    setError(null);
    const hechos = [];
    try {
      for (const id of elegidos) {
        await marcarAltaPaciente(id, fechaAlta);
        hechos.push(id);
      }
    } catch (e) {
      setError(`${e.message}${e.message?.includes("fecha_alta") ? " — falta correr la migración 159." : ""}`);
    } finally {
      setPacientes((lista) => lista.map((p) => (hechos.includes(p.id) ? { ...p, estado: "Finalizado" } : p)));
      setElegidos(new Set());
      setDandoDeAlta(false);
    }
  }

  useEffect(() => {
    Promise.all([obtenerSeguimientoOrtodoncia(), obtenerGestionRetomar()])
      .then(([lista, g]) => {
        setPacientes(lista);
        setGestion(g.porPaciente);
        setDisponible(g.disponible);
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  async function guardar(pacienteId, cambios) {
    try {
      const actual = gestion[pacienteId];
      const guardado = await guardarGestionRetomar(pacienteId, { estado: actual?.estado || "Por contactar", ...cambios });
      setGestion((g) => ({ ...g, [pacienteId]: guardado }));
    } catch (e) {
      setError(e.message);
    }
  }

  // Alta de un solo paciente desde su fila: queda Finalizado y sale de esta lista.
  async function darDeAltaUno(pacienteId, fecha) {
    try {
      await marcarAltaPaciente(pacienteId, fecha);
      setPacientes((lista) => lista.map((p) => (p.id === pacienteId ? { ...p, estado: "Finalizado" } : p)));
    } catch (e) {
      setError(`${e.message}${e.message?.includes("fecha_alta") ? " — falta correr la migración 159." : ""}`);
    }
  }

  // Pasar a "Consulta" (uno o varios): salen de las listas de pacientes en tratamiento.
  async function pasarAConsultaUno(pacienteId) {
    try {
      await marcarComoConsulta(pacienteId);
      setPacientes((lista) => lista.map((p) => (p.id === pacienteId ? { ...p, estado: "Consulta" } : p)));
    } catch (e) {
      setError(e.message);
    }
  }

  async function pasarAConsultaElegidos() {
    if (elegidos.size === 0) return;
    if (!window.confirm(`¿Pasar a "Consulta" a ${elegidos.size} paciente${elegidos.size === 1 ? "" : "s"}? Salen de esta lista y de los pacientes en tratamiento.`)) return;
    setDandoDeAlta(true);
    const hechos = [];
    try {
      for (const id of elegidos) {
        await marcarComoConsulta(id);
        hechos.push(id);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setPacientes((lista) => lista.map((p) => (hechos.includes(p.id) ? { ...p, estado: "Consulta" } : p)));
      setElegidos(new Set());
      setDandoDeAlta(false);
    }
  }

  async function guardarWhatsApp(pacienteId, numero) {
    try {
      await guardarWhatsAppPacienteOrtodoncia(pacienteId, numero);
      setPacientes((lista) => lista.map((p) => (p.id === pacienteId ? { ...p, whatsapp: numero.trim() } : p)));
    } catch (e) {
      setError(e.message);
    }
  }

  // A quién escribirle:
  //  · "mes": activos que no vinieron ni tienen turno en el mes en curso (la misma lista de "Sin turno este mes").
  //  · "alejados": activos que no vinieron en el último mes y no tienen turno a futuro.
  const mesActual = fechaDeHoyISO().slice(0, 7);
  const candidatosDe = (crit) =>
    pacientes.filter((p) => {
      if (p.estado !== "Activo") return false;
      if (crit === "retomar") return p.segmento === SEGMENTOS.SIN_MOVIMIENTO && !p.proximoTurno;
      if (crit === "faltaron") return estadoEnElMes(p, mesActual) === ESTADOS_MES.TURNO_SIN_ASISTIR && (!sinNingunTurnoFuturo || !p.proximoTurno);
      if (p.segmento === SEGMENTOS.SIN_MOVIMIENTO) return false; // esas fichas van aparte, en "Para retomar"
      if (crit === "mes") return estadoEnElMes(p, mesActual) === ESTADOS_MES.SIN_TURNO;
      return p.segmento !== SEGMENTOS.AL_DIA && !p.proximoTurno;
    });
  const conteoPestanas = useMemo(
    () => ({
      mes: candidatosDe("mes").length,
      alejados: candidatosDe("alejados").length,
      retomar: candidatosDe("retomar").length,
      faltaron: candidatosDe("faltaron").length,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pacientes, mesActual, sinNingunTurnoFuturo]
  );
  // Cuántos de la lista actual se están ocultando porque ya tienen un turno agendado más adelante.
  const ocultosPorTurnoFuturo = useMemo(
    () =>
      pacientes.filter(
        (p) =>
          p.estado === "Activo" &&
          p.proximoTurno &&
          p.segmento !== SEGMENTOS.SIN_MOVIMIENTO &&
          estadoEnElMes(p, mesActual) === ESTADOS_MES.TURNO_SIN_ASISTIR
      ).length,
    [pacientes, mesActual]
  );
  const estadoDe = (p) => gestion[p.id]?.estado || "Por contactar";
  const baseVisible = useMemo(
    () => candidatosDe(criterio),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pacientes, criterio, mesActual, sinNingunTurnoFuturo]
  );
  const ortodoncistas = useMemo(() => [...new Set(baseVisible.map((p) => p.ortodoncista))].sort((a, b) => a.localeCompare(b, "es")), [baseVisible]);
  const conteoEstados = useMemo(() => {
    const m = {};
    for (const p of baseVisible) m[estadoDe(p)] = (m[estadoDe(p)] || 0) + 1;
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseVisible, gestion]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return baseVisible
      .filter((p) => {
        const e = estadoDe(p);
        if (estadoElegido === "pendientes") return e === "Por contactar" || e === "Sin respuesta";
        return estadoElegido === "todos" || e === estadoElegido;
      })
      .filter((p) => ortodoncista === "todos" || p.ortodoncista === ortodoncista)
      .filter((p) => conWhatsApp === "todos" || (conWhatsApp === "con") === tieneWhatsApp(p))
      .filter((p) => !soloPosiblesConsultas || p.posibleConsulta)
      .filter((p) => !q || p.nombre.toLowerCase().includes(q))
      .sort(
        (a, b) =>
          // En "para retomar" van primero los que tienen WhatsApp (se les puede escribir ya).
          (criterio === "retomar" ? Number(tieneWhatsApp(b)) - Number(tieneWhatsApp(a)) : 0) ||
          ORDEN_SEGMENTO[a.segmento] - ORDEN_SEGMENTO[b.segmento] ||
          (b.ultimoMovimiento || "").localeCompare(a.ultimoMovimiento || "") ||
          a.nombre.localeCompare(b.nombre, "es")
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseVisible, gestion, estadoElegido, ortodoncista, busqueda, conWhatsApp, criterio, soloPosiblesConsultas]);

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">📲 Retomar tratamiento — Ortodoncia</h1>
      <p className="mt-0.5 text-sm text-gray-500">
        {criterio === "mes" ? (
          <>
            Pacientes activos que <strong>no tienen turno ni vinieron en {nombreMes(mesActual)}</strong>. Escribiles para agendarles
            el control (a los que vinieron hace poco) o para ver si quieren retomar (a los que se alejaron), y anotá qué contestaron.
          </>
        ) : criterio === "faltaron" ? (
          <>
            Pacientes activos que <strong>tenían turno en {nombreMes(mesActual)} y no vinieron</strong> (marcados &quot;No asistió&quot; o sin marcar). Escribiles para
            reprogramar el turno y anotá qué contestaron. Si alguno sí vino y no se marcó, marcalo en la agenda y sale de esta lista.
          </>
        ) : criterio === "registro" ? (
          <>Registro de los pacientes a los que se les escribió: cuántos ya tienen turno o ya vinieron.</>
        ) : criterio === "retomar" ? (
          <>
            <strong>Pacientes para retomar tratamiento:</strong> fichas activas que empezaron hace tiempo y de las que no hay ningún cobro,
            visita ni pago registrado. Casi no tienen teléfono cargado: cargalo en cada fila y escribiles para ver si quieren retomar.
          </>
        ) : (
          <>Pacientes activos que no vienen hace más de un mes y no tienen turno a futuro. Escribiles para ver si quieren retomar y anotá qué contestaron.</>
        )}{" "}
        {criterio !== "registro" && (
          <>
            El botón <strong>Escribirle</strong> abre WhatsApp con un mensaje ya armado (lo podés editar antes de enviarlo).
          </>
        )}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap overflow-hidden rounded-md border border-gray-300 text-sm">
          {[
            ["mes", "Sin turno este mes"],
            ["alejados", "Alejados (más de un mes)"],
            ["retomar", "Para retomar tratamiento"],
            ["faltaron", "No asistieron a su turno"],
            ["registro", "📊 Registro de contactados"],
          ].map(([clave, etiqueta]) => (
            <button
              key={clave}
              onClick={() => setCriterio(clave)}
              className={`px-3 py-1.5 ${criterio === clave ? "bg-brand-brown text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
            >
              {etiqueta}
              {conteoPestanas[clave] !== undefined ? ` (${conteoPestanas[clave]})` : ""}
            </button>
          ))}
        </div>
        {criterio === "faltaron" && (
          <label className="flex items-center gap-2 text-sm text-gray-700" title="Saca a los que ya tienen turno en un mes que viene">
            <input type="checkbox" checked={sinNingunTurnoFuturo} onChange={(e) => setSinNingunTurnoFuturo(e.target.checked)} />
            Ocultar los que ya tienen turno más adelante
            {sinNingunTurnoFuturo && ocultosPorTurnoFuturo > 0 && <span className="text-xs text-gray-500">({ocultosPorTurnoFuturo} ocultos)</span>}
          </label>
        )}
      </div>

      {criterio === "registro" ? (
        <RegistroRetomar />
      ) : (
        <>
      {!disponible && (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Falta activar el seguimiento (migración 158). Mientras tanto la lista se ve, pero no se puede guardar a quién se le escribió.
        </div>
      )}
      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      {cargando ? (
        <p className="mt-6 text-sm text-gray-500">Cargando...</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {ESTADOS_RETOMAR.map((e) => (
              <button
                key={e}
                onClick={() => setEstadoElegido(estadoElegido === e ? "pendientes" : e)}
                className={`rounded-full border px-3 py-1 font-medium ${
                  estadoElegido === e ? "border-brand-brown bg-brand-tan/40" : "border-gray-200 bg-white hover:bg-gray-50"
                } ${ESTILO_ESTADO[e]}`}
              >
                {e}: {conteoEstados[e] || 0}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar paciente..."
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
            <select value={estadoElegido} onChange={(e) => setEstadoElegido(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
              <option value="pendientes">Pendientes (por contactar y sin respuesta)</option>
              <option value="todos">Todos</option>
              {ESTADOS_RETOMAR.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
            <select value={ortodoncista} onChange={(e) => setOrtodoncista(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
              <option value="todos">Todos los ortodoncistas</option>
              {ortodoncistas.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-gray-700" title="Fichas sin instalación, brackets ni cuota, o que solo vinieron a una consulta">
              <input type="checkbox" checked={soloPosiblesConsultas} onChange={(e) => setSoloPosiblesConsultas(e.target.checked)} />
              Ver solo las posibles consultas ({baseVisible.filter((p) => p.posibleConsulta).length})
            </label>
            <select value={conWhatsApp} onChange={(e) => setConWhatsApp(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
              <option value="todos">Con y sin WhatsApp</option>
              <option value="con">Solo con WhatsApp</option>
              <option value="sin">Solo sin WhatsApp (hay que conseguir el número)</option>
            </select>
          </div>

          <p className="mt-3 text-sm font-semibold text-gray-700">
            {visibles.length} paciente{visibles.length === 1 ? "" : "s"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm">
            <span className="text-gray-700">
              ¿Alguno ya terminó el tratamiento? Tildalos y marcalos de alta: pasan a la sección <strong>Altas</strong>, donde se les
              escribe cada 6 meses.
            </span>
            <button
              onClick={() => setElegidos(new Set(visibles.map((p) => p.id)))}
              className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-white"
            >
              Tildar todos los que se ven
            </button>
            {elegidos.size > 0 && (
              <>
                <button onClick={() => setElegidos(new Set())} className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-white">
                  Destildar
                </button>
                <label className="flex items-center gap-1.5 text-xs text-gray-700">
                  Fecha del alta
                  <input type="date" value={fechaAlta} onChange={(e) => setFechaAlta(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1 text-xs" />
                </label>
                <button
                  onClick={darDeAltaElegidos}
                  disabled={dandoDeAlta}
                  className="rounded-md bg-brand-brown px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
                >
                  {dandoDeAlta ? "Guardando..." : `🏁 Dar de alta a ${elegidos.size}`}
                </button>
                <button
                  onClick={pasarAConsultaElegidos}
                  disabled={dandoDeAlta}
                  className="rounded-md border border-violet-400 px-3 py-1.5 text-xs font-medium text-violet-800 hover:bg-violet-50 disabled:opacity-50"
                >
                  💬 Pasar a consulta ({elegidos.size})
                </button>
              </>
            )}
          </div>
          <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead>
                <tr className="bg-brand-brown text-white">
                  <th className="w-8 px-3 py-2"></th>
                  <th className="px-3 py-2 text-left font-semibold">Paciente</th>
                  <th className="px-3 py-2 text-left font-semibold">Situación</th>
                  <th className="px-3 py-2 text-left font-semibold">WhatsApp</th>
                  <th className="px-3 py-2 text-left font-semibold">Contacto</th>
                  <th className="px-3 py-2 text-left font-semibold">Nota</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((p) => (
                  <FilaPaciente
                    key={p.id}
                    p={p}
                    gestion={gestion[p.id]}
                    onGuardar={guardar}
                    onGuardarWhatsApp={guardarWhatsApp}
                    onAlta={darDeAltaUno}
                    onConsulta={pasarAConsultaUno}
                    modoFaltaron={criterio === "faltaron"}
                    elegido={elegidos.has(p.id)}
                    onElegir={alternarElegido}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
        </>
      )}
    </main>
  );
}

export default function RetomarOrtodonciaPage() {
  return (
    <SoloDuenaYSecretaria>
      <PaginaRetomar />
    </SoloDuenaYSecretaria>
  );
}
