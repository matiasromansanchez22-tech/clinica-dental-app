"use client";

import { useEffect, useMemo, useState } from "react";
import {
  actualizarConfiguracionOrtodoncia,
  actualizarConfiguracionOrtodonciaBulk,
  obtenerConfiguracionOrtodoncia,
} from "@/lib/data/pacientesOrtodoncia";
import { CLAVE_PROMO_CONSULTA, hoyEnArgentina, promoConsultaComoNumero, promoConsultaHasta, textoCortoDeFecha } from "@/lib/promoConsulta";

const GRUPOS = [
  {
    titulo: "Instalación",
    filas: [
      { clave: "precio_instalacion_metalica_contado", etiqueta: "Metálico — Contado" },
      { clave: "precio_instalacion_metalica_2_cuotas", etiqueta: "Metálico — 2 Cuotas (valor por cuota)" },
      { clave: "cuota_control_metalico", etiqueta: "Metálico — Cuota mensual de control" },
      { clave: "precio_instalacion_porcelana_contado", etiqueta: "Porcelana — Contado" },
      { clave: "precio_instalacion_porcelana_2_cuotas", etiqueta: "Porcelana — 2 Cuotas (valor por cuota)" },
      { clave: "cuota_control_porcelana", etiqueta: "Porcelana — Cuota mensual de control" },
    ],
  },
  {
    titulo: "Reposición de bracket despegado",
    filas: [
      { clave: "precio_bracket_metalico", etiqueta: "Metálico" },
      { clave: "precio_bracket_porcelana", etiqueta: "Porcelana" },
    ],
  },
  {
    titulo: "Gomas intermaxilares (las elige el ortodoncista en el control)",
    filas: [
      { clave: "precio_gomas_intermaxilar_1_4", etiqueta: "Gomas intermaxilar 1/4" },
      { clave: "precio_gomas_intermaxilar_1_8", etiqueta: "Gomas intermaxilar 1/8" },
    ],
  },
  {
    titulo: "Plan de referidos",
    filas: [
      { clave: "referidos_descuento_instalacion_contado", etiqueta: "Descuento en la instalación del paciente nuevo — si paga todo de contado" },
      { clave: "referidos_descuento_instalacion_2_cuotas", etiqueta: "Descuento en la instalación del paciente nuevo — si paga en 2 veces (se descuenta de la 1.ª cuota)" },
      { clave: "referidos_porcentaje_descuento_control", etiqueta: "Descuento en un control para quien recomendó", unidad: "%" },
      { clave: "referidos_cada_cuantos_control_sin_costo", etiqueta: "Cada cuántos referidos que empiezan es un control sin costo", unidad: "" },
      { clave: "referidos_tope_premios_por_anio", etiqueta: "Máximo de premios por paciente por año", unidad: "" },
      { clave: "referidos_vigencia_dias", etiqueta: "Días que dura el descuento en el control", unidad: "días" },
    ],
  },
  {
    titulo: "Tarjeta de fidelidad (visitas seguidas)",
    filas: [
      { clave: "fidelidad_visitas_descuento", etiqueta: "Visitas seguidas para ganar el descuento en un control", unidad: "visitas" },
      { clave: "fidelidad_porcentaje_descuento", etiqueta: "Descuento en ese control", unidad: "%" },
      { clave: "fidelidad_visitas_control_gratis", etiqueta: "Visitas seguidas para ganar un control sin costo (la tarjeta vuelve a empezar)", unidad: "visitas" },
      { clave: "fidelidad_vigencia_dias", etiqueta: "Días que dura el premio para usarlo", unidad: "días" },
    ],
  },
];

const CAMPOS = GRUPOS.flatMap((g) => g.filas);

// Promoción: consulta de ortodoncia totalmente bonificada hasta una fecha. Se muestra en la página pública, en lo que contesta el asistente,
// en los pedidos de turno online y tilda sola la consulta bonificada al cobrar en Caja.
function PromoConsulta({ config, onGuardado }) {
  const actual = promoConsultaHasta(config[CLAVE_PROMO_CONSULTA]);
  const [fecha, setFecha] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const vigente = Boolean(actual) && actual >= hoyEnArgentina();

  async function guardar(valor) {
    setError(null);
    setGuardando(true);
    try {
      await actualizarConfiguracionOrtodoncia(CLAVE_PROMO_CONSULTA, valor);
      onGuardado(valor);
      setFecha("");
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="mt-5 overflow-hidden rounded-lg border border-emerald-300">
      <div className="bg-brand-green px-4 py-2.5 text-sm font-semibold text-white">🎁 Promoción: consulta bonificada</div>
      <div className="space-y-3 px-4 py-3 text-sm text-gray-700">
        <p>
          {vigente ? (
            <>La consulta de ortodoncia está <strong>totalmente bonificada hasta el {textoCortoDeFecha(actual)}</strong> (turnos de ese día inclusive).</>
          ) : actual ? (
            <>La última promoción terminó el {textoCortoDeFecha(actual)}. Hoy no hay ninguna vigente.</>
          ) : (
            <>Hoy no hay ninguna promoción vigente.</>
          )}{" "}
          Se ve en la página pública, el asistente la cuenta, los pedidos de turno online la mencionan y Caja tilda sola la consulta bonificada.
        </p>
        {error && <p className="rounded bg-red-50 px-2 py-1 text-red-800">{error}</p>}
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-gray-600">
            Bonificada hasta (inclusive)
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="mt-1 block rounded-md border border-gray-300 px-2 py-1.5 text-sm" />
          </label>
          <button
            disabled={!fecha || guardando}
            onClick={() => guardar(promoConsultaComoNumero(fecha))}
            className="rounded-md bg-brand-brown px-3 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
          >
            Cambiar la fecha
          </button>
          {vigente && (
            <button
              disabled={guardando}
              onClick={() => window.confirm("¿Terminar la promoción hoy mismo? La consulta deja de figurar como bonificada.") && guardar(0)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Terminar la promoción
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CatalogoOrtodonciaPage() {
  const [config, setConfig] = useState({});
  const [valores, setValores] = useState({});
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [guardadoOk, setGuardadoOk] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    obtenerConfiguracionOrtodoncia()
      .then((c) => {
        setConfig(c);
        setValores(c);
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  const hayCambios = useMemo(
    () => CAMPOS.some((f) => String(valores[f.clave] ?? "") !== String(config[f.clave] ?? "")),
    [valores, config]
  );

  function set(clave, valor) {
    setGuardadoOk(false);
    setError(null);
    setValores((v) => ({ ...v, [clave]: valor }));
  }

  async function guardar() {
    setError(null);
    const faltante = CAMPOS.find((f) => {
      const v = valores[f.clave];
      return v === "" || v === null || v === undefined || Number(v) <= 0;
    });
    if (faltante) {
      setError(`Completá "${faltante.etiqueta}" con un valor mayor a cero.`);
      return;
    }
    setGuardando(true);
    try {
      const pares = {};
      CAMPOS.forEach((f) => (pares[f.clave] = valores[f.clave]));
      await actualizarConfiguracionOrtodonciaBulk(pares);
      setConfig((c) => ({ ...c, ...pares }));
      setGuardadoOk(true);
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">Catálogo de Precios — Ortodoncia</h1>
      <p className="mt-1 text-sm text-gray-500">
        Estos precios son los que se usan para pre-cargar solos los valores al dar de alta un paciente nuevo o al
        cobrar una reposición de bracket. Siempre se pueden pisar a mano para un paciente puntual.
      </p>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      {cargando ? (
        <p className="mt-4 text-sm text-gray-500">Cargando...</p>
      ) : (
        <>
          {GRUPOS.map((g) => (
            <div key={g.titulo} className="mt-5 overflow-hidden rounded-lg border border-gray-200">
              <div className="bg-brand-brown px-4 py-2.5 text-sm font-semibold text-white">{g.titulo}</div>
              <div className="divide-y divide-gray-100">
                {g.filas.map((f) => (
                  <div key={f.clave} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="text-sm text-gray-700">{f.etiqueta}</span>
                    <div className="flex items-center gap-1 text-sm text-gray-500">
                      {f.unidad === undefined ? "$" : ""}
                      <input
                        type="number"
                        min={0}
                        value={valores[f.clave] ?? ""}
                        onChange={(e) => set(f.clave, e.target.value)}
                        className="w-28 rounded-md border border-gray-300 px-2 py-1 text-right"
                      />
                      {f.unidad ? f.unidad : ""}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <PromoConsulta config={config} onGuardado={(valor) => setConfig((c) => ({ ...c, [CLAVE_PROMO_CONSULTA]: valor }))} />

          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Todavía faltan cargar acá: <strong>Extracción de brackets (desinstalación)</strong> y{" "}
            <strong>Raspaje</strong> — precio a confirmar con Marianela.
          </div>

          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={guardar}
              disabled={!hayCambios || guardando}
              className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
            >
              {guardando ? "Guardando..." : "Guardar cambios"}
            </button>
            {guardadoOk && !hayCambios && <span className="text-sm text-emerald-600">✓ Guardado</span>}
          </div>
        </>
      )}
    </main>
  );
}
