"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SoloDuenaYSecretaria from "@/components/SoloDuenaYSecretaria";
import { linkWhatsApp } from "@/lib/whatsapp";
import { CATEGORIAS } from "@/lib/seguimientoGeneral";
import {
  ESTADOS_SEGUIMIENTO,
  cambiosDeContacto,
  guardarCelularPaciente,
  guardarGestionSeguimiento,
  mensajeSeguimientoGeneral,
  obtenerSeguimientoGeneral,
  proximoTurnoDelPaciente,
} from "@/lib/data/seguimientoGeneral";

// Seguimiento de pacientes de Odontología General: quiénes vinieron a la consulta o empezaron el tratamiento y hoy no tienen próximo turno.
// La lista se arma sola; cada uno trae el mensaje de WhatsApp listo para editar y se anota a quién ya se le escribió y qué contestó.

const pesos = (n) => `$${Math.round(Number(n) || 0).toLocaleString("es-AR")}`;
const fecha = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—");

const ESTILO_CAT = { A: "bg-amber-100 text-amber-900", C: "bg-sky-100 text-sky-900", B: "bg-gray-100 text-gray-800" };
const ESTILO_ESTADO = {
  "Por contactar": "text-red-700",
  "Mensaje enviado": "text-sky-700",
  "Sin respuesta": "text-amber-700",
  "Quiere seguir": "text-emerald-700",
  "Turno agendado": "text-emerald-700",
  "No quiere seguir": "text-gray-500",
  "Ya no es paciente": "text-gray-500",
};

function Tarjeta({ titulo, valor, pie, alerta }) {
  return (
    <div className={`rounded-xl border px-4 py-3 ${alerta ? "border-red-300 bg-red-50" : "border-brand-tan/60 bg-white"}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-brand-brown/70">{titulo}</p>
      <p className={`font-heading text-3xl font-extrabold leading-none ${alerta ? "text-red-700" : "text-brand-charcoal"}`}>{valor}</p>
      {pie && <p className="mt-1 text-xs text-gray-500">{pie}</p>}
    </div>
  );
}

function Fila({ x, onGestion, onCelular }) {
  const estado = x.gestion?.estado || "Por contactar";
  const [mensaje, setMensaje] = useState(() => mensajeSeguimientoGeneral(x));
  const [editando, setEditando] = useState(false);
  const [nota, setNota] = useState(x.gestion?.nota || "");
  const [numero, setNumero] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState(null);
  const temporizador = useRef(null);
  const link = linkWhatsApp(x.celular, mensaje);

  async function escribir() {
    setAviso(null);
    try {
      const turno = await proximoTurnoDelPaciente(x.pacienteId);
      if (turno && !window.confirm(`⚠️ ${x.nombre} ya tiene turno el ${fecha(turno)}. Capaz no hace falta escribirle.\n\n¿Escribirle igual?`)) return;
    } catch {
      // si no se puede verificar, se sigue
    }
    window.open(link, "_blank", "noopener,noreferrer");
    if (estado === "Por contactar") await onGestion(x.pacienteId, cambiosDeContacto("Mensaje enviado"));
  }
  // La nota se guarda sola un momento después de dejar de escribir (y también al salir del campo).
  function cambiarNota(texto) {
    setNota(texto);
    clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => guardarNota(texto), 1000);
  }
  function guardarNota(texto) {
    clearTimeout(temporizador.current);
    if (texto.trim() !== (x.gestion?.nota || "")) onGestion(x.pacienteId, { nota: texto.trim() || null });
  }
  async function copiar() {
    try {
      await navigator.clipboard.writeText(mensaje);
      setAviso("Mensaje copiado");
      setTimeout(() => setAviso(null), 1500);
    } catch {
      window.prompt("Copiá el mensaje:", mensaje);
    }
  }
  async function guardarNumero() {
    if (!numero.trim()) return;
    setOcupado(true);
    try {
      await onCelular(x.pacienteId, numero);
      setNumero("");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <article className="rounded-xl border border-brand-tan/70 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-base font-bold text-gray-900">
            {x.nombre} <span className={`ml-1 rounded-full px-2 py-0.5 align-middle text-xs font-semibold ${ESTILO_CAT[x.categoria]}`}>{CATEGORIAS[x.categoria].corto}</span>
          </p>
          <p className="text-sm text-gray-600">
            {x.profesional ? `${x.profesional.split(" ")[0]} · ` : ""}última visita {fecha(x.ultimaVisita)}
            {x.dias !== null ? ` (hace ${x.dias} días)` : ""}
          </p>
        </div>
        {x.totalPresupuesto > 0 && (
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-gray-500">Presupuesto sin aceptar</p>
            <p className="font-heading text-xl font-extrabold text-brand-green">{pesos(x.totalPresupuesto)}</p>
          </div>
        )}
      </div>

      <div className="mt-1 text-xs text-gray-600">
        {x.presupuestos.length > 0 && <p>Incluye: {[...new Set(x.presupuestos.flatMap((p) => p.items))].slice(0, 5).join(" · ") || "—"}</p>}
        {x.proxima && <p>Lo que sigue: <strong>{x.proxima}</strong></p>}
        {x.ultimaPractica && <p>Última práctica: {x.ultimaPractica}</p>}
      </div>

      {!x.celular ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          <span className="font-semibold">Sin celular cargado.</span>
          <input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Ej: 341 555-1234" className="w-44 rounded-md border border-gray-300 px-2 py-1 text-sm text-gray-900" />
          <button onClick={guardarNumero} disabled={ocupado || !numero.trim()} className="rounded-md bg-brand-green px-3 py-1 text-sm font-semibold text-white disabled:opacity-50">
            Guardar
          </button>
        </div>
      ) : (
        <p className="mt-2 text-sm text-gray-700">📱 {x.celular}{x.celularDeTurno ? <span className="text-xs text-gray-500"> (del último turno)</span> : null}</p>
      )}

      {editando && <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={4} className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={escribir}
          disabled={!link}
          className="rounded-md bg-brand-green px-4 py-1.5 text-sm font-semibold text-white hover:bg-brand-green/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          💬 Escribir por WhatsApp
        </button>
        <button onClick={() => setEditando((e) => !e)} className="rounded-md border border-brand-brown/40 px-3 py-1.5 text-sm font-medium text-brand-brown hover:bg-brand-tan/30">
          {editando ? "Listo" : "✏️ Ver o editar mensaje"}
        </button>
        <button onClick={copiar} className="rounded-md px-2 py-1.5 text-sm text-gray-600 hover:underline">
          Copiar
        </button>
        {aviso && <span className="text-xs font-semibold text-emerald-700">{aviso}</span>}
        <select
          value={estado}
          onChange={(e) => onGestion(x.pacienteId, cambiosDeContacto(e.target.value))}
          className={`ml-auto rounded-md border border-gray-300 px-2 py-1.5 text-sm font-semibold ${ESTILO_ESTADO[estado]}`}
        >
          {ESTADOS_SEGUIMIENTO.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <input
          value={nota}
          onChange={(e) => cambiarNota(e.target.value)}
          onBlur={() => guardarNota(nota)}
          placeholder="Nota (qué contestó, cuándo volver a llamar…)"
          className="w-full rounded-md border border-gray-200 px-2 py-1 text-sm"
        />
        {x.gestion?.fecha_ultimo_contacto && <span className="whitespace-nowrap text-xs text-gray-500">Último contacto {fecha(x.gestion.fecha_ultimo_contacto)}</span>}
      </div>
    </article>
  );
}

function Contenido() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [categoria, setCategoria] = useState("todas");
  const [profesional, setProfesional] = useState("todos");
  const [vista, setVista] = useState("por-contactar");

  const cargar = useCallback(async () => {
    try {
      setDatos(await obtenerSeguimientoGeneral());
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const guardarGestion = useCallback(async (pacienteId, cambios) => {
    setError(null);
    try {
      const g = await guardarGestionSeguimiento(pacienteId, cambios);
      setDatos((d) => ({ ...d, lista: d.lista.map((x) => (x.pacienteId === pacienteId ? { ...x, gestion: g } : x)) }));
    } catch (e) {
      setError(e.message);
    }
  }, []);
  const guardarCelular = useCallback(async (pacienteId, numero) => {
    setError(null);
    try {
      await guardarCelularPaciente(pacienteId, numero);
      setDatos((d) => ({ ...d, lista: d.lista.map((x) => (x.pacienteId === pacienteId ? { ...x, celular: numero.trim(), celularDeTurno: false } : x)) }));
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const profesionales = useMemo(() => [...new Set((datos?.lista || []).map((x) => x.profesional).filter(Boolean))].sort(), [datos]);
  const visibles = useMemo(() => {
    if (!datos) return [];
    return datos.lista.filter((x) => {
      const estado = x.gestion?.estado || "Por contactar";
      if (categoria !== "todas" && x.categoria !== categoria) return false;
      if (profesional !== "todos" && x.profesional !== profesional) return false;
      if (vista === "por-contactar") return estado === "Por contactar";
      if (vista === "contactados") return estado !== "Por contactar";
      if (vista === "sin-celular") return !x.celular;
      return true;
    });
  }, [datos, categoria, profesional, vista]);
  const conteoCat = (c) => (datos?.lista || []).filter((x) => c === "todas" || x.categoria === c).length;
  // Los contadores se calculan sobre la lista en pantalla, así se actualizan apenas se anota un contacto.
  const porContactar = (datos?.lista || []).filter((x) => !x.gestion || x.gestion.estado === "Por contactar").length;
  const contactados = (datos?.lista || []).filter((x) => x.gestion && !["Por contactar", "No quiere seguir", "Ya no es paciente"].includes(x.gestion.estado)).length;

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-brown/70">Odontología General</p>
      <h1 className="font-heading text-3xl font-extrabold text-brand-brown">📲 Seguimiento de pacientes</h1>
      <p className="mt-1 max-w-3xl text-sm text-gray-600">
        Pacientes que vinieron a la consulta o empezaron el tratamiento y <strong>hoy no tienen un próximo turno</strong>. La lista se arma sola. Escribiles de a pocos por día (unos 5) y respondé siempre rápido.
      </p>

      {error && <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
      {datos && !datos.disponible && <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">Falta correr la migración 208 en Supabase para poder anotar a quién se le escribió. La lista se ve igual.</div>}
      {!datos && !error && <p className="mt-4 text-sm text-gray-500">Armando la lista…</p>}

      {datos && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tarjeta titulo="Por contactar" valor={porContactar} alerta={porContactar > 0} />
            <Tarjeta titulo="Ya contactados" valor={contactados} pie={datos.resumen.conTurnoDespues ? `${datos.resumen.conTurnoDespues} ya tienen turno desde el contacto` : undefined} />
            <Tarjeta titulo="En presupuestos sin aceptar" valor={pesos(datos.resumen.montoPendiente)} />
            <Tarjeta titulo="Sin celular" valor={datos.lista.filter((x) => !x.celular).length} alerta={datos.lista.some((x) => !x.celular)} pie="no se les puede escribir" />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <div className="flex overflow-hidden rounded-lg border border-brand-brown/40">
              {[
                ["por-contactar", "Por contactar"],
                ["contactados", "Contactados"],
                ["sin-celular", "Sin celular"],
                ["todos", "Todos"],
              ].map(([k, t]) => (
                <button key={k} onClick={() => setVista(k)} className={`px-3 py-1.5 font-medium ${vista === k ? "bg-brand-green text-white" : "bg-white text-brand-brown hover:bg-brand-tan/30"}`}>
                  {t}
                </button>
              ))}
            </div>
            <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5">
              <option value="todas">Todas las situaciones ({conteoCat("todas")})</option>
              {Object.values(CATEGORIAS).map((c) => (
                <option key={c.clave} value={c.clave}>
                  {c.titulo} ({conteoCat(c.clave)})
                </option>
              ))}
            </select>
            <select value={profesional} onChange={(e) => setProfesional(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5">
              <option value="todos">Todos los profesionales</option>
              {profesionales.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <button onClick={cargar} className="ml-auto rounded-md px-2 py-1.5 text-gray-500 hover:underline">
              Actualizar
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {visibles.length === 0 && <p className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">✅ No hay pacientes en esta vista.</p>}
            {visibles.map((x) => (
              <Fila key={x.pacienteId} x={x} onGestion={guardarGestion} onCelular={guardarCelular} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}

export default function SeguimientoPacientesPage() {
  return (
    <SoloDuenaYSecretaria>
      <Contenido />
    </SoloDuenaYSecretaria>
  );
}
