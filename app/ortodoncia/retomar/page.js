"use client";

import { useEffect, useMemo, useState } from "react";
import SoloDuenaYSecretaria from "@/components/SoloDuenaYSecretaria";
import { linkWhatsApp } from "@/lib/whatsapp";
import { SEGMENTOS, obtenerSeguimientoOrtodoncia } from "@/lib/data/seguimientoOrtodoncia";
import {
  ESTADOS_RETOMAR,
  cambiosDeContacto,
  guardarGestionRetomar,
  guardarWhatsAppPacienteOrtodoncia,
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
const ORDEN_SEGMENTO = {
  [SEGMENTOS.SE_ALEJO]: 0,
  [SEGMENTOS.SOLO_CUADERNO]: 1,
  [SEGMENTOS.SIN_MOVIMIENTO]: 2,
};

function FilaPaciente({ p, gestion, onGuardar, onGuardarWhatsApp }) {
  const estado = gestion?.estado || "Por contactar";
  const [nota, setNota] = useState(gestion?.nota || "");
  const [numero, setNumero] = useState("");
  const [guardando, setGuardando] = useState(false);
  const link = linkWhatsApp(p.whatsapp, mensajeRetomarOrtodoncia(p.nombre));

  async function escribir() {
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
        <p className="font-medium text-gray-900">{p.nombre}</p>
        <p className="text-xs text-gray-500">{p.ortodoncista}</p>
      </td>
      <td className="px-3 py-2 text-xs text-gray-600">
        <p>{p.segmento}</p>
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
  const [incluirSinMovimiento, setIncluirSinMovimiento] = useState(false);
  const [estadoElegido, setEstadoElegido] = useState("pendientes");
  const [ortodoncista, setOrtodoncista] = useState("todos");
  const [busqueda, setBusqueda] = useState("");

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

  async function guardarWhatsApp(pacienteId, numero) {
    try {
      await guardarWhatsAppPacienteOrtodoncia(pacienteId, numero);
      setPacientes((lista) => lista.map((p) => (p.id === pacienteId ? { ...p, whatsapp: numero.trim() } : p)));
    } catch (e) {
      setError(e.message);
    }
  }

  // A quién escribirle: activos que no vinieron en el último mes y no tienen turno a futuro.
  const candidatos = useMemo(
    () => pacientes.filter((p) => p.estado === "Activo" && p.segmento !== SEGMENTOS.AL_DIA && !p.proximoTurno),
    [pacientes]
  );
  const estadoDe = (p) => gestion[p.id]?.estado || "Por contactar";
  const baseVisible = useMemo(
    () => candidatos.filter((p) => incluirSinMovimiento || p.segmento !== SEGMENTOS.SIN_MOVIMIENTO),
    [candidatos, incluirSinMovimiento]
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
      .filter((p) => !q || p.nombre.toLowerCase().includes(q))
      .sort(
        (a, b) =>
          ORDEN_SEGMENTO[a.segmento] - ORDEN_SEGMENTO[b.segmento] ||
          (b.ultimoMovimiento || "").localeCompare(a.ultimoMovimiento || "") ||
          a.nombre.localeCompare(b.nombre, "es")
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseVisible, gestion, estadoElegido, ortodoncista, busqueda]);

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">📲 Retomar tratamiento — Ortodoncia</h1>
      <p className="mt-0.5 text-sm text-gray-500">
        Pacientes activos que no vienen hace más de un mes y no tienen turno a futuro. Escribiles para ver si quieren retomar y
        anotá qué contestaron. El botón <strong>Escribirle</strong> abre WhatsApp con un mensaje ya armado (lo podés editar antes
        de enviarlo).
      </p>

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
            <label className="flex items-center gap-2 text-sm text-gray-700" title="Fichas sin cobros, visitas ni pagos en el cuaderno: suelen ser del traspaso inicial">
              <input type="checkbox" checked={incluirSinMovimiento} onChange={(e) => setIncluirSinMovimiento(e.target.checked)} />
              Incluir fichas sin ningún movimiento ({candidatos.filter((p) => p.segmento === SEGMENTOS.SIN_MOVIMIENTO).length})
            </label>
          </div>

          <p className="mt-3 text-sm font-semibold text-gray-700">
            {visibles.length} paciente{visibles.length === 1 ? "" : "s"}
          </p>
          <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead>
                <tr className="bg-brand-brown text-white">
                  <th className="px-3 py-2 text-left font-semibold">Paciente</th>
                  <th className="px-3 py-2 text-left font-semibold">Situación</th>
                  <th className="px-3 py-2 text-left font-semibold">WhatsApp</th>
                  <th className="px-3 py-2 text-left font-semibold">Contacto</th>
                  <th className="px-3 py-2 text-left font-semibold">Nota</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((p) => (
                  <FilaPaciente key={p.id} p={p} gestion={gestion[p.id]} onGuardar={guardar} onGuardarWhatsApp={guardarWhatsApp} />
                ))}
              </tbody>
            </table>
          </div>
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
