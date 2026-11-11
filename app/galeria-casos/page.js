"use client";

import { useCallback, useEffect, useState } from "react";
import SoloDuenaYCM from "@/components/SoloDuenaYCM";
import { actualizarCaso, crearCaso, eliminarCaso, obtenerCasos, urlPublicaFoto } from "@/lib/data/galeriaCasos";
import { URL_ORTODONCIA_INFO } from "@/lib/planReferidos";

const TRATAMIENTOS = ["Brackets metálicos", "Brackets de porcelana", "Ortodoncia", "Ortopedia"];
const ETIQUETAS_FOTO_FINAL = ["Después", "Durante el tratamiento"];
const VACIO = { titulo: "", tratamiento: "Brackets metálicos", duracionMeses: "", descripcion: "", consentimiento: false, publicar: true, etiquetaDespues: "Después" };

function SelectorFoto({ etiqueta, archivo, onElegir }) {
  const [vista, setVista] = useState(null);
  useEffect(() => {
    if (!archivo) return setVista(null);
    const url = URL.createObjectURL(archivo);
    setVista(url);
    return () => URL.revokeObjectURL(url);
  }, [archivo]);
  return (
    <label className="block cursor-pointer rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-3 text-center hover:border-brand-brown">
      <span className="text-sm font-semibold text-gray-700">{etiqueta}</span>
      {vista ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={vista} alt={etiqueta} className="mx-auto mt-2 h-40 w-full rounded-lg object-cover" />
      ) : (
        <span className="mt-2 flex h-40 items-center justify-center text-sm text-gray-500">Tocá para elegir la foto</span>
      )}
      <input type="file" accept="image/*" className="hidden" onChange={(e) => onElegir(e.target.files?.[0] || null)} />
    </label>
  );
}

function Contenido() {
  const [casos, setCasos] = useState(null);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(VACIO);
  const [antes, setAntes] = useState(null);
  const [despues, setDespues] = useState(null);
  const [subiendo, setSubiendo] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setCasos(await obtenerCasos());
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function guardar(e) {
    e.preventDefault();
    setError(null);
    if (!antes || !despues) return setError("Elegí las dos fotos: la del antes y la del después.");
    setSubiendo(true);
    try {
      await crearCaso({ ...form, fotoAntes: antes, fotoDespues: despues });
      setForm(VACIO);
      setAntes(null);
      setDespues(null);
      await cargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubiendo(false);
    }
  }

  async function cambiar(id, cambios) {
    setError(null);
    try {
      await actualizarCaso(id, cambios);
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function borrar(c) {
    if (!window.confirm(`¿Borrar el caso "${c.titulo}"? Se borran también sus fotos y no se puede deshacer.`)) return;
    setError(null);
    try {
      await eliminarCaso(c);
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">🖼️ Galería de casos</h1>
      <p className="mt-0.5 text-sm text-gray-500">
        Los casos que se muestran en la sección <strong>“Nuestros trabajos”</strong> de la página pública de ortodoncia (
        <a href={URL_ORTODONCIA_INFO} target="_blank" rel="noreferrer" className="underline">{URL_ORTODONCIA_INFO.replace("https://", "")}</a>). Si no hay ningún caso publicado, esa sección no aparece.
      </p>

      <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-bold">Antes de publicar un caso</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          <li>El paciente tiene que haber <strong>firmado la autorización de uso de imagen</strong>. Sin eso el sistema no deja publicar.</li>
          <li>La página no muestra nombres ni datos del paciente: solo las fotos, el título y lo que escribas acá. No pongas el nombre en el título.</li>
          <li>Para que se vea bien: las dos fotos con la misma pose, la misma distancia y buena luz.</li>
        </ul>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
          {/relation|does not exist|schema cache|Bucket not found/i.test(error) && " — Falta correr la migración 199 en Supabase."}
        </div>
      )}

      <form onSubmit={guardar} className="mt-5 rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-600">Agregar un caso</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <SelectorFoto etiqueta="Foto del ANTES" archivo={antes} onElegir={setAntes} />
          <SelectorFoto etiqueta="Foto del DESPUÉS" archivo={despues} onElegir={setDespues} />
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-gray-600 sm:col-span-3">
            Título (sin nombre del paciente)
            <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} required maxLength={80} placeholder="Ej. Apiñamiento dental" className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
          </label>
          <label className="text-xs text-gray-600">
            Tratamiento
            <select value={form.tratamiento} onChange={(e) => setForm({ ...form, tratamiento: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm">
              {TRATAMIENTOS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-gray-600">
            La segunda foto dice
            <select value={form.etiquetaDespues} onChange={(e) => setForm({ ...form, etiquetaDespues: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm">
              {ETIQUETAS_FOTO_FINAL.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-gray-600">
            Duración (meses)
            <input type="number" min={1} max={60} value={form.duracionMeses} onChange={(e) => setForm({ ...form, duracionMeses: e.target.value })} className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
          </label>
          <label className="text-xs text-gray-600 sm:col-span-3">
            Descripción corta (opcional)
            <input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} maxLength={200} placeholder="Ej. Alineación y corrección de la mordida" className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
          </label>
        </div>
        <label className="mt-3 flex cursor-pointer items-start gap-2 text-sm text-gray-800">
          <input type="checkbox" checked={form.consentimiento} onChange={(e) => setForm({ ...form, consentimiento: e.target.checked })} className="mt-1 h-4 w-4" />
          <span><strong>El paciente firmó la autorización</strong> para usar sus fotos en la página de la clínica.</span>
        </label>
        <label className={`mt-1 flex items-start gap-2 text-sm ${form.consentimiento ? "cursor-pointer text-gray-800" : "text-gray-400"}`}>
          <input type="checkbox" checked={form.publicar && form.consentimiento} disabled={!form.consentimiento} onChange={(e) => setForm({ ...form, publicar: e.target.checked })} className="mt-1 h-4 w-4" />
          <span>Publicarlo ahora en la página</span>
        </label>
        <button type="submit" disabled={subiendo || !form.titulo.trim() || !antes || !despues} className="mt-4 rounded-md bg-brand-brown px-5 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50">
          {subiendo ? "Subiendo fotos…" : "Guardar caso"}
        </button>
      </form>

      <h2 className="mt-8 text-sm font-bold uppercase tracking-wide text-gray-600">Casos cargados</h2>
      {!casos && !error && <p className="mt-2 text-sm text-gray-500">Cargando…</p>}
      {casos && casos.length === 0 && <p className="mt-2 rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">Todavía no cargaste ningún caso.</p>}
      <ul className="mt-2 grid gap-4 sm:grid-cols-2">
        {(casos || []).map((c) => (
          <li key={c.id} className="rounded-xl border border-gray-200 bg-white p-3">
            <div className="grid grid-cols-2 gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={urlPublicaFoto(c.foto_antes)} alt="Antes" className="h-32 w-full rounded-lg object-cover" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={urlPublicaFoto(c.foto_despues)} alt="Después" className="h-32 w-full rounded-lg object-cover" />
            </div>
            <p className="mt-2 font-bold text-gray-900">{c.titulo}</p>
            <p className="text-xs text-gray-500">{[c.tratamiento, c.duracion_meses ? `${c.duracion_meses} meses` : null].filter(Boolean).join(" · ")}</p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.publicado ? "bg-emerald-100 text-emerald-900" : "bg-gray-200 text-gray-700"}`}>{c.publicado ? "Publicado" : "Sin publicar"}</span>
              <button
                onClick={() => cambiar(c.id, { publicado: !c.publicado })}
                disabled={!c.publicado && !c.consentimiento}
                title={!c.publicado && !c.consentimiento ? "Falta la autorización del paciente" : undefined}
                className="text-brand-brown hover:underline disabled:cursor-not-allowed disabled:text-gray-400 disabled:no-underline"
              >
                {c.publicado ? "Sacar de la página" : "Publicar"}
              </button>
              <label className="flex cursor-pointer items-center gap-1 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={c.consentimiento}
                  onChange={(e) => cambiar(c.id, e.target.checked ? { consentimiento: true } : { consentimiento: false, publicado: false })}
                />
                Tiene autorización
              </label>
              <button onClick={() => borrar(c)} className="ml-auto text-xs text-red-700 hover:underline">Borrar</button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}

export default function GaleriaCasosPage() {
  return (
    <SoloDuenaYCM>
      <Contenido />
    </SoloDuenaYCM>
  );
}
