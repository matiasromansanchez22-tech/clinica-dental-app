"use client";

import { useState } from "react";
import { fechaDeHoyISO } from "@/lib/agenda";
import { actualizarPrecioMecanico, crearPrecioMecanico, eliminarPrecioMecanico } from "@/lib/data/mecanicosPrecios";

function VincularCatalogo({ idCatalogo, setIdCatalogo, catalogo }) {
  const [busqueda, setBusqueda] = useState("");
  const vinculada = catalogo.find((c) => c.id === idCatalogo) || null;

  const coincidencias =
    busqueda.trim().length >= 2
      ? catalogo.filter((c) => c.prestacion.toLowerCase().includes(busqueda.trim().toLowerCase())).slice(0, 8)
      : [];

  return (
    <label className="flex flex-col gap-1 text-sm text-gray-700">
      Vincular con prestación del catálogo (opcional)
      <p className="text-xs text-gray-400">
        Para que este trabajo se use al calcular el margen del mecánico, aunque el nombre no sea idéntico.
      </p>
      {vinculada ? (
        <div className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
          <span className="font-medium text-emerald-800">🔗 {vinculada.prestacion}</span>
          <button type="button" onClick={() => setIdCatalogo(null)} className="text-xs text-emerald-700 hover:underline">
            Quitar
          </button>
        </div>
      ) : (
        <>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar prestación del catálogo..."
            className="rounded-md border border-gray-300 px-2 py-1.5"
          />
          {coincidencias.length > 0 && (
            <ul className="max-h-32 overflow-y-auto rounded-md border border-gray-200">
              {coincidencias.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setIdCatalogo(c.id);
                      setBusqueda("");
                    }}
                    className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50"
                  >
                    {c.prestacion}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </label>
  );
}

export default function PrecioMecanicoModal({ precio, categoriaSugerida, categorias, laboratorios, catalogo, onClose, onGuardado }) {
  const [laboratorio, setLaboratorio] = useState(precio?.laboratorio || "");
  const [categoria, setCategoria] = useState(precio?.categoria || categoriaSugerida || "");
  const [trabajo, setTrabajo] = useState(precio?.trabajo || "");
  const [precioValor, setPrecioValor] = useState(precio?.precio ?? "");
  const [observaciones, setObservaciones] = useState(precio?.observaciones || "");
  const [contacto, setContacto] = useState(precio?.contacto || "");
  const [actualizadoEn, setActualizadoEn] = useState(precio?.actualizadoEn || fechaDeHoyISO());
  const [preferido, setPreferido] = useState(precio?.preferido || false);
  const [idCatalogo, setIdCatalogo] = useState(precio?.idCatalogo || null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  async function guardar(e) {
    e.preventDefault();
    setError(null);
    if (!laboratorio.trim() || !categoria.trim() || !trabajo.trim()) {
      setError("Completá laboratorio, categoría y trabajo.");
      return;
    }
    setGuardando(true);
    try {
      const datos = { laboratorio, categoria, trabajo, precio: precioValor, observaciones, contacto, actualizadoEn, preferido, idCatalogo };
      if (precio) {
        await actualizarPrecioMecanico(precio.id, datos);
      } else {
        await crearPrecioMecanico(datos);
      }
      onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function borrar() {
    if (!window.confirm("¿Borrar este precio?")) return;
    setGuardando(true);
    try {
      await eliminarPrecioMecanico(precio.id);
      onGuardado();
    } catch (err) {
      setError(err.message);
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold text-brand-brown">
            {precio ? "Editar precio" : "Nuevo precio"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Cerrar">
            ✕
          </button>
        </div>

        {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

        <form onSubmit={guardar} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Laboratorio
            <input
              list="lista-laboratorios"
              value={laboratorio}
              onChange={(e) => setLaboratorio(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            />
            <datalist id="lista-laboratorios">
              {laboratorios.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Categoría
            <input
              list="lista-categorias"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            />
            <datalist id="lista-categorias">
              {categorias.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Trabajo
            <input
              value={trabajo}
              onChange={(e) => setTrabajo(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Precio
            <input
              type="number"
              value={precioValor}
              onChange={(e) => setPrecioValor(e.target.value)}
              placeholder="Dejar vacío si dice 'Consultar'"
              className="rounded-md border border-gray-300 px-2 py-1.5"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Observaciones
            <input
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder='Ej. "Consultar", rango de precio, aclaración'
              className="rounded-md border border-gray-300 px-2 py-1.5"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Contacto (opcional)
            <input
              value={contacto}
              onChange={(e) => setContacto(e.target.value)}
              placeholder="Teléfono / WhatsApp / persona de contacto"
              className="rounded-md border border-gray-300 px-2 py-1.5"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm text-gray-700">
            Fecha de esta lista
            <input
              type="date"
              value={actualizadoEn}
              onChange={(e) => setActualizadoEn(e.target.value)}
              className="rounded-md border border-gray-300 px-2 py-1.5"
            />
          </label>

          <label className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-sm text-amber-800">
            <input type="checkbox" checked={preferido} onChange={(e) => setPreferido(e.target.checked)} />
            ⭐ Este es el laboratorio elegido para este trabajo
          </label>

          <VincularCatalogo idCatalogo={idCatalogo} setIdCatalogo={setIdCatalogo} catalogo={catalogo} />

          <div className="mt-2 flex items-center justify-between gap-2">
            {precio ? (
              <button
                type="button"
                onClick={borrar}
                disabled={guardando}
                className="text-xs text-red-600 hover:underline disabled:opacity-50"
              >
                Borrar
              </button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando}
                className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
              >
                {guardando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
