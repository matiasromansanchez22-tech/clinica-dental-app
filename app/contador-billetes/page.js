"use client";

import { useEffect, useState } from "react";
import ContadorBilletes from "@/components/ContadorBilletes";
import SoloDuenaContadorYSecretaria from "@/components/SoloDuenaContadorYSecretaria";
import { useAuth } from "@/lib/auth/AuthProvider";
import { CONTEO_VACIO, totalContado } from "@/lib/billetes";
import { eliminarConteo, guardarConteo, obtenerConteos } from "@/lib/data/conteosBilletes";

const CLAVE_BORRADOR = "contadorBilletesBorrador";

function pesos(n) {
  return `$${Math.round(Number(n) || 0).toLocaleString("es-AR")}`;
}

function leerBorrador() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_BORRADOR)) || null;
  } catch {
    return null;
  }
}

function ContadorContenido() {
  const { user, perfil } = useAuth();
  const esDuena = perfil?.rol === "Duena";
  const [conteo, setConteo] = useState(CONTEO_VACIO);
  const [esperado, setEsperado] = useState("");
  const [nota, setNota] = useState("");
  const [idEditando, setIdEditando] = useState(null);
  const [guardados, setGuardados] = useState([]);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const [mensaje, setMensaje] = useState(null);
  const [borradorRestaurado, setBorradorRestaurado] = useState(false);

  // El conteo en curso se guarda solo en este dispositivo para que no se
  // pierda si se actualiza la página o se cierra sin querer.
  useEffect(() => {
    const b = leerBorrador();
    /* eslint-disable react-hooks/set-state-in-effect */
    if (b) {
      setConteo(b.conteo || CONTEO_VACIO);
      setEsperado(b.esperado ?? "");
      setNota(b.nota ?? "");
      setIdEditando(b.idEditando ?? null);
    }
    setBorradorRestaurado(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (!borradorRestaurado) return;
    try {
      localStorage.setItem(CLAVE_BORRADOR, JSON.stringify({ conteo, esperado, nota, idEditando }));
    } catch {
      // sin almacenamiento local: el conteo igual se puede guardar con el botón
    }
  }, [borradorRestaurado, conteo, esperado, nota, idEditando]);

  async function recargarLista() {
    try {
      setGuardados(await obtenerConteos());
    } catch (e) {
      setError(e.message);
    } finally {
      setCargandoLista(false);
    }
  }

  useEffect(() => {
    recargarLista();
  }, []);

  function empezarDeNuevo() {
    setConteo(CONTEO_VACIO);
    setEsperado("");
    setNota("");
    setIdEditando(null);
    setMensaje(null);
  }

  async function handleGuardar() {
    setGuardando(true);
    setError(null);
    setMensaje(null);
    try {
      const guardado = await guardarConteo({
        id: idEditando,
        nombreUsuario: perfil?.nombre || user?.email,
        nota,
        conteo,
        esperado,
      });
      setIdEditando(guardado.id);
      setMensaje(idEditando ? "Conteo actualizado." : "Conteo guardado.");
      await recargarLista();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  function abrir(c, puedeEditar) {
    setConteo({ billetes: c.billetes || {}, monedas: c.monedas ? String(c.monedas) : "" });
    setEsperado(c.esperado === null || c.esperado === undefined ? "" : String(c.esperado));
    setNota(c.nota || "");
    // Un conteo de otra persona se abre como copia: al guardar se crea uno nuevo.
    setIdEditando(puedeEditar ? c.id : null);
    setMensaje(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function borrar(c) {
    if (!window.confirm(`¿Borrar el conteo${c.nota ? ` "${c.nota}"` : ""} de ${pesos(c.total)}?`)) return;
    try {
      await eliminarConteo(c.id);
      if (c.id === idEditando) setIdEditando(null);
      await recargarLista();
    } catch (e) {
      setError(e.message);
    }
  }

  const hayConteo = totalContado(conteo) > 0;
  const guardadoAbierto = guardados.find((c) => c.id === idEditando);

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">💵 Contador de billetes</h1>
      <p className="mt-1 text-sm text-gray-500">
        Para contar el efectivo en cualquier momento. Lo que vas anotando se guarda solo en este dispositivo; con
        &quot;Guardar conteo&quot; queda registrado para que lo vean los demás.
      </p>

      {idEditando && (
        <div className="mt-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800">
          Estás editando un conteo guardado{guardadoAbierto?.nota ? ` ("${guardadoAbierto.nota}")` : ""}. Al guardar se
          actualiza ese mismo conteo.
        </div>
      )}

      <label className="mt-4 flex flex-col gap-1 text-sm text-gray-700">
        Efectivo que tendría que haber (opcional)
        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={esperado}
          onChange={(e) => setEsperado(e.target.value)}
          placeholder="Ej: lo que da el limpio en efectivo del día"
          className="rounded-md border border-gray-300 px-2 py-1.5 tabular-nums"
        />
      </label>

      <div className="mt-4">
        <ContadorBilletes
          conteo={conteo}
          onChange={setConteo}
          esperado={esperado === "" ? null : Number(esperado)}
          etiquetaEsperado="Tendría que haber"
        />
      </div>

      <label className="mt-4 flex flex-col gap-1 text-sm text-gray-700">
        Nota (opcional)
        <input
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Ej: Caja fuerte, fin de octubre"
          className="rounded-md border border-gray-300 px-2 py-1.5"
        />
      </label>

      {error && <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
      {mensaje && (
        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{mensaje}</div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={handleGuardar}
          disabled={guardando || !hayConteo}
          className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
        >
          {guardando ? "Guardando..." : idEditando ? "Actualizar conteo guardado" : "Guardar conteo"}
        </button>
        <button
          onClick={empezarDeNuevo}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          Nuevo conteo
        </button>
      </div>

      <h2 className="mt-8 font-heading text-sm font-semibold text-brand-brown">Conteos guardados</h2>
      <div className="mt-2 overflow-hidden rounded-lg border border-gray-200">
        {cargandoLista ? (
          <p className="px-3 py-3 text-sm text-gray-500">Cargando...</p>
        ) : guardados.length === 0 ? (
          <p className="px-3 py-3 text-sm text-gray-400">Todavía no hay conteos guardados.</p>
        ) : (
          guardados.map((c) => {
            const diferencia = c.esperado === null || c.esperado === undefined ? null : Number(c.total) - Number(c.esperado);
            const puedeEditar = esDuena || c.usuario_id === user?.id;
            return (
              <div
                key={c.id}
                className={`flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-3 py-2.5 first:border-t-0 ${
                  c.id === idEditando ? "bg-sky-50" : ""
                }`}
              >
                <div className="text-sm">
                  <p className="font-semibold text-gray-900 tabular-nums">
                    {pesos(c.total)}
                    {c.nota && <span className="ml-2 font-normal text-gray-700">{c.nota}</span>}
                  </p>
                  <p className="text-xs text-gray-500">
                    {c.nombre_usuario || "—"} · {new Date(c.updated_at).toLocaleString("es-AR")}
                    {diferencia !== null &&
                      (Math.round(diferencia) === 0
                        ? " · coincide ✓"
                        : diferencia > 0
                          ? ` · sobran ${pesos(diferencia)}`
                          : ` · faltan ${pesos(-diferencia)}`)}
                  </p>
                </div>
                <div className="flex gap-3 text-xs">
                  <button onClick={() => abrir(c, puedeEditar)} className="text-blue-600 hover:underline">
                    {puedeEditar ? "Abrir / editar" : "Ver copia"}
                  </button>
                  {puedeEditar && (
                    <button onClick={() => borrar(c)} className="text-red-600 hover:underline">
                      Borrar
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}

export default function ContadorBilletesPage() {
  return (
    <SoloDuenaContadorYSecretaria>
      <ContadorContenido />
    </SoloDuenaContadorYSecretaria>
  );
}
