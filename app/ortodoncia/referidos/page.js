"use client";

import { useEffect, useMemo, useState } from "react";
import SoloDuenaYSecretaria from "@/components/SoloDuenaYSecretaria";
import { obtenerConfigReferidos, obtenerReferidos } from "@/lib/data/referidos";

function formatoFecha(fechaISO) {
  if (!fechaISO) return "—";
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}

const pesos = (n) => `$${Number(n || 0).toLocaleString("es-AR")}`;

const ESTILO_PREMIO = {
  Pendiente: "bg-sky-100 text-sky-800",
  "En espera": "bg-gray-100 text-gray-600",
  Habilitado: "bg-emerald-100 text-emerald-800",
  Aplicado: "bg-violet-100 text-violet-800",
  Vencido: "bg-red-100 text-red-800",
  "Sin premio": "bg-amber-100 text-amber-800",
};

function Etiqueta({ estado }) {
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${ESTILO_PREMIO[estado] || "bg-gray-100 text-gray-600"}`}>{estado}</span>;
}

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

function ReferidosContenido() {
  const [filas, setFilas] = useState(null);
  const [cfg, setCfg] = useState(null);
  const [error, setError] = useState(null);
  const [filtro, setFiltro] = useState("todos");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    Promise.all([obtenerReferidos(), obtenerConfigReferidos()])
      .then(([f, c]) => {
        setFilas(f);
        setCfg(c);
      })
      .catch((e) => setError(e.message));
  }, []);

  const resumen = useMemo(() => {
    const f = filas || [];
    const hoy = new Date().toISOString().slice(0, 10);
    return {
      total: f.length,
      empezaron: f.filter((r) => r.fechaInstalacion).length,
      pendientesReferido: f.filter((r) => r.premioReferidoEstado === "Pendiente"),
      habilitados: f.filter((r) => r.premioReferidorEstado === "Habilitado" && (!r.premioReferidorVence || r.premioReferidorVence >= hoy)),
      aplicados: f.filter((r) => r.premioReferidoEstado === "Aplicado" || r.premioReferidorEstado === "Aplicado"),
      descontado: f.reduce((a, r) => a + Number(r.premioReferidoMonto || 0) + Number(r.premioReferidorMonto || 0), 0),
    };
  }, [filas]);

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (filas || [])
      .filter((r) => {
        if (filtro === "pendientes") return r.premioReferidoEstado === "Pendiente";
        if (filtro === "habilitados") return r.premioReferidorEstado === "Habilitado";
        if (filtro === "aplicados") return r.premioReferidoEstado === "Aplicado" || r.premioReferidorEstado === "Aplicado";
        return true;
      })
      .filter((r) => !q || r.referidor.toLowerCase().includes(q) || r.referido.toLowerCase().includes(q));
  }, [filas, filtro, busqueda]);

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">🤝 Plan de referidos — Ortodoncia</h1>
      <p className="mt-1 text-sm text-gray-500">
        Quién recomendó a quién, y qué descuentos están habilitados, usados o vencidos. Para anotar que un paciente llegó recomendado, abrí su ficha en
        Ortodoncia → Pacientes y completá «Plan de referidos». Los descuentos se aplican solos desde el cobro.
      </p>

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
      {!filas && !error && <p className="mt-6 text-sm text-gray-500">Cargando...</p>}

      {filas && cfg && (
        <>
          <div className="mt-4 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
            <p>
              <strong>Las reglas del plan:</strong> el paciente nuevo tiene {pesos(cfg.referidos_descuento_instalacion_contado)} menos en la instalación si paga
              todo de contado, o {pesos(cfg.referidos_descuento_instalacion_2_cuotas)} menos en la primera cuota si paga en 2 veces. Quien lo recomendó tiene
              el {cfg.referidos_porcentaje_descuento_control}% de un control cuando el nuevo empieza la instalación, y un control sin costo cada{" "}
              {cfg.referidos_cada_cuantos_control_sin_costo} referidos. Tope de {cfg.referidos_tope_premios_por_anio} premios por año; cada premio dura{" "}
              {cfg.referidos_vigencia_dias} días. Los valores se cambian en Ortodoncia → Catálogo de Precios.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tarjeta titulo="Referidos" valor={resumen.total} detalle={`${resumen.empezaron} ya empezaron la instalación`} activa={filtro === "todos"} onClick={() => setFiltro("todos")} />
            <Tarjeta
              titulo="Descuento en instalación pendiente"
              valor={resumen.pendientesReferido.length}
              detalle="Pacientes nuevos que todavía no lo usaron"
              activa={filtro === "pendientes"}
              onClick={() => setFiltro(filtro === "pendientes" ? "todos" : "pendientes")}
            />
            <Tarjeta
              titulo="Descuentos en control habilitados"
              valor={resumen.habilitados.length}
              detalle="Para quien recomendó, vigentes"
              activa={filtro === "habilitados"}
              onClick={() => setFiltro(filtro === "habilitados" ? "todos" : "habilitados")}
            />
            <Tarjeta
              titulo="Ya aplicados"
              valor={resumen.aplicados.length}
              detalle={`${pesos(resumen.descontado)} descontados en total`}
              activa={filtro === "aplicados"}
              onClick={() => setFiltro(filtro === "aplicados" ? "todos" : "aplicados")}
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
              {visibles.length} referido{visibles.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="mt-2 overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full min-w-[820px] border-collapse text-sm">
              <thead>
                <tr className="bg-brand-brown text-white">
                  <th className="px-3 py-2 text-left font-semibold">Lo recomendó</th>
                  <th className="px-3 py-2 text-left font-semibold">Paciente nuevo</th>
                  <th className="px-3 py-2 text-left font-semibold">Se anotó</th>
                  <th className="px-3 py-2 text-left font-semibold">Empezó la instalación</th>
                  <th className="px-3 py-2 text-left font-semibold">Descuento del nuevo (instalación)</th>
                  <th className="px-3 py-2 text-left font-semibold">Descuento de quien recomendó (control)</th>
                </tr>
              </thead>
              <tbody>
                {visibles.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-4 text-center text-gray-500">
                      Todavía no hay referidos en esta lista.
                    </td>
                  </tr>
                )}
                {visibles.map((r) => (
                  <tr key={r.id} className="border-t border-gray-100 align-top">
                    <td className="px-3 py-2 font-medium text-gray-900">{r.referidor}</td>
                    <td className="px-3 py-2 text-gray-800">{r.referido}</td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-gray-600">{formatoFecha(r.fechaRegistro)}</td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-gray-600">{formatoFecha(r.fechaInstalacion)}</td>
                    <td className="px-3 py-2">
                      <Etiqueta estado={r.premioReferidoEstado} />
                      {r.premioReferidoEstado === "Aplicado" && (
                        <p className="mt-0.5 text-xs text-gray-500">
                          {pesos(r.premioReferidoMonto)} el {formatoFecha(r.premioReferidoAplicadoEn)}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Etiqueta estado={r.premioReferidorEstado} />
                      {r.premioReferidorEstado === "Habilitado" && (
                        <p className="mt-0.5 text-xs text-gray-500">
                          {r.premioReferidorTipo} · hasta el {formatoFecha(r.premioReferidorVence)}
                        </p>
                      )}
                      {r.premioReferidorEstado === "Aplicado" && (
                        <p className="mt-0.5 text-xs text-gray-500">
                          {r.premioReferidorTipo} · {pesos(r.premioReferidorMonto)} el {formatoFecha(r.premioReferidorAplicadoEn)}
                        </p>
                      )}
                      {r.premioReferidorEstado === "En espera" && <p className="mt-0.5 text-xs text-gray-500">Se habilita cuando el nuevo empiece la instalación</p>}
                      {r.observaciones && <p className="mt-0.5 text-xs text-gray-500">{r.observaciones}</p>}
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

export default function ReferidosPage() {
  return (
    <SoloDuenaYSecretaria>
      <ReferidosContenido />
    </SoloDuenaYSecretaria>
  );
}
