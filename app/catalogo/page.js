"use client";

import { useEffect, useState } from "react";
import CatalogoFilaModal from "@/components/CatalogoFilaModal";
import NuevaPrestacionModal from "@/components/NuevaPrestacionModal";
import { obtenerCatalogo } from "@/lib/data/catalogo";

const ORDEN_SECTORES = ["Periodoncia", "Endodoncia", "Odontopediatría", "Odontología General"];

function sectorDe(especialidad) {
  if (especialidad === "Periodoncia") return "Periodoncia";
  if (especialidad === "Endodoncia") return "Endodoncia";
  if (especialidad === "Odontopediatría") return "Odontopediatría";
  return "Odontología General";
}

function TablaPrestaciones({ prestaciones, onEditar }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="bg-brand-brown text-white">
          <th className="px-3 py-2 text-left font-semibold">ID</th>
          <th className="px-3 py-2 text-left font-semibold">Prestación</th>
          <th className="px-3 py-2 text-left font-semibold">Categoría</th>
          <th className="px-3 py-2 text-right font-semibold">Precio Lista</th>
          <th className="px-3 py-2 text-right font-semibold">Precio Efectivo</th>
          <th className="px-3 py-2 text-left font-semibold">Estado</th>
        </tr>
      </thead>
      <tbody>
        {prestaciones.map((p) => (
          <tr
            key={p.id}
            onClick={() => onEditar(p)}
            className="cursor-pointer border-t border-gray-100 hover:bg-gray-50"
          >
            <td className="px-3 py-2 text-gray-500">{p.id}</td>
            <td className="px-3 py-2 font-medium text-gray-900">{p.prestacion}</td>
            <td className="px-3 py-2 text-gray-600">{p.categoria || "—"}</td>
            <td className="px-3 py-2 text-right text-gray-600">${Number(p.valor_lista).toLocaleString("es-AR")}</td>
            <td className="px-3 py-2 text-right text-gray-600">${Number(p.valor_efectivo).toLocaleString("es-AR")}</td>
            <td className="px-3 py-2">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  p.estado === "Activo" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                }`}
              >
                {p.estado}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SectorColapsable({ nombre, prestaciones, abierto, onToggle, onEditar }) {
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-gray-200">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between bg-gray-50 px-4 py-2.5 text-left hover:bg-gray-100"
      >
        <span className="font-semibold text-gray-800">{nombre}</span>
        <span className="flex items-center gap-2 text-xs text-gray-500">
          {prestaciones.length} prestacion{prestaciones.length === 1 ? "" : "es"}
          <span>{abierto ? "▲" : "▼"}</span>
        </span>
      </button>
      {abierto && (
        <div className="overflow-x-auto">
          <TablaPrestaciones prestaciones={prestaciones} onEditar={onEditar} />
        </div>
      )}
    </div>
  );
}

export default function CatalogoPage() {
  const [prestaciones, setPrestaciones] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [filaEnEdicion, setFilaEnEdicion] = useState(null);
  const [mostrarNueva, setMostrarNueva] = useState(false);
  const [sectoresAbiertos, setSectoresAbiertos] = useState({});

  async function recargar() {
    const data = await obtenerCatalogo(busqueda);
    setPrestaciones(data);
  }

  useEffect(() => {
    setCargando(true);
    obtenerCatalogo(busqueda)
      .then(setPrestaciones)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      recargar().catch((e) => setError(e.message));
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda]);

  const buscando = busqueda.trim().length > 0;

  const porSector = {};
  for (const sector of ORDEN_SECTORES) porSector[sector] = [];
  for (const p of prestaciones) porSector[sectorDe(p.especialidad)].push(p);

  function estaAbierto(sector) {
    return buscando || !!sectoresAbiertos[sector];
  }

  function toggleSector(sector) {
    setSectoresAbiertos((s) => ({ ...s, [sector]: !s[sector] }));
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Catálogo de Prestaciones</h1>
        <button
          onClick={() => setMostrarNueva(true)}
          className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark"
        >
          + Nueva prestación
        </button>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        Lista maestra de prestaciones de la clínica, con sus precios de Lista y Efectivo, agrupada por sector.
      </p>

      <input
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar prestación, ID o categoría..."
        className="mt-4 w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm"
      />

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      {cargando && <p className="mt-4 text-sm text-gray-500">Cargando...</p>}

      {!cargando && prestaciones.length === 0 && (
        <p className="mt-4 text-sm text-gray-500">No se encontraron prestaciones.</p>
      )}

      {!cargando &&
        prestaciones.length > 0 &&
        ORDEN_SECTORES.filter((sector) => porSector[sector].length > 0).map((sector) => (
          <SectorColapsable
            key={sector}
            nombre={sector}
            prestaciones={porSector[sector]}
            abierto={estaAbierto(sector)}
            onToggle={() => toggleSector(sector)}
            onEditar={setFilaEnEdicion}
          />
        ))}

      {filaEnEdicion && (
        <CatalogoFilaModal
          prestacion={filaEnEdicion}
          onClose={() => setFilaEnEdicion(null)}
          onGuardado={async () => {
            await recargar();
            setFilaEnEdicion(null);
          }}
        />
      )}

      {mostrarNueva && (
        <NuevaPrestacionModal
          onClose={() => setMostrarNueva(false)}
          onGuardado={async () => {
            await recargar();
            setMostrarNueva(false);
          }}
        />
      )}
    </main>
  );
}
