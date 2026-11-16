"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fechaDeHoyISO } from "@/lib/agenda";
import { crearDiaPuntual, eliminarDiaPuntual, guardarMotivoGeneral, obtenerDiasPuntuales, obtenerMotivosGeneral } from "@/lib/data/consultasOnline";
import { obtenerProfesionales } from "@/lib/data/profesionales";

// Paneles de configuración de la página pública de Odontología General (solo Dueñas):
//  - Motivos: para qué se puede pedir turno, cuánto dura y qué profesionales atienden cada motivo.
//  - Días puntuales: fechas concretas en las que viene un profesional que no tiene un día fijo por semana.

const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const textoFecha = (iso) => {
  const [a, m, d] = iso.split("-").map(Number);
  return `${DIAS_CORTOS[new Date(a, m - 1, d).getDay()]} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
};
const ACCIONES = [
  ["turno", "Pedir turno en la página"],
  ["whatsapp", "Mandar a WhatsApp (urgencias)"],
  ["ortodoncia", "Pasar a la página de ortodoncia"],
];

function useProfesionales() {
  const [profesionales, setProfesionales] = useState([]);
  useEffect(() => {
    obtenerProfesionales()
      .then((p) => setProfesionales(p.filter((x) => x.activo)))
      .catch(() => {});
  }, []);
  return profesionales;
}

function FilaMotivo({ m, profesionales, onGuardar, trabajando }) {
  const [edit, setEdit] = useState(m);
  const cambiado = JSON.stringify(edit) !== JSON.stringify(m);
  const alternar = (id) => setEdit((e) => ({ ...e, profesionales_ids: e.profesionales_ids.includes(id) ? e.profesionales_ids.filter((x) => x !== id) : [...e.profesionales_ids, id] }));
  return (
    <li className={`rounded-xl border bg-white p-3 ${edit.activo ? "border-gray-200" : "border-gray-200 opacity-60"}`}>
      <div className="flex flex-wrap items-start gap-3">
        <label className="min-w-[14rem] flex-1 text-xs text-gray-600">
          Cómo lo ve el paciente
          <input value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm font-semibold" />
        </label>
        <label className="text-xs text-gray-600">
          Qué pasa al elegirlo
          <select value={edit.accion} onChange={(e) => setEdit({ ...edit, accion: e.target.value })} className="mt-1 block rounded-md border border-gray-300 px-2 py-1.5 text-sm">
            {ACCIONES.map(([k, t]) => (
              <option key={k} value={k}>{t}</option>
            ))}
          </select>
        </label>
        {edit.accion === "turno" && (
          <label className="text-xs text-gray-600">
            Duración (min)
            <input type="number" min={15} max={240} step={15} value={edit.duracion_min} onChange={(e) => setEdit({ ...edit, duracion_min: e.target.value })} className="mt-1 block w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
          </label>
        )}
        <label className="text-xs text-gray-600">
          Orden
          <input type="number" value={edit.orden} onChange={(e) => setEdit({ ...edit, orden: e.target.value })} className="mt-1 block w-16 rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        </label>
      </div>
      <label className="mt-2 block text-xs text-gray-600">
        Texto de ayuda para el paciente
        <input value={edit.descripcion || ""} onChange={(e) => setEdit({ ...edit, descripcion: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
      </label>
      {edit.accion === "whatsapp" && (
        <label className="mt-2 block text-xs text-gray-600">
          Mensaje que se muestra antes del botón de WhatsApp
          <input value={edit.mensaje || ""} onChange={(e) => setEdit({ ...edit, mensaje: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        </label>
      )}
      {edit.accion === "turno" && (
        <div className="mt-2">
          <p className="text-xs text-gray-600">Atienden este motivo (se ofrecen sus horarios de la Agenda y sus días puntuales):</p>
          <div className="mt-1 flex flex-wrap gap-2">
            {profesionales.map((p) => (
              <label key={p.id} className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${edit.profesionales_ids.includes(p.id) ? "border-brand-green bg-brand-mint/40 font-semibold text-brand-green" : "border-gray-300 text-gray-700"}`}>
                <input type="checkbox" checked={edit.profesionales_ids.includes(p.id)} onChange={() => alternar(p.id)} className="accent-brand-green" />
                {p.nombre} <span className="text-[11px] font-normal text-gray-500">{p.especialidad ? `· ${p.especialidad}` : ""}</span>
              </label>
            ))}
          </div>
          {edit.profesionales_ids.length === 0 && <p className="mt-1 text-xs text-amber-700">Sin profesionales no se ofrece ningún horario para este motivo.</p>}
        </div>
      )}
      <div className="mt-3 flex items-center justify-between gap-2">
        <label className="flex items-center gap-1.5 text-xs text-gray-700">
          <input type="checkbox" checked={edit.activo} onChange={(e) => setEdit({ ...edit, activo: e.target.checked })} />
          Se muestra en la página
        </label>
        <button disabled={!cambiado || trabajando} onClick={() => onGuardar(edit)} className="rounded-md bg-brand-brown px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-40">
          Guardar cambios
        </button>
      </div>
    </li>
  );
}

export function PanelMotivosGeneral() {
  const profesionales = useProfesionales();
  const [motivos, setMotivos] = useState(null);
  const [error, setError] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [trabajando, setTrabajando] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setMotivos(await obtenerMotivosGeneral());
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);

  async function guardar(m) {
    setTrabajando(true);
    setError(null);
    setMensaje(null);
    try {
      await guardarMotivoGeneral(m);
      setMensaje(`«${m.nombre}» guardado.`);
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <div className="mt-4">
      <p className="text-sm text-gray-600">
        Son las opciones de <strong>“¿Para qué es la consulta?”</strong> de la página de Odontología General. Para cada una elegís qué profesionales la atienden: la página le muestra al paciente los
        horarios de la Agenda (y los días puntuales) de esos profesionales, y reparte los turnos entre ellos.
      </p>
      {error && <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}{/relation|does not exist|schema cache/i.test(error) && " — Falta correr la migración 205 en Supabase."}</div>}
      {mensaje && <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{mensaje}</div>}
      {!motivos ? (
        <p className="mt-3 text-sm text-gray-500">Cargando…</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-3">
          {motivos.map((m) => (
            <FilaMotivo key={m.id} m={m} profesionales={profesionales} onGuardar={guardar} trabajando={trabajando} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function PanelDiasPuntuales() {
  const profesionales = useProfesionales();
  const hoy = fechaDeHoyISO();
  const [dias, setDias] = useState(null);
  const [error, setError] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [form, setForm] = useState({ profesionalId: "", fecha: "", desde: "14:00", hasta: "19:00", consultorio: "2", nota: "" });

  const cargar = useCallback(async () => {
    try {
      setDias(await obtenerDiasPuntuales(hoy));
    } catch (e) {
      setError(e.message);
    }
  }, [hoy]);
  useEffect(() => {
    cargar();
  }, [cargar]);

  const porProfesional = useMemo(() => {
    const m = {};
    for (const d of dias || []) (m[d.profesionalNombre] ||= []).push(d);
    return Object.entries(m);
  }, [dias]);

  async function ejecutar(fn, ok) {
    setError(null);
    setMensaje(null);
    try {
      await fn();
      if (ok) setMensaje(ok);
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="mt-4">
      <p className="text-sm text-gray-600">
        Para profesionales que <strong>no vienen un día fijo cada semana</strong> (por ejemplo, Yazmin un miércoles al mes a la mañana y otro a la tarde): cargá acá las fechas en que sí vienen. La página
        de turnos las ofrece solo esos días. Si el profesional tiene bloques fijos en la Agenda, esos también se ofrecen.
      </p>
      {error && <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}{/relation|does not exist|schema cache/i.test(error) && " — Falta correr la migración 205 en Supabase."}</div>}
      {mensaje && <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{mensaje}</div>}

      <form
        className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!form.profesionalId) return setError("Elegí quién viene.");
          if (!form.fecha || form.fecha < hoy) return setError("Elegí una fecha de hoy en adelante.");
          if (form.hasta <= form.desde) return setError("La hora de fin tiene que ser posterior a la de inicio.");
          ejecutar(async () => {
            await crearDiaPuntual(form);
            setForm({ ...form, fecha: "", nota: "" });
          }, "Día agregado.");
        }}
      >
        <label className="text-xs text-gray-600">
          Profesional
          <select value={form.profesionalId} onChange={(e) => setForm({ ...form, profesionalId: e.target.value })} className="mt-1 block rounded-md border border-gray-300 px-2 py-1.5 text-sm">
            <option value="">Elegir…</option>
            {profesionales.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </label>
        <label className="text-xs text-gray-600">
          Fecha
          <input type="date" min={hoy} value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className="mt-1 block rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
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
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </select>
        </label>
        <label className="min-w-[10rem] flex-1 text-xs text-gray-600">
          Nota (opcional)
          <input value={form.nota} onChange={(e) => setForm({ ...form, nota: e.target.value })} placeholder="Ej. viene por conductos" className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
        </label>
        <button type="submit" className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark">+ Agregar día</button>
      </form>

      <h2 className="mt-6 text-sm font-bold uppercase tracking-wide text-gray-600">Días cargados (de hoy en adelante)</h2>
      {!dias ? (
        <p className="mt-2 text-sm text-gray-500">Cargando…</p>
      ) : porProfesional.length === 0 ? (
        <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">No hay días puntuales cargados.</p>
      ) : (
        <div className="mt-2 flex flex-col gap-3">
          {porProfesional.map(([nombre, lista]) => (
            <div key={nombre} className="rounded-xl border border-gray-200 bg-white p-3">
              <p className="text-sm font-bold text-brand-brown">{nombre}</p>
              <ul className="mt-1 divide-y divide-gray-100">
                {lista.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-sm">
                    <span className="text-gray-800">
                      <strong>{textoFecha(d.fecha)}</strong> · {d.desde} a {d.hasta}
                      {d.consultorio ? ` · consultorio ${d.consultorio}` : ""}
                      {d.nota ? <span className="text-gray-500"> · {d.nota}</span> : null}
                    </span>
                    <button onClick={() => window.confirm("¿Quitar este día?") && ejecutar(() => eliminarDiaPuntual(d.id))} className="text-xs text-red-700 hover:underline">
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
