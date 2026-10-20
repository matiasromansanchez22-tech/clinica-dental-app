"use client";

import { useEffect, useMemo, useState } from "react";
import SoloDuenaYSecretaria from "@/components/SoloDuenaYSecretaria";
import { linkWhatsApp } from "@/lib/whatsapp";
import { guardarWhatsAppPacienteOrtodoncia, verificarAntesDeEscribir } from "@/lib/data/retomarOrtodoncia";
import {
  ESTADOS_CONSULTA,
  ESTADOS_CONSULTA_ABIERTOS,
  SITUACION_CONSULTA,
  cambiosDeContactoConsulta,
  guardarGestionConsulta,
  mensajeConsultaOrtodoncia,
  obtenerConsultasOrtodoncia,
  pasarAActivo,
} from "@/lib/data/consultasOrtodoncia";

function formatoFecha(fechaISO) {
  if (!fechaISO) return "—";
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}

const ESTILO_ESTADO = {
  "Por contactar": "text-red-700",
  "Mensaje enviado": "text-sky-700",
  "Sin respuesta": "text-amber-700",
  "Lo está pensando": "text-violet-700",
  "Quiere instalar": "text-emerald-700",
  "Instalación agendada": "text-emerald-700",
  "No va a hacer ortodoncia": "text-gray-500",
};

const ESTILO_SITUACION = {
  [SITUACION_CONSULTA.VINO]: "bg-emerald-100 text-emerald-800",
  [SITUACION_CONSULTA.AGENDADA]: "bg-sky-100 text-sky-800",
  [SITUACION_CONSULTA.SIN_MARCAR]: "bg-amber-100 text-amber-800",
  [SITUACION_CONSULTA.CANCELO]: "bg-red-100 text-red-800",
};

function Fila({ c, gestion, onGuardar, onGuardarWhatsApp, onActivo }) {
  const estado = gestion?.estado || "Por contactar";
  const [nota, setNota] = useState(gestion?.nota || "");
  const [numero, setNumero] = useState("");
  const link = linkWhatsApp(c.whatsapp, mensajeConsultaOrtodoncia(c.nombre, c.situacion));

  async function escribir() {
    // Se vuelve a mirar en la base: si ya agendó la instalación o ya está en tratamiento, no hace falta escribirle.
    try {
      const { proximoTurno } = await verificarAntesDeEscribir(c.id);
      if (proximoTurno || c.instalacionAgendada || c.yaEnTratamiento) {
        const motivo = c.instalacionAgendada
          ? `ya tiene la instalación agendada el ${formatoFecha(c.instalacionAgendada)}`
          : proximoTurno
            ? `ya tiene turno el ${formatoFecha(proximoTurno.fecha)}`
            : "parece que ya está en tratamiento";
        if (!window.confirm(`⚠️ ${c.nombre} ${motivo}. Capaz no hace falta escribirle.\n\n¿Escribirle igual?`)) return;
      }
    } catch {
      // Si no se puede verificar, se sigue como siempre.
    }
    window.open(link, "_blank", "noopener,noreferrer");
    if (estado === "Por contactar") await onGuardar(c.id, cambiosDeContactoConsulta("Mensaje enviado"));
  }

  return (
    <tr className="border-t border-gray-100 align-top">
      <td className="px-3 py-2">
        <p className="font-medium text-gray-900">{c.nombre}</p>
        <p className="text-xs text-gray-500">{c.ortodoncista}</p>
      </td>
      <td className="px-3 py-2 text-xs">
        <span className={`rounded px-1.5 py-0.5 font-medium ${ESTILO_SITUACION[c.situacion]}`}>{c.situacion}</span>
        {c.fechaConsulta && (
          <p className="mt-1 text-gray-600">
            {c.situacion === SITUACION_CONSULTA.AGENDADA ? "Consulta el " : c.situacion === SITUACION_CONSULTA.VINO ? "Vino el " : "Consulta del "}
            {formatoFecha(c.fechaConsulta)}
            {c.diasDesdeConsulta !== null && ` (hace ${c.diasDesdeConsulta} d)`}
          </p>
        )}
        {c.instalacionAgendada && <p className="mt-1 font-medium text-emerald-700">Instalación: {formatoFecha(c.instalacionAgendada)}</p>}
        {c.yaEnTratamiento && c.estadoFicha === "Consulta" && (
          <div className="mt-1 rounded border border-violet-300 bg-violet-50 px-1.5 py-1 text-violet-900">
            Ya tuvo un Control: parece que ya está en tratamiento.
            <button
              onClick={() => window.confirm(`¿${c.nombre} ya está en tratamiento? Pasa a "Activo" y sale de esta lista.`) && onActivo(c.id)}
              className="mt-0.5 block font-medium underline"
            >
              Pasar a Activo
            </button>
          </div>
        )}
      </td>
      <td className="px-3 py-2">
        {c.whatsapp ? (
          <div className="flex flex-col items-start gap-1">
            <span className="text-xs text-gray-600">{c.whatsapp}</span>
            {link && (
              <button onClick={escribir} className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700">
                💬 Escribirle
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Cargar número" className="w-32 rounded-md border border-gray-300 px-2 py-1 text-xs" />
            <button
              disabled={!numero.trim()}
              onClick={async () => {
                await onGuardarWhatsApp(c.id, numero);
                setNumero("");
              }}
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
          onChange={(e) => onGuardar(c.id, cambiosDeContactoConsulta(e.target.value))}
          className={`rounded-md border border-gray-300 px-2 py-1 text-xs font-medium ${ESTILO_ESTADO[estado]}`}
        >
          {ESTADOS_CONSULTA.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        {gestion?.fecha_ultimo_contacto && <p className="mt-1 text-[11px] text-gray-500">Último contacto: {formatoFecha(gestion.fecha_ultimo_contacto)}</p>}
      </td>
      <td className="px-3 py-2">
        <input
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          onBlur={() => nota !== (gestion?.nota || "") && onGuardar(c.id, { estado, nota: nota.trim() || null })}
          placeholder="Nota (ej: espera el cobro, lo habla con la mamá)"
          className="w-56 rounded-md border border-gray-300 px-2 py-1 text-xs"
        />
      </td>
    </tr>
  );
}

function Tabla({ lista, gestion, onGuardar, onGuardarWhatsApp, onActivo }) {
  return (
    <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full min-w-[860px] border-collapse text-sm">
        <thead>
          <tr className="bg-brand-brown text-white">
            <th className="px-3 py-2 text-left font-semibold">Paciente</th>
            <th className="px-3 py-2 text-left font-semibold">Consulta</th>
            <th className="px-3 py-2 text-left font-semibold">WhatsApp</th>
            <th className="px-3 py-2 text-left font-semibold">Seguimiento</th>
            <th className="px-3 py-2 text-left font-semibold">Nota</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((c) => (
            <Fila key={c.id} c={c} gestion={gestion[c.id]} onGuardar={onGuardar} onGuardarWhatsApp={onGuardarWhatsApp} onActivo={onActivo} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Una sección con título, una línea que explica qué hacer y su tabla.
function Seccion({ icono, titulo, queHacer, lista, abierta = true, ...resto }) {
  return (
    <details open={abierta} className="mt-6 rounded-lg border border-gray-200 bg-white p-4 [&>summary]:cursor-pointer">
      <summary className="flex flex-wrap items-baseline gap-2 text-base font-bold text-gray-900">
        <span>
          {icono} {titulo}
        </span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">{lista.length}</span>
      </summary>
      <p className="mt-1 text-sm text-gray-600">{queHacer}</p>
      {lista.length === 0 ? (
        <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">✅ No hay nadie en este grupo.</p>
      ) : (
        <Tabla lista={lista} {...resto} />
      )}
    </details>
  );
}

function PaginaConsultas() {
  const [consultas, setConsultas] = useState([]);
  const [gestion, setGestion] = useState({});
  const [disponible, setDisponible] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [estadoElegido, setEstadoElegido] = useState("abiertos");
  const [ortodoncista, setOrtodoncista] = useState("todos");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    obtenerConsultasOrtodoncia()
      .then((r) => {
        setConsultas(r.consultas);
        setGestion(r.porPaciente);
        setDisponible(r.disponible);
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  async function guardar(pacienteId, cambios) {
    try {
      const actual = gestion[pacienteId];
      const guardado = await guardarGestionConsulta(pacienteId, { estado: actual?.estado || "Por contactar", ...cambios });
      setGestion((g) => ({ ...g, [pacienteId]: guardado }));
    } catch (e) {
      setError(e.message);
    }
  }

  async function guardarWhatsApp(pacienteId, numero) {
    try {
      await guardarWhatsAppPacienteOrtodoncia(pacienteId, numero);
      setConsultas((lista) => lista.map((c) => (c.id === pacienteId ? { ...c, whatsapp: numero.trim() } : c)));
    } catch (e) {
      setError(e.message);
    }
  }

  async function activar(pacienteId) {
    try {
      await pasarAActivo(pacienteId);
      setConsultas((lista) => lista.map((c) => (c.id === pacienteId ? { ...c, estadoFicha: "Activo" } : c)));
    } catch (e) {
      setError(e.message);
    }
  }

  const estadoDe = (c) => gestion[c.id]?.estado || "Por contactar";
  // La lista de seguimiento: fichas todavía en "Consulta" (las que pasaron a Activo salen solas, salvo que ya tengan
  // seguimiento guardado: esas se siguen viendo para saber que terminaron agendando).
  const base = useMemo(() => consultas.filter((c) => c.estadoFicha === "Consulta" || Boolean(gestion[c.id])), [consultas, gestion]);
  const ortodoncistas = useMemo(() => [...new Set(base.map((c) => c.ortodoncista))].sort((a, b) => a.localeCompare(b, "es")), [base]);
  const conteo = useMemo(() => {
    const m = {};
    for (const c of base) m[estadoDe(c)] = (m[estadoDe(c)] || 0) + 1;
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, gestion]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return base
      .filter((c) => {
        const e = estadoDe(c);
        if (estadoElegido === "abiertos") return ESTADOS_CONSULTA_ABIERTOS.includes(e) && c.estadoFicha === "Consulta";
        return estadoElegido === "todos" || e === estadoElegido;
      })
      .filter((c) => ortodoncista === "todos" || c.ortodoncista === ortodoncista)
      .filter((c) => !q || c.nombre.toLowerCase().includes(q))
      .sort((a, b) => (b.fechaConsulta || "").localeCompare(a.fechaConsulta || "") || a.nombre.localeCompare(b.nombre, "es"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, gestion, estadoElegido, ortodoncista, busqueda]);

  // Tres grupos según qué hay que hacer con cada uno.
  const escribirAhora = visibles.filter((c) => c.situacion === SITUACION_CONSULTA.VINO);
  const revisar = visibles.filter((c) => c.situacion === SITUACION_CONSULTA.SIN_MARCAR || c.situacion === SITUACION_CONSULTA.CANCELO);
  // Los sin marcar primero (hay que ver si vinieron), después los que cancelaron.
  revisar.sort((a, b) => Number(b.situacion === SITUACION_CONSULTA.SIN_MARCAR) - Number(a.situacion === SITUACION_CONSULTA.SIN_MARCAR));
  const esperando = visibles
    .filter((c) => c.situacion === SITUACION_CONSULTA.AGENDADA)
    .sort((a, b) => (a.fechaConsulta || "").localeCompare(b.fechaConsulta || ""));

  const acciones = { gestion, onGuardar: guardar, onGuardarWhatsApp: guardarWhatsApp, onActivo: activar };

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">🩺 Consultas de Ortodoncia — seguimiento hasta la instalación</h1>
      <p className="mt-0.5 text-sm text-gray-500">
        Pacientes que vinieron (o tenían que venir) a una consulta y todavía no tienen turno de instalación. Cuando les cargan un turno de
        instalación, la ficha pasa sola a &quot;Activo&quot; y sale de esta lista.
      </p>

      {!disponible && (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Falta activar el seguimiento (migración 161). Mientras tanto la lista se ve, pero no se puede guardar a quién se le escribió.
        </div>
      )}
      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      {cargando ? (
        <p className="mt-6 text-sm text-gray-500">Cargando...</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {ESTADOS_CONSULTA.map((e) => (
              <button
                key={e}
                onClick={() => setEstadoElegido(estadoElegido === e ? "abiertos" : e)}
                className={`rounded-full border px-3 py-1 font-medium ${estadoElegido === e ? "border-brand-brown bg-brand-tan/40" : "border-gray-200 bg-white hover:bg-gray-50"} ${ESTILO_ESTADO[e]}`}
              >
                {e}: {conteo[e] || 0}
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar paciente..." className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
            <select value={estadoElegido} onChange={(e) => setEstadoElegido(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
              <option value="abiertos">Por seguir (todavía sin instalación)</option>
              <option value="todos">Todos</option>
              {ESTADOS_CONSULTA.map((e) => (
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
          </div>

          <Seccion
            icono="💬"
            titulo="Escribirles ahora"
            queHacer="Ya vinieron a la consulta. Escribiles para ofrecerles el turno de instalación y anotá qué contestaron."
            lista={escribirAhora}
            {...acciones}
          />
          <Seccion
            icono="🔎"
            titulo="Revisar si vinieron"
            queHacer="Tenían consulta, ya pasó la fecha y nadie marcó si vinieron (o la cancelaron). Fijate en la agenda: si vinieron, marcá que vino y pasan al grupo de arriba; si no, escribiles para darles otra fecha."
            lista={revisar}
            {...acciones}
          />
          <Seccion
            icono="📅"
            titulo="Esperando su consulta"
            queHacer="Tienen la consulta agendada para más adelante. Todavía no hay que escribirles: cuando vengan pasan al primer grupo."
            lista={esperando}
            abierta={false}
            {...acciones}
          />
        </>
      )}
    </main>
  );
}

export default function ConsultasOrtodonciaPage() {
  return (
    <SoloDuenaYSecretaria>
      <PaginaConsultas />
    </SoloDuenaYSecretaria>
  );
}
