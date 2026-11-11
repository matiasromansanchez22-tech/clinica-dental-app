"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import SoloDuenaYSecretaria from "@/components/SoloDuenaYSecretaria";
import { useAuth } from "@/lib/auth/AuthProvider";
import { fechaDeHoyISO, NOMBRES_DIA_SEMANA } from "@/lib/agenda";
import {
  agendarPedido,
  cambiarActivoHorarioPublico,
  cambiarEstadoPedido,
  crearHorarioPublico,
  eliminarHorarioPublico,
  importarDisponibilidadAgenda,
  obtenerHorariosPublicos,
  obtenerPedidosDeTurno,
  obtenerPreguntasAlAsistente,
} from "@/lib/data/consultasOnline";
import { obtenerProfesionales } from "@/lib/data/profesionales";
import { URL_ORTODONCIA_INFO } from "@/lib/planReferidos";

const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function textoFecha(fechaISO) {
  const [a, m, d] = fechaISO.split("-").map(Number);
  return `${DIAS_CORTOS[new Date(a, m - 1, d).getDay()]} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

function hace(creadoEn) {
  const min = Math.max(0, Math.round((Date.now() - new Date(creadoEn).getTime()) / 60000));
  if (min < 60) return `hace ${min} min`;
  if (min < 60 * 24) return `hace ${Math.round(min / 60)} h`;
  return `hace ${Math.round(min / 1440)} d`;
}

const linkWhatsApp = (numero, mensaje) => `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;

function Pedido({ p, onCambio, onError }) {
  const [trabajando, setTrabajando] = useState(false);
  const hoy = fechaDeHoyISO();
  const primerNombre = p.nombre.split(" ")[0];
  const pendiente = p.estado === "Pendiente";

  async function accion(fn) {
    setTrabajando(true);
    onError(null);
    try {
      await fn();
      await onCambio();
    } catch (e) {
      onError(e.message);
    } finally {
      setTrabajando(false);
    }
  }

  const mensajeConfirmar = `¡Hola ${primerNombre}! Te escribimos de Clínica Dental Marianela Ramírez. Recibimos tu pedido de turno para la consulta de ortodoncia el ${textoFecha(p.fecha)} a las ${p.hora}. ¿Lo confirmamos?`;
  const mensajeOtro = `¡Hola ${primerNombre}! Te escribimos de Clínica Dental Marianela Ramírez por tu pedido de consulta de ortodoncia. Ese horario ya no lo tenemos disponible, ¿qué otros días y horarios te quedan bien así lo coordinamos?`;

  const colores = { Pendiente: "bg-amber-100 text-amber-900", Agendada: "bg-emerald-100 text-emerald-900", Rechazada: "bg-gray-200 text-gray-700", Cancelada: "bg-gray-200 text-gray-700" };

  return (
    <li className={`rounded-xl border bg-white p-4 shadow-sm ${pendiente ? "border-amber-300" : "border-gray-200"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-base font-bold text-gray-900">{p.nombre}</p>
          <p className="text-sm text-gray-700">
            <strong>{textoFecha(p.fecha)} · {p.hora}</strong> · con {p.profesionalNombre} · consultorio {p.consultorio}
            {pendiente && p.fecha < hoy && <span className="ml-2 rounded bg-red-100 px-1.5 text-xs font-semibold text-red-800">fecha vencida</span>}
          </p>
          <p className="text-xs text-gray-500">
            WhatsApp {p.whatsapp.replace(/^549/, "")} · pedido {hace(p.created_at)}
            {p.lugar ? ` · vino de: ${p.lugar}` : ""}
          </p>
          {p.nota && <p className="mt-1 text-xs text-gray-600">Nota: {p.nota}</p>}
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${colores[p.estado]}`}>{p.estado}</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={linkWhatsApp(p.whatsapp, p.estado === "Rechazada" ? mensajeOtro : mensajeConfirmar)}
          target="_blank"
          rel="noreferrer"
          className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
        >
          💬 Escribirle
        </a>
        {pendiente && (
          <>
            <button
              disabled={trabajando}
              onClick={() => accion(() => agendarPedido(p))}
              className="rounded-md bg-brand-brown px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
            >
              ✅ Agendar en la Agenda
            </button>
            <button
              disabled={trabajando}
              onClick={() => {
                const nota = window.prompt("¿Por qué no se puede? (opcional, es solo para el registro interno)");
                if (nota === null) return;
                accion(() => cambiarEstadoPedido(p.id, "Rechazada", nota.trim()));
              }}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              No se puede
            </button>
          </>
        )}
      </div>
      {pendiente && <p className="mt-2 text-xs text-gray-500">Al agendar se crea el turno de consulta en la Agenda de Ortodoncia (sin confirmar). Después escribile para confirmarlo.</p>}
    </li>
  );
}

function PanelPedidos() {
  const [pedidos, setPedidos] = useState(null);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setPedidos(await obtenerPedidosDeTurno());
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const pendientes = useMemo(() => (pedidos || []).filter((p) => p.estado === "Pendiente"), [pedidos]);
  const historial = useMemo(
    () => (pedidos || []).filter((p) => p.estado !== "Pendiente").sort((a, b) => String(b.gestionada_en || b.created_at).localeCompare(String(a.gestionada_en || a.created_at))).slice(0, 40),
    [pedidos]
  );

  if (!pedidos && !error) return <p className="mt-4 text-sm text-gray-500">Cargando…</p>;
  return (
    <div className="mt-4">
      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
          {/relation|does not exist|schema cache/i.test(error) && " — Falta correr la migración 199 en Supabase."}
        </div>
      )}
      <h2 className="text-sm font-bold uppercase tracking-wide text-gray-600">Esperando respuesta ({pendientes.length})</h2>
      {pendientes.length === 0 ? (
        <p className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">✅ No hay pedidos pendientes.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-3">
          {pendientes.map((p) => (
            <Pedido key={p.id} p={p} onCambio={cargar} onError={setError} />
          ))}
        </ul>
      )}
      {historial.length > 0 && (
        <>
          <h2 className="mt-6 text-sm font-bold uppercase tracking-wide text-gray-600">Ya gestionados</h2>
          <ul className="mt-2 flex flex-col gap-3">
            {historial.map((p) => (
              <Pedido key={p.id} p={p} onCambio={cargar} onError={setError} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function PanelHorarios() {
  const [horarios, setHorarios] = useState(null);
  const [profesionales, setProfesionales] = useState([]);
  const [error, setError] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [form, setForm] = useState({ profesionalId: "", diaSemana: "1", desde: "09:00", hasta: "13:00", consultorio: "3" });
  const [importarDe, setImportarDe] = useState("");

  const cargar = useCallback(async () => {
    try {
      setHorarios(await obtenerHorariosPublicos());
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    cargar();
    obtenerProfesionales()
      .then((p) => setProfesionales(p.filter((x) => x.activo)))
      .catch(() => {});
  }, [cargar]);

  const ortodoncistas = useMemo(() => {
    const orto = profesionales.filter((p) => /ortodon/i.test(p.especialidad || ""));
    return orto.length ? orto : profesionales;
  }, [profesionales]);

  async function ejecutar(fn, textoOk) {
    setError(null);
    setMensaje(null);
    try {
      await fn();
      if (textoOk) setMensaje(textoOk);
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  const porDia = useMemo(() => {
    const mapa = {};
    for (const h of horarios || []) (mapa[h.dia_semana] ||= []).push(h);
    return [1, 2, 3, 4, 5, 6, 0].filter((d) => mapa[d]).map((d) => [d, mapa[d]]);
  }, [horarios]);

  return (
    <div className="mt-4">
      <p className="text-sm text-gray-600">
        Acá elegís <strong>en qué días y horas</strong> se ofrecen turnos de primera consulta en la página. La página muestra turnos de 30 minutos dentro de estos
        bloques, solo si ese horario está libre en la Agenda, y hasta 3 horas antes. Mientras no haya ningún bloque, la página manda a coordinar por WhatsApp.
      </p>
      {error && <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}{/relation|does not exist|schema cache/i.test(error) && " — Falta correr la migración 199 en Supabase."}</div>}
      {mensaje && <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{mensaje}</div>}

      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-sm font-bold text-gray-800">Agregar un bloque</p>
        <form
          className="mt-2 flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.profesionalId) return setError("Elegí quién atiende.");
            if (form.hasta <= form.desde) return setError("La hora de fin tiene que ser posterior a la de inicio.");
            ejecutar(() => crearHorarioPublico(form), "Bloque agregado.");
          }}
        >
          <label className="text-xs text-gray-600">
            Atiende
            <select value={form.profesionalId} onChange={(e) => setForm({ ...form, profesionalId: e.target.value })} className="mt-1 block rounded-md border border-gray-300 px-2 py-1.5 text-sm">
              <option value="">Elegir…</option>
              {ortodoncistas.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-gray-600">
            Día
            <select value={form.diaSemana} onChange={(e) => setForm({ ...form, diaSemana: e.target.value })} className="mt-1 block rounded-md border border-gray-300 px-2 py-1.5 text-sm">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <option key={d} value={d}>{NOMBRES_DIA_SEMANA[d]}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-gray-600">
            Desde
            <input type="time" step="1800" value={form.desde} onChange={(e) => setForm({ ...form, desde: e.target.value })} className="mt-1 block rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
          </label>
          <label className="text-xs text-gray-600">
            Hasta
            <input type="time" step="1800" value={form.hasta} onChange={(e) => setForm({ ...form, hasta: e.target.value })} className="mt-1 block rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
          </label>
          <label className="text-xs text-gray-600">
            Consultorio
            <select value={form.consultorio} onChange={(e) => setForm({ ...form, consultorio: e.target.value })} className="mt-1 block rounded-md border border-gray-300 px-2 py-1.5 text-sm">
              <option value="2">2</option>
              <option value="3">3</option>
            </select>
          </label>
          <button type="submit" className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark">+ Agregar</button>
        </form>
        <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-gray-100 pt-3">
          <label className="text-xs text-gray-600">
            O copiar los horarios que ya tiene en la Agenda
            <select value={importarDe} onChange={(e) => setImportarDe(e.target.value)} className="mt-1 block rounded-md border border-gray-300 px-2 py-1.5 text-sm">
              <option value="">Elegir profesional…</option>
              {ortodoncistas.map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </label>
          <button
            disabled={!importarDe}
            onClick={() => ejecutar(async () => { const n = await importarDisponibilidadAgenda(importarDe); setMensaje(`Se copiaron ${n} bloque${n === 1 ? "" : "s"}. Podés borrar los que no quieras ofrecer.`); setImportarDe(""); })}
            className="rounded-md border border-brand-brown/40 px-3 py-2 text-sm text-brand-brown hover:bg-brand-tan/30 disabled:opacity-50"
          >
            Copiar de la Agenda
          </button>
        </div>
      </div>

      <h2 className="mt-6 text-sm font-bold uppercase tracking-wide text-gray-600">Bloques que se ofrecen hoy</h2>
      {!horarios ? (
        <p className="mt-2 text-sm text-gray-500">Cargando…</p>
      ) : porDia.length === 0 ? (
        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Todavía no hay bloques: la página no ofrece horarios y manda a coordinar por WhatsApp.</p>
      ) : (
        <div className="mt-2 flex flex-col gap-3">
          {porDia.map(([dia, bloques]) => (
            <div key={dia} className="rounded-xl border border-gray-200 bg-white p-3">
              <p className="text-sm font-bold text-brand-brown">{NOMBRES_DIA_SEMANA[dia]}</p>
              <ul className="mt-1 divide-y divide-gray-100">
                {bloques.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm">
                    <span className={b.activo ? "text-gray-800" : "text-gray-400 line-through"}>
                      {b.desde} a {b.hasta} · {b.profesionalNombre} · consultorio {b.consultorio}
                    </span>
                    <span className="flex gap-3 text-xs">
                      <button onClick={() => ejecutar(() => cambiarActivoHorarioPublico(b.id, !b.activo))} className="text-gray-600 hover:underline">
                        {b.activo ? "Pausar" : "Reactivar"}
                      </button>
                      <button
                        onClick={() => window.confirm("¿Borrar este bloque?") && ejecutar(() => eliminarHorarioPublico(b.id))}
                        className="text-red-700 hover:underline"
                      >
                        Borrar
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 text-sm">
        <a href={URL_ORTODONCIA_INFO} target="_blank" rel="noreferrer" className="font-medium text-brand-brown underline">Ver cómo queda la página →</a>
      </p>
    </div>
  );
}

function PanelPreguntas() {
  const [filas, setFilas] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    obtenerPreguntasAlAsistente()
      .then(setFilas)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div className="mt-4">
      <p className="text-sm text-gray-600">
        Lo que le preguntan al asistente de la página y lo que responde. Es anónimo (no se guarda nombre ni teléfono). Sirve para ver qué dudas tiene la gente y qué
        conviene sumar a la información de la página.
      </p>
      {error && <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
      {!filas && !error && <p className="mt-3 text-sm text-gray-500">Cargando…</p>}
      {filas && filas.length === 0 && <p className="mt-3 rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">Todavía nadie le preguntó nada.</p>}
      {filas && filas.length > 0 && (
        <ul className="mt-3 flex flex-col gap-3">
          {filas.map((f) => (
            <li key={f.id} className="rounded-xl border border-gray-200 bg-white p-3">
              <p className="text-xs text-gray-400">{hace(f.created_at)}</p>
              <p className="mt-0.5 text-sm font-semibold text-gray-900">🙋 {f.pregunta}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">🤖 {f.respuesta}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Contenido() {
  const { perfil } = useAuth();
  const esDuena = perfil?.rol === "Duena";
  const [pestana, setPestana] = useState("pedidos");
  const pestanas = [
    ["pedidos", "Pedidos de turno"],
    ...(esDuena ? [["horarios", "Horarios que se ofrecen"], ["preguntas", "Preguntas al asistente"]] : []),
  ];

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">🌐 Consultas online</h1>
      <p className="mt-0.5 text-sm text-gray-500">
        Lo que llega desde la página pública de ortodoncia (<a href={URL_ORTODONCIA_INFO} target="_blank" rel="noreferrer" className="underline">{URL_ORTODONCIA_INFO.replace("https://", "")}</a>): pedidos de turno,
        horarios que se ofrecen y preguntas al asistente.
      </p>
      <div className="mt-4 flex flex-wrap overflow-hidden rounded-md border border-gray-300 text-sm">
        {pestanas.map(([clave, texto]) => (
          <button key={clave} onClick={() => setPestana(clave)} className={`px-4 py-2 ${pestana === clave ? "bg-brand-brown text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}>
            {texto}
          </button>
        ))}
      </div>
      {pestana === "pedidos" && <PanelPedidos />}
      {pestana === "horarios" && esDuena && <PanelHorarios />}
      {pestana === "preguntas" && esDuena && <PanelPreguntas />}
    </main>
  );
}

export default function ConsultasOnlinePage() {
  return (
    <SoloDuenaYSecretaria>
      <Contenido />
    </SoloDuenaYSecretaria>
  );
}
