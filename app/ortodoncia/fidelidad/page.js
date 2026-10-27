"use client";

import { useEffect, useMemo, useState } from "react";
import SoloDuenaYSecretaria from "@/components/SoloDuenaYSecretaria";
import { CasillasTarjeta } from "@/components/FidelidadPacienteCampo";
import { fechaDesdeConfig, obtenerFidelidadTodos } from "@/lib/data/fidelidad";
import { fechaDeHoyISO } from "@/lib/agenda";

const formatoFecha = (f) => (f ? f.split("-").reverse().join("/") : "—");
const pesos = (n) => `$${Number(n || 0).toLocaleString("es-AR")}`;

function Tarjeta({ titulo, valor, detalle, activa, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border p-3 text-left ${activa ? "border-brand-brown bg-brand-tan/40" : "border-gray-200 bg-white hover:bg-gray-50"}`}
    >
      <p className="text-xs font-medium uppercase text-gray-500">{titulo}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{valor}</p>
      {detalle && <p className="mt-0.5 text-xs text-gray-500">{detalle}</p>}
    </button>
  );
}

function FidelidadContenido() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [filtro, setFiltro] = useState("todos");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    obtenerFidelidadTodos()
      .then(setDatos)
      .catch((e) => setError(e.message));
  }, []);

  const hoy = fechaDeHoyISO();
  const filas = useMemo(() => {
    if (!datos) return [];
    return datos.filas.map((f) => {
      const habilitados = f.premios.filter((p) => p.estado === "Habilitado" && (!p.vence || p.vence >= hoy));
      const usados = f.premios.filter((p) => p.estado === "Aplicado");
      const { visitasDescuento, visitasGratis } = f.racha;
      // Le falta una sola visita para el próximo premio (la 5.ª o la 10.ª).
      const aPunto = f.racha.progreso === visitasDescuento - 1 || f.racha.progreso === visitasGratis - 1;
      return { ...f, habilitados, usados, aPunto };
    });
  }, [datos, hoy]);

  const resumen = useMemo(
    () => ({
      enCurso: filas.filter((f) => f.racha.progreso > 0).length,
      habilitados: filas.filter((f) => f.habilitados.length > 0),
      aPunto: filas.filter((f) => f.aPunto),
      usados: filas.reduce((a, f) => a + f.usados.length, 0),
      descontado: filas.reduce((a, f) => a + f.usados.reduce((b, p) => b + Number(p.monto || 0), 0), 0),
    }),
    [filas]
  );

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return filas
      .filter((f) => {
        if (filtro === "habilitados") return f.habilitados.length > 0;
        if (filtro === "apunto") return f.aPunto;
        if (filtro === "usados") return f.usados.length > 0;
        return f.racha.progreso > 0 || f.habilitados.length > 0 || f.usados.length > 0 || f.racha.completoUltima;
      })
      .filter((f) => !q || f.paciente.toLowerCase().includes(q))
      .sort((a, b) => b.habilitados.length - a.habilitados.length || b.racha.progreso - a.racha.progreso || a.paciente.localeCompare(b.paciente));
  }, [filas, filtro, busqueda]);

  const cfg = datos?.cfg;

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">🎟️ Tarjeta de fidelidad — Ortodoncia</h1>
      <p className="mt-1 text-sm text-gray-500">
        Cuántas visitas seguidas lleva cada paciente. Se cuenta sola con la asistencia de la agenda: no hace falta anotar nada. La tarjeta de papel es solo un
        recordatorio para el paciente; lo que vale es lo que dice esta pantalla.
      </p>

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
      {!datos && !error && <p className="mt-6 text-sm text-gray-500">Cargando...</p>}

      {datos && cfg && (
        <>
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <p>
              <strong>Las reglas:</strong> {cfg.fidelidad_visitas_descuento} controles seguidos dan {cfg.fidelidad_porcentaje_descuento}% de descuento en el control siguiente, y{" "}
              {cfg.fidelidad_visitas_control_gratis} seguidos dan un control sin costo (después la tarjeta vuelve a empezar). Faltar sin avisar vuelve la cuenta a
              cero; cancelar o reprogramar avisando no la rompe ni suma. Cada premio dura {cfg.fidelidad_vigencia_dias} días. En un mismo control se aplica un solo
              beneficio (el que más descuenta), también cuando coincide con el plan de referidos. Se cuenta desde el {formatoFecha(fechaDesdeConfig(cfg))}.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tarjeta titulo="Con tarjeta en curso" valor={resumen.enCurso} detalle="Vienen sumando visitas seguidas" activa={filtro === "todos"} onClick={() => setFiltro("todos")} />
            <Tarjeta
              titulo="A una visita de un premio"
              valor={resumen.aPunto.length}
              detalle="Si vienen en su próximo turno, ganan"
              activa={filtro === "apunto"}
              onClick={() => setFiltro(filtro === "apunto" ? "todos" : "apunto")}
            />
            <Tarjeta
              titulo="Premios para usar"
              valor={resumen.habilitados.length}
              detalle="Se aplican solos en su próximo cobro"
              activa={filtro === "habilitados"}
              onClick={() => setFiltro(filtro === "habilitados" ? "todos" : "habilitados")}
            />
            <Tarjeta
              titulo="Ya usados"
              valor={resumen.usados}
              detalle={`${pesos(resumen.descontado)} descontados en total`}
              activa={filtro === "usados"}
              onClick={() => setFiltro(filtro === "usados" ? "todos" : "usados")}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar paciente..."
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
            <p className="text-sm font-semibold text-gray-700">
              {visibles.length} paciente{visibles.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="bg-brand-brown text-white">
                  <th className="px-3 py-2 text-left font-semibold">Paciente</th>
                  <th className="px-3 py-2 text-left font-semibold">Visitas seguidas</th>
                  <th className="px-3 py-2 text-left font-semibold">Última visita</th>
                  <th className="px-3 py-2 text-left font-semibold">Premio</th>
                </tr>
              </thead>
              <tbody>
                {visibles.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-4 text-center text-gray-500">
                      Todavía no hay pacientes en esta lista.
                    </td>
                  </tr>
                )}
                {visibles.map((f) => (
                  <tr key={f.pacienteId} className="border-t border-gray-100 align-top">
                    <td className="px-3 py-2 font-medium text-gray-900">
                      {f.paciente}
                      {!f.activo && <span className="ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs font-normal text-gray-600">no activo</span>}
                      {f.racha.sinMarcar > 0 && (
                        <p className="text-xs font-normal text-red-700">
                          ⚠️ {f.racha.sinMarcar} turno{f.racha.sinMarcar > 1 ? "s" : ""} pasado{f.racha.sinMarcar > 1 ? "s" : ""} sin marcar si vino
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <p className="mb-1 text-xs text-gray-600">
                        {f.racha.completoUltima ? "Completó la tarjeta" : `${f.racha.progreso} de ${cfg.fidelidad_visitas_control_gratis}`}
                      </p>
                      <CasillasTarjeta progreso={f.racha.progreso} cfg={cfg} completa={f.racha.completoUltima} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-gray-600">{formatoFecha(f.racha.ultimaVisita)}</td>
                    <td className="px-3 py-2 text-xs">
                      {f.habilitados.map((p) => (
                        <p key={p.id} className="font-medium text-emerald-800">
                          🎁 {p.tipo === "Control sin costo" ? "Control sin costo" : `${cfg.fidelidad_porcentaje_descuento}% en un control`} · hasta el {formatoFecha(p.vence)}
                        </p>
                      ))}
                      {f.usados.map((p) => (
                        <p key={p.id} className="text-gray-500">
                          Usado: {p.tipo === "Control sin costo" ? "control sin costo" : `${cfg.fidelidad_porcentaje_descuento}%`} · {pesos(p.monto)} el {formatoFecha(p.aplicadoEn)}
                        </p>
                      ))}
                      {f.premios.filter((p) => p.estado === "Vencido").map((p) => (
                        <p key={p.id} className="text-red-700">
                          Venció: {p.tipo === "Control sin costo" ? "control sin costo" : `${cfg.fidelidad_porcentaje_descuento}%`} ({formatoFecha(p.vence)})
                        </p>
                      ))}
                      {f.premios.length === 0 && <span className="text-gray-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}

export default function FidelidadPage() {
  return (
    <SoloDuenaYSecretaria>
      <FidelidadContenido />
    </SoloDuenaYSecretaria>
  );
}
