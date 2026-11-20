"use client";

import { useEffect, useMemo, useState } from "react";
import AutorizacionFormModal from "@/components/AutorizacionFormModal";
import SoloDuenaYSecretaria from "@/components/SoloDuenaYSecretaria";
import { useAuth } from "@/lib/auth/AuthProvider";
import { enviarAviso } from "@/lib/data/avisos";
import { fechaDeHoyISO } from "@/lib/agenda";
import {
  actualizarAutorizacion,
  crearAutorizacion,
  eliminarAutorizacion,
  obtenerAutorizaciones,
  obtenerCoberturasDeAgenda,
  obtenerObrasSocialesDelNomenclador,
  subirFichaAutorizacion,
  urlDeFicha,
} from "@/lib/data/autorizacionesObraSocial";
import { obtenerPacientesActivos } from "@/lib/data/pacientes";
import { eliminarComprobante } from "@/lib/data/comprobantes";

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

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const mesDeIso = (iso) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).slice(0, 7);
const horaDeIso = (iso) => new Date(iso).toLocaleTimeString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit" });
const diaDeIso = (iso) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
function sumarMes(mes, n) {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(a, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
const nombreMes = (mes) => `${MESES[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`;

async function abrirFicha(item, alError) {
  try {
    window.open(await urlDeFicha(item), "_blank", "noopener,noreferrer");
  } catch (e) {
    alError(e.message);
  }
}

// Resumen del mes: una frase arriba y una cortina por persona con las fichas que cargó.
function ResumenFichas({ items, alError }) {
  const mesActual = fechaDeHoyISO().slice(0, 7);
  const [mes, setMes] = useState(mesActual);
  const [abiertos, setAbiertos] = useState(() => new Set());
  const cargadas = useMemo(() => items.filter((i) => i.creadaEn && mesDeIso(i.creadaEn) === mes), [items, mes]);
  const personas = useMemo(() => {
    const mapa = new Map();
    for (const i of cargadas) {
      const clave = i.creadoPorId || "sin";
      if (!mapa.has(clave)) mapa.set(clave, { clave, nombre: i.creadoPor || "(sin dato)", fichas: [] });
      mapa.get(clave).fichas.push(i);
    }
    return [...mapa.values()].sort((a, b) => b.fichas.length - a.fichas.length);
  }, [cargadas]);
  const paraAutorizar = items.filter((i) => i.estado === "Para autorizar");
  const enviadas = items.filter((i) => i.estado === "Enviada");
  const masVieja = paraAutorizar.length ? Math.max(...paraAutorizar.map((i) => diasDesde(i.fechaPedido))) : 0;
  const autorizadasDelMes = items.filter((i) => i.estado === "Autorizada" && i.fechaAutorizacion?.slice(0, 7) === mes).length;
  const hoy = diaDeIso(new Date().toISOString());
  const deHoy = items.filter((i) => i.creadaEn && diaDeIso(i.creadaEn) === hoy).length;
  const cerrado = mes < mesActual;
  const quien = personas.map((p) => `${p.nombre.split(" ")[0]} ${p.fichas.length}`).join(" · ");
  const frase = `${cerrado ? "Cerró" : "Va"} ${nombreMes(mes)} con ${cargadas.length} ficha${cargadas.length === 1 ? "" : "s"} cargada${cargadas.length === 1 ? "" : "s"}${quien ? ` (${quien})` : ""}. ${autorizadasDelMes} ${autorizadasDelMes === 1 ? "quedó autorizada" : "quedaron autorizadas"}. ${
    mes === mesActual
      ? `Ahora hay ${paraAutorizar.length} para autorizar${paraAutorizar.length && masVieja > 0 ? ` (la más vieja hace ${masVieja} ${masVieja === 1 ? "día" : "días"})` : ""} y ${enviadas.length} enviada${enviadas.length === 1 ? "" : "s"} esperando respuesta. Hoy se cargaron ${deHoy}.`
      : ""
  }`;
  const alternar = (id) =>
    setAbiertos((a) => {
      const n = new Set(a);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <section className="mt-4 rounded-xl border border-brand-green/40 bg-emerald-50/60 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-heading text-base font-bold text-brand-brown">📊 Resumen de fichas</h2>
        <button onClick={() => setMes(sumarMes(mes, -1))} className="rounded-md border border-gray-300 px-2 py-0.5 text-sm hover:bg-white" aria-label="Mes anterior">
          ←
        </button>
        <span className="text-sm font-semibold capitalize text-gray-700">{nombreMes(mes)}</span>
        <button disabled={mes >= mesActual} onClick={() => setMes(sumarMes(mes, 1))} className="rounded-md border border-gray-300 px-2 py-0.5 text-sm hover:bg-white disabled:opacity-40" aria-label="Mes siguiente">
          →
        </button>
      </div>
      <p className="mt-2 text-[15px] leading-relaxed text-gray-900">{frase}</p>
      <div className="mt-3 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
        {[
          ["Cargadas en el mes", cargadas.length, false],
          ["Para autorizar (ahora)", paraAutorizar.length, paraAutorizar.length > 0],
          ["Enviadas esperando", enviadas.length, false],
          ["Autorizadas en el mes", autorizadasDelMes, false],
        ].map(([t, v, alerta]) => (
          <div key={t}>
            <p className={`font-heading text-2xl font-extrabold ${alerta ? "text-amber-700" : "text-brand-charcoal"}`}>{v}</p>
            <p className="text-[11px] uppercase tracking-wide text-gray-500">{t}</p>
          </div>
        ))}
      </div>

      {personas.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {personas.map((p) => {
            const abierto = abiertos.has(p.clave);
            const pendientes = p.fichas.filter((f) => f.estado === "Para autorizar").length;
            return (
              <div key={p.clave} className="overflow-hidden rounded-lg border border-brand-tan/70 bg-white">
                <button onClick={() => alternar(p.clave)} className="flex w-full flex-wrap items-center justify-between gap-2 px-3 py-2 text-left hover:bg-brand-cream/60" aria-expanded={abierto}>
                  <span className="text-sm font-bold text-gray-900">
                    {p.nombre} <span className="font-normal text-gray-500">· cargó {p.fichas.length} ficha{p.fichas.length === 1 ? "" : "s"}</span>
                  </span>
                  <span className="flex items-center gap-3 text-xs text-gray-600">
                    {pendientes > 0 && <span className="font-semibold text-amber-700">{pendientes} para autorizar</span>}
                    <span className="text-gray-400">{abierto ? "▲" : "▼"}</span>
                  </span>
                </button>
                {abierto && (
                  <ul className="divide-y divide-gray-100 border-t border-gray-100">
                    {p.fichas.map((f) => (
                      <li key={f.id} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2 text-sm">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900">
                            {f.pacienteNombre} <span className="text-xs font-normal text-gray-500">· {f.obraSocial}</span>
                          </p>
                          <p className="truncate text-xs text-gray-600">{f.prestacion.split("\n")[0]}</p>
                          <p className="text-[11px] text-gray-400">
                            {formatoFecha(diaDeIso(f.creadaEn))} {horaDeIso(f.creadaEn)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COLOR_ESTADO[f.estado]}`}>{f.estado}</span>
                          {f.archivoPath && (
                            <button onClick={() => abrirFicha(f, alError)} className="text-xs font-semibold text-brand-brown underline">
                              🧾 Ver ficha
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function AutorizacionesContenido() {
  const { perfil } = useAuth();
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
    Promise.all([obtenerPacientesActivos(), obtenerCoberturasDeAgenda().catch(() => ({}))])
      .then(([lista, coberturas]) =>
        setPacientes(
          lista.map((p) => {
            const c = coberturas[p.id];
            if (p.obra_social || !c) return p;
            return {
              ...p,
              obra_social: c.obraSocial,
              numero_afiliado: p.numero_afiliado || c.numeroAfiliado,
              obraSocialDeAgenda: true,
            };
          })
        )
      )
      .catch(() => {});
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
    const { archivo, ...resto } = datos;
    // Si se eligió una foto, se sube primero y la ficha guarda su ruta (al reemplazar, se borra la anterior).
    let archivoPath = resto.archivoPath || null;
    const anterior = archivoPath;
    if (archivo) archivoPath = await subirFichaAutorizacion(archivo);
    const aGuardar = { ...resto, archivoPath };
    if (enEdicion) {
      try {
        await actualizarAutorizacion(enEdicion.id, aGuardar);
      } catch (e) {
        // Si no se pudo guardar, la foto recién subida no queda suelta.
        if (archivo) await eliminarComprobante(archivoPath).catch(() => {});
        throw e;
      }
      if (archivo && anterior) await eliminarComprobante(anterior).catch(() => {});
    } else {
      await crearAutorizacion(aGuardar);
      // Aviso a las dueñas (queda también en la cortina 🔔): quién cargó qué ficha. Nunca frena el guardado.
      const paciente = pacientes.find((p) => p.id === aGuardar.pacienteId);
      enviarAviso({
        titulo: "📋 Nueva ficha para autorizar",
        mensaje: [`${perfil?.nombre ?? "Alguien"} cargó`, aGuardar.obraSocial, paciente?.apellido_y_nombre, archivo ? "con foto" : "sin foto"].filter(Boolean).join(" · "),
        url: "/autorizaciones",
        roles: ["Duena"],
      }).catch(() => {});
    }
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
      await eliminarAutorizacion(item);
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

      <ResumenFichas items={items} alError={setError} />

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
              <p className="mt-1 text-xs text-gray-500">
                Cargó: <strong>{i.creadoPor || "—"}</strong>
                {i.creadaEn ? ` · ${formatoFecha(diaDeIso(i.creadaEn))} ${horaDeIso(i.creadaEn)}` : ""}
                {i.archivoPath && (
                  <button onClick={() => abrirFicha(i, setError)} className="ml-3 font-semibold text-brand-brown underline">
                    🧾 Ver ficha
                  </button>
                )}
              </p>

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
