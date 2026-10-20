"use client";

import { useEffect, useMemo, useState } from "react";
import SoloDuenaYSecretaria from "@/components/SoloDuenaYSecretaria";
import { fechaDeHoyISO } from "@/lib/agenda";
import { linkWhatsApp } from "@/lib/whatsapp";
import {
  MESES_ENTRE_SEGUIMIENTOS,
  corregirFechaAlta,
  marcarAltaPaciente,
  mensajeSeguimientoAlta,
  obtenerAltas,
  obtenerPacientesParaAlta,
  reactivarPaciente,
  registrarSeguimientoAlta,
} from "@/lib/data/altasOrtodoncia";
import { guardarWhatsAppPacienteOrtodoncia } from "@/lib/data/retomarOrtodoncia";

function formatoFecha(fechaISO) {
  if (!fechaISO) return "—";
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}

function FilaAlta({ a, mostrarAccionEscribir, onCambio, onError }) {
  const [nota, setNota] = useState(a.nota || "");
  const [numero, setNumero] = useState("");
  const [fecha, setFecha] = useState("");
  const link = linkWhatsApp(a.whatsapp, mensajeSeguimientoAlta(a.nombre));

  async function accion(fn) {
    try {
      await fn();
      await onCambio();
    } catch (e) {
      onError(e.message);
    }
  }

  return (
    <tr className="border-t border-gray-100 align-top">
      <td className="px-3 py-2">
        <p className="font-medium text-gray-900">{a.nombre}</p>
        <p className="text-xs text-gray-500">{a.ortodoncista}</p>
      </td>
      <td className="px-3 py-2 text-xs text-gray-600">
        {a.fechaAlta ? (
          <>
            <p>Alta: {formatoFecha(a.fechaAlta)}</p>
            <p>Último mensaje: {formatoFecha(a.ultimoSeguimiento)}</p>
            <p className={a.paraEscribir ? "font-semibold text-red-700" : ""}>Próximo: {formatoFecha(a.proximoSeguimiento)}</p>
          </>
        ) : (
          <div className="flex flex-col gap-1">
            <span className="text-amber-700">Sin fecha de alta</span>
            <div className="flex items-center gap-1">
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="rounded-md border border-gray-300 px-1.5 py-1 text-xs" />
              <button
                disabled={!fecha}
                onClick={() => accion(() => corregirFechaAlta(a.id, fecha))}
                className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
              >
                Guardar
              </button>
            </div>
          </div>
        )}
      </td>
      <td className="px-3 py-2">
        {a.whatsapp ? (
          <div className="flex flex-col items-start gap-1">
            <span className="text-xs text-gray-600">{a.whatsapp}</span>
            {link && (
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-700"
              >
                💬 Escribirle
              </a>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Cargar número" className="w-32 rounded-md border border-gray-300 px-2 py-1 text-xs" />
            <button
              disabled={!numero.trim()}
              onClick={() => accion(() => guardarWhatsAppPacienteOrtodoncia(a.id, numero))}
              className="rounded-md border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50 disabled:opacity-50"
            >
              Guardar
            </button>
          </div>
        )}
      </td>
      <td className="px-3 py-2">
        <input
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Qué contestó (ej: usa retenedor, todo bien)"
          className="w-56 rounded-md border border-gray-300 px-2 py-1 text-xs"
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-col items-start gap-1">
          {mostrarAccionEscribir && (
            <button
              onClick={() => accion(() => registrarSeguimientoAlta(a.id, nota))}
              className="rounded-md bg-brand-brown px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-brown-dark"
            >
              ✅ Ya le escribí
            </button>
          )}
          <button
            onClick={() => window.confirm(`¿${a.nombre} vuelve a tratamiento? Pasa a "Activo".`) && accion(() => reactivarPaciente(a.id))}
            className="text-xs text-gray-500 underline hover:text-gray-700"
          >
            Volvió a tratamiento
          </button>
        </div>
      </td>
    </tr>
  );
}

function TablaAltas({ altas, mostrarAccionEscribir, onCambio, onError }) {
  return (
    <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full min-w-[820px] border-collapse text-sm">
        <thead>
          <tr className="bg-brand-brown text-white">
            <th className="px-3 py-2 text-left font-semibold">Paciente</th>
            <th className="px-3 py-2 text-left font-semibold">Alta y seguimiento</th>
            <th className="px-3 py-2 text-left font-semibold">WhatsApp</th>
            <th className="px-3 py-2 text-left font-semibold">Nota</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {altas.map((a) => (
            <FilaAlta key={`${a.id}-${a.ultimoSeguimiento}-${a.fechaAlta}`} a={a} mostrarAccionEscribir={mostrarAccionEscribir} onCambio={onCambio} onError={onError} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaginaAltas() {
  const [altas, setAltas] = useState([]);
  const [disponible, setDisponible] = useState(true);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [ortodoncista, setOrtodoncista] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [pacientesActivos, setPacientesActivos] = useState([]);
  const [pacienteNuevo, setPacienteNuevo] = useState("");
  const [fechaNueva, setFechaNueva] = useState(fechaDeHoyISO());

  async function recargar() {
    const r = await obtenerAltas();
    setAltas(r.altas);
    setDisponible(r.disponible);
    setPacientesActivos(await obtenerPacientesParaAlta());
  }

  useEffect(() => {
    recargar()
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  const ortodoncistas = useMemo(() => [...new Set(altas.map((a) => a.ortodoncista))].sort((a, b) => a.localeCompare(b, "es")), [altas]);
  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return altas
      .filter((a) => ortodoncista === "todos" || a.ortodoncista === ortodoncista)
      .filter((a) => !q || a.nombre.toLowerCase().includes(q));
  }, [altas, ortodoncista, busqueda]);
  const paraEscribir = filtradas.filter((a) => a.paraEscribir);

  async function marcarNuevaAlta() {
    if (!pacienteNuevo) return;
    try {
      await marcarAltaPaciente(pacienteNuevo, fechaNueva);
      setPacienteNuevo("");
      await recargar();
    } catch (e) {
      setError(`${e.message}${e.message?.includes("fecha_alta") ? " — falta correr la migración 159." : ""}`);
    }
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">🏁 Altas — Ortodoncia</h1>
      <p className="mt-0.5 text-sm text-gray-500">
        Pacientes que terminaron el tratamiento. Cada {MESES_ENTRE_SEGUIMIENTOS} meses (desde el alta o desde el último mensaje) hay que
        escribirles para saber cómo vienen. Al tocar <strong>Ya le escribí</strong> el aviso vuelve a los {MESES_ENTRE_SEGUIMIENTOS} meses.
      </p>

      {!disponible && (
        <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Falta activar las altas (migración 159).
        </div>
      )}
      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      {cargando ? (
        <p className="mt-6 text-sm text-gray-500">Cargando...</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <label className="flex flex-col gap-1 text-xs text-gray-600">
              Marcar un paciente de alta
              <select value={pacienteNuevo} onChange={(e) => setPacienteNuevo(e.target.value)} className="w-64 rounded-md border border-gray-300 px-2 py-1.5 text-sm">
                <option value="">Elegí un paciente en tratamiento...</option>
                {pacientesActivos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-gray-600">
              Fecha del alta
              <input type="date" value={fechaNueva} onChange={(e) => setFechaNueva(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
            </label>
            <button
              onClick={marcarNuevaAlta}
              disabled={!pacienteNuevo}
              className="rounded-md bg-brand-brown px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
            >
              🏁 Dar de alta
            </button>
            <p className="text-xs text-gray-500">
              También se marca solo cuando el ortodoncista indica el alta en la agenda, y de a varios desde <em>Retomar tratamiento</em>.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar paciente..." className="rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
            <select value={ortodoncista} onChange={(e) => setOrtodoncista(e.target.value)} className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
              <option value="todos">Todos los ortodoncistas</option>
              {ortodoncistas.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
            <span className="text-sm text-gray-600">
              {altas.length} dado{altas.length === 1 ? "" : "s"} de alta
            </span>
          </div>

          <h2 className="mt-6 text-sm font-semibold text-gray-700">
            📲 Para escribirles ahora ({paraEscribir.length})
          </h2>
          {paraEscribir.length === 0 ? (
            <p className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              ✅ No hay nadie para escribirle por ahora.
            </p>
          ) : (
            <TablaAltas altas={paraEscribir} mostrarAccionEscribir onCambio={recargar} onError={setError} />
          )}

          <h2 className="mt-8 text-sm font-semibold text-gray-700">Todos los dados de alta ({filtradas.length})</h2>
          <TablaAltas altas={filtradas} onCambio={recargar} onError={setError} />
        </>
      )}
    </main>
  );
}

export default function AltasOrtodonciaPage() {
  return (
    <SoloDuenaYSecretaria>
      <PaginaAltas />
    </SoloDuenaYSecretaria>
  );
}
