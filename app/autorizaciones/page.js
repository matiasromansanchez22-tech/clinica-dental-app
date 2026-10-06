"use client";

import { useEffect, useMemo, useState } from "react";
import AutorizacionFormModal from "@/components/AutorizacionFormModal";
import SoloDuenaYSecretaria from "@/components/SoloDuenaYSecretaria";
import { fechaDeHoyISO } from "@/lib/agenda";
import {
  actualizarAutorizacion,
  crearAutorizacion,
  eliminarAutorizacion,
  obtenerAutorizaciones,
  obtenerObrasSocialesDelNomenclador,
} from "@/lib/data/autorizacionesObraSocial";
import { obtenerPacientesActivos } from "@/lib/data/pacientes";

const COLOR_ESTADO = {
  "Para autorizar": "bg-amber-100 text-amber-700",
  Enviada: "bg-sky-100 text-sky-700",
  Autorizada: "bg-emerald-100 text-emerald-700",
};

function formatoFecha(fechaISO) {
  if (!fechaISO) return "";
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}

function diasDesde(fechaISO) {
  const [a, m, d] = fechaISO.split("-").map(Number);
  const [ha, hm, hd] = fechaDeHoyISO().split("-").map(Number);
  return Math.round((new Date(ha, hm - 1, hd) - new Date(a, m - 1, d)) / 86400000);
}

function AutorizacionesContenido() {
  const [items, setItems] = useState([]);
  const [pacientes, setPacientes] = useState([]);
  const [obrasNomenclador, setObrasNomenclador] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [filtro, setFiltro] = useState("Para autorizar");
  const [busqueda, setBusqueda] = useState("");
  const [obraFiltro, setObraFiltro] = useState("");
  const [mostrarNuevo, setMostrarNuevo] = useState(false);
  const [enEdicion, setEnEdicion] = useState(null);
  const [autorizando, setAutorizando] = useState(null);
  const [numeroNuevo, setNumeroNuevo] = useState("");

  async function recargar() {
    setError(null);
    try {
      setItems(await obtenerAutorizaciones());
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    recargar();
    obtenerPacientesActivos().then(setPacientes).catch(() => {});
    obtenerObrasSocialesDelNomenclador().then(setObrasNomenclador).catch(() => {});
  }, []);

  const cantidades = useMemo(() => {
    const c = { "Para autorizar": 0, Enviada: 0, Autorizada: 0 };
    for (const i of items) c[i.estado] = (c[i.estado] || 0) + 1;
    return c;
  }, [items]);

  const obrasEnUso = useMemo(
    () => [...new Set(items.map((i) => i.obraSocial))].sort((a, b) => a.localeCompare(b, "es")),
    [items]
  );

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return items.filter(
      (i) =>
        (filtro === "Todas" || i.estado === filtro) &&
        (!obraFiltro || i.obraSocial === obraFiltro) &&
        (!q ||
          i.pacienteNombre.toLowerCase().includes(q) ||
          i.obraSocial.toLowerCase().includes(q) ||
          (i.numeroAutorizacion || "").toLowerCase().includes(q))
    );
  }, [items, filtro, busqueda, obraFiltro]);

  async function guardar(datos) {
    if (enEdicion) await actualizarAutorizacion(enEdicion.id, datos);
    else await crearAutorizacion(datos);
    await recargar();
    setMostrarNuevo(false);
    setEnEdicion(null);
  }

  async function cambiarEstado(item, cambios) {
    try {
      await actualizarAutorizacion(item.id, { ...item, ...cambios });
      await recargar();
    } catch (e) {
      setError(e.message);
    }
  }

  function marcarEnviada(item) {
    return cambiarEstado(item, { estado: "Enviada", fechaEnvio: fechaDeHoyISO(), fechaAutorizacion: null });
  }

  async function confirmarAutorizada(item) {
    try {
      await actualizarAutorizacion(item.id, {
        ...item,
        estado: "Autorizada",
        fechaEnvio: item.fechaEnvio || fechaDeHoyISO(),
        fechaAutorizacion: fechaDeHoyISO(),
        numeroAutorizacion: numeroNuevo,
      });
      setAutorizando(null);
      setNumeroNuevo("");
      await recargar();
    } catch (e) {
      setError(e.message);
    }
  }

  function volverUnPaso(item) {
    if (item.estado === "Autorizada") return cambiarEstado(item, { estado: "Enviada", fechaAutorizacion: null });
    return cambiarEstado(item, { estado: "Para autorizar", fechaEnvio: null });
  }

  async function borrar(item) {
    if (!window.confirm(`¿Borrar la autorización de ${item.pacienteNombre}?`)) return;
    try {
      await eliminarAutorizacion(item.id);
      await recargar();
    } catch (e) {
      setError(e.message);
    }
  }

  const pestanas = [
    { clave: "Para autorizar", etiqueta: `Para autorizar (${cantidades["Para autorizar"]})` },
    { clave: "Enviada", etiqueta: `Enviadas (${cantidades.Enviada})` },
    { clave: "Autorizada", etiqueta: `Autorizadas (${cantidades.Autorizada})` },
    { clave: "Todas", etiqueta: `Todas (${items.length})` },
  ];

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-900">📋 Autorizaciones de obras sociales</h1>
        <button
          onClick={() => setMostrarNuevo(true)}
          className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark"
        >
          + Nueva ficha
        </button>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Control de las fichas que la obra social tiene que autorizar: cuáles siguen pendientes y cuáles ya están
        autorizadas.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {pestanas.map((p) => (
          <button
            key={p.clave}
            onClick={() => setFiltro(p.clave)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium ${
              filtro === p.clave ? "bg-brand-brown text-white" : "border border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {p.etiqueta}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por paciente, obra social o N° de autorización..."
          className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm"
        />
        <select
          value={obraFiltro}
          onChange={(e) => setObraFiltro(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        >
          <option value="">Todas las obras sociales</option>
          {obrasEnUso.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      <div className="mt-4 flex flex-col gap-3">
        {cargando && <p className="text-sm text-gray-500">Cargando...</p>}
        {!cargando && visibles.length === 0 && (
          <p className="text-sm text-gray-500">
            {items.length === 0 ? "Todavía no hay fichas cargadas." : "No hay fichas con ese filtro."}
          </p>
        )}
        {visibles.map((i) => {
          const dias =
            i.estado === "Para autorizar"
              ? diasDesde(i.fechaPedido)
              : i.estado === "Enviada" && i.fechaEnvio
                ? diasDesde(i.fechaEnvio)
                : null;
          return (
            <div key={i.id} className="rounded-lg border border-gray-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{i.pacienteNombre}</p>
                  <p className="text-xs text-gray-500">
                    {i.obraSocial}
                    {i.numeroAfiliado ? ` · Afiliado ${i.numeroAfiliado}` : ""}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${COLOR_ESTADO[i.estado]}`}>
                  {i.estado}
                </span>
              </div>

              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{i.prestacion}</p>

              <p className="mt-1 text-xs text-gray-400">
                Pedida el {formatoFecha(i.fechaPedido)}
                {i.estado === "Para autorizar" && dias > 0 && ` · hace ${dias} ${dias === 1 ? "día" : "días"}`}
                {i.fechaEnvio && ` · Enviada el ${formatoFecha(i.fechaEnvio)}`}
                {i.estado === "Enviada" && dias > 0 && ` (hace ${dias} ${dias === 1 ? "día" : "días"}, esperando respuesta)`}
                {i.estado === "Autorizada" && (
                  <>
                    {" "}
                    · Autorizada el {formatoFecha(i.fechaAutorizacion)}
                    {i.numeroAutorizacion && ` · N° ${i.numeroAutorizacion}`}
                  </>
                )}
              </p>
              {i.observaciones && <p className="mt-1 text-xs text-gray-400">Nota: {i.observaciones}</p>}

              {autorizando === i.id ? (
                <div className="mt-3 flex flex-wrap items-end gap-2 rounded-md bg-emerald-50 p-3">
                  <label className="flex flex-col gap-1 text-xs text-gray-700">
                    N° de autorización (opcional)
                    <input
                      value={numeroNuevo}
                      onChange={(e) => setNumeroNuevo(e.target.value)}
                      className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </label>
                  <button
                    onClick={() => confirmarAutorizada(i)}
                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                  >
                    Confirmar
                  </button>
                  <button
                    onClick={() => {
                      setAutorizando(null);
                      setNumeroNuevo("");
                    }}
                    className="text-xs text-gray-500 hover:underline"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {i.estado === "Para autorizar" && (
                    <button
                      onClick={() => marcarEnviada(i)}
                      className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700"
                    >
                      📤 Marcar enviada
                    </button>
                  )}
                  {i.estado !== "Autorizada" && (
                    <button
                      onClick={() => {
                        setAutorizando(i.id);
                        setNumeroNuevo("");
                      }}
                      className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                    >
                      ✓ Marcar autorizada
                    </button>
                  )}
                  {i.estado !== "Para autorizar" && (
                    <button onClick={() => volverUnPaso(i)} className="text-xs text-gray-500 hover:underline">
                      {i.estado === "Autorizada" ? "Volver a «Enviada»" : "Volver a «Para autorizar»"}
                    </button>
                  )}
                  <button onClick={() => setEnEdicion(i)} className="text-xs text-blue-600 hover:underline">
                    Editar
                  </button>
                  <button onClick={() => borrar(i)} className="text-xs text-red-600 hover:underline">
                    Borrar
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {(mostrarNuevo || enEdicion) && (
        <AutorizacionFormModal
          autorizacion={enEdicion}
          pacientes={pacientes}
          obrasNomenclador={obrasNomenclador}
          onClose={() => {
            setMostrarNuevo(false);
            setEnEdicion(null);
          }}
          onGuardar={guardar}
        />
      )}
    </main>
  );
}

export default function AutorizacionesPage() {
  return (
    <SoloDuenaYSecretaria>
      <AutorizacionesContenido />
    </SoloDuenaYSecretaria>
  );
}
