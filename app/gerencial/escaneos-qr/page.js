"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import SoloDuena from "@/components/SoloDuena";
import { fechaDeHoyISO, sumarDias } from "@/lib/agenda";
import { urlPlanReferidos } from "@/lib/planReferidos";
import {
  cambiarActivoLugarQr,
  contarReferidosDesde,
  crearLugarQr,
  obtenerEscaneosDesde,
  obtenerLugaresQr,
  partesLocales,
  ZONA_HORARIA,
} from "@/lib/data/escaneosQr";

const PERIODOS = [
  { clave: "hoy", texto: "Hoy", dias: 1 },
  { clave: "7", texto: "7 días", dias: 7 },
  { clave: "30", texto: "30 días", dias: 30 },
  { clave: "90", texto: "90 días", dias: 90 },
];
const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const formatoNumero = (n) => Number(n || 0).toLocaleString("es-AR");
const fechaCorta = (iso) => `${Number(iso.slice(8, 10))} ${MESES_CORTOS[Number(iso.slice(5, 7)) - 1]}`;
const formatoHora = new Intl.DateTimeFormat("es-AR", { timeZone: ZONA_HORARIA, hour: "2-digit", minute: "2-digit" });

function tiempoRelativo(creadoEn, hoy) {
  const minutos = Math.round((Date.now() - new Date(creadoEn).getTime()) / 60000);
  if (minutos < 1) return "recién";
  if (minutos < 60) return `hace ${minutos} min`;
  const { fecha } = partesLocales(creadoEn);
  const hora = formatoHora.format(new Date(creadoEn));
  if (fecha === hoy) return `hoy ${hora}`;
  if (fecha === sumarDias(hoy, -1)) return `ayer ${hora}`;
  return `${fechaCorta(fecha)} ${hora}`;
}

function Delta({ actual, anterior }) {
  if (anterior == null) return null;
  if (anterior === 0) return actual > 0 ? <span className="text-xs font-medium text-emerald-700">nuevo en este período</span> : null;
  const pct = Math.round(((actual - anterior) / anterior) * 100);
  if (pct === 0) return <span className="text-xs text-gray-500">igual que el período anterior</span>;
  return (
    <span className={`text-xs font-medium ${pct > 0 ? "text-emerald-700" : "text-red-700"}`}>
      {pct > 0 ? "▲" : "▼"} {Math.abs(pct)}% vs el período anterior
    </span>
  );
}

function Tarjeta({ titulo, valor, pie, destacada }) {
  return (
    <div className={`flex flex-col gap-1 rounded-xl border px-4 py-3 ${destacada ? "border-brand-brown bg-brand-brown text-brand-cream" : "border-brand-tan/60 bg-white"}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${destacada ? "text-brand-tan" : "text-brand-brown/70"}`}>{titulo}</p>
      <p className={`font-heading text-3xl font-extrabold leading-none ${destacada ? "text-white" : "text-brand-charcoal"}`}>{valor}</p>
      <div className={destacada ? "text-brand-tan [&_span]:!text-brand-tan" : ""}>{pie}</div>
    </div>
  );
}

function Bloque({ titulo, subtitulo, children }) {
  return (
    <section className="rounded-xl border border-brand-tan/60 bg-white p-4">
      <h2 className="font-heading text-sm font-bold text-brand-brown">{titulo}</h2>
      {subtitulo && <p className="text-xs text-gray-500">{subtitulo}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

// Barras por día: la de hoy va en marrón, las demás en verde.
function GraficoDiario({ serie, hoy }) {
  const ancho = 640;
  const alto = 150;
  const base = 22;
  const maximo = Math.max(1, ...serie.map((d) => d.cantidad));
  const paso = ancho / serie.length;
  const grosor = Math.max(2, Math.min(26, paso * 0.68));
  const rotulos = serie.length <= 10 ? 1 : Math.ceil(serie.length / 8);
  return (
    <svg viewBox={`0 0 ${ancho} ${alto}`} className="h-44 w-full" role="img" aria-label="Escaneos por día">
      {[0, 0.5, 1].map((f) => {
        const y = alto - base - (alto - base - 8) * f;
        return (
          <g key={f}>
            <line x1="0" x2={ancho} y1={y} y2={y} stroke="#edcfaa" strokeOpacity="0.6" strokeDasharray={f === 0 ? "" : "3 4"} />
            {f > 0 && (
              <text x="2" y={y - 3} fontSize="9" fill="#6d3c1b" fillOpacity="0.6">
                {Math.round(maximo * f)}
              </text>
            )}
          </g>
        );
      })}
      {serie.map((d, i) => {
        const h = d.cantidad > 0 ? Math.max(3, ((alto - base - 8) * d.cantidad) / maximo) : 0;
        const x = i * paso + (paso - grosor) / 2;
        return (
          <g key={d.fecha}>
            <rect x={x} y={alto - base - h} width={grosor} height={h} rx={Math.min(4, grosor / 2)} fill={d.fecha === hoy ? "#6d3c1b" : "#2d5447"}>
              <title>
                {fechaCorta(d.fecha)}: {d.cantidad} escaneo{d.cantidad === 1 ? "" : "s"}
              </title>
            </rect>
            {i % rotulos === 0 && (
              <text x={x + grosor / 2} y={alto - 6} fontSize="9" textAnchor="middle" fill="#2c282d" fillOpacity="0.65">
                {fechaCorta(d.fecha)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function BarrasHorizontales({ filas, color = "bg-brand-green" }) {
  const maximo = Math.max(1, ...filas.map((f) => f.cantidad));
  return (
    <ul className="flex flex-col gap-2">
      {filas.map((f) => (
        <li key={f.clave} className="text-sm">
          <div className="flex justify-between gap-2">
            <span className="text-brand-charcoal">{f.texto}</span>
            <span className="font-semibold text-brand-charcoal">
              {formatoNumero(f.cantidad)} <span className="font-normal text-gray-500">· {f.porcentaje}%</span>
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-brand-tan/30">
            <div className={`h-full rounded-full ${color}`} style={{ width: `${(f.cantidad / maximo) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function PorHora({ horas }) {
  const maximo = Math.max(1, ...horas);
  return (
    <div>
      <div className="grid grid-cols-12 gap-1 sm:grid-cols-24" style={{ gridTemplateColumns: "repeat(24, minmax(0, 1fr))" }}>
        {horas.map((c, h) => (
          <div key={h} title={`${h}:00 a ${h}:59 — ${c} escaneo${c === 1 ? "" : "s"}`} className="flex flex-col items-center gap-1">
            <div className="h-10 w-full rounded-sm bg-brand-green" style={{ opacity: c === 0 ? 0.08 : 0.2 + 0.8 * (c / maximo) }} />
            <span className="text-[9px] text-gray-500">{h % 3 === 0 ? h : ""}</span>
          </div>
        ))}
      </div>
      <p className="mt-1 text-xs text-gray-500">Hora del día (más oscuro = más escaneos)</p>
    </div>
  );
}

function CartelDeLugar({ lugar, qr, escaneos, onActivo }) {
  const link = urlPlanReferidos(lugar.clave);
  const [copiado, setCopiado] = useState(false);
  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      window.prompt("Copiá este link:", link);
    }
  }
  return (
    <div className={`flex gap-3 rounded-xl border p-3 ${lugar.activo ? "border-brand-tan/60 bg-white" : "border-gray-200 bg-gray-50 opacity-70"}`}>
      <div className="h-24 w-24 shrink-0 rounded-lg border border-brand-tan/60 bg-white p-1.5 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qr || "" }} />
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="font-semibold text-brand-charcoal">{lugar.nombre}</p>
        <p className="text-xs text-gray-500">
          {formatoNumero(escaneos)} escaneo{escaneos === 1 ? "" : "s"} en el período
        </p>
        <p className="mt-0.5 truncate text-[11px] text-gray-400">{link.replace("https://", "")}</p>
        <div className="mt-auto flex flex-wrap gap-2 pt-2">
          <a
            href={`/referidos/cartel${lugar.clave === "general" ? "" : `?lugar=${lugar.clave}`}`}
            target="_blank"
            rel="noreferrer"
            className="rounded-md bg-brand-brown px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-brown-dark"
          >
            🖨 Imprimir cartel
          </a>
          <button onClick={copiar} className="rounded-md border border-brand-brown/40 px-2.5 py-1 text-xs text-brand-brown hover:bg-brand-tan/30">
            {copiado ? "✓ Copiado" : "Copiar link"}
          </button>
          {lugar.clave !== "general" && (
            <button onClick={() => onActivo(lugar)} className="rounded-md px-2 py-1 text-xs text-gray-500 hover:underline">
              {lugar.activo ? "Ocultar" : "Mostrar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EscaneosContenido() {
  const hoy = fechaDeHoyISO();
  const [periodo, setPeriodo] = useState("30");
  const [escaneos, setEscaneos] = useState([]);
  const [lugares, setLugares] = useState([]);
  const [referidos, setReferidos] = useState(null);
  const [qrs, setQrs] = useState({});
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [nuevoLugar, setNuevoLugar] = useState("");

  const dias = PERIODOS.find((p) => p.clave === periodo).dias;
  const desde = sumarDias(hoy, -(dias - 1));
  const desdeAnterior = sumarDias(hoy, -(dias * 2 - 1));

  async function cargar() {
    setError(null);
    try {
      const [e, l, r] = await Promise.all([obtenerEscaneosDesde(desdeAnterior), obtenerLugaresQr(), contarReferidosDesde(desde).catch(() => null)]);
      setEscaneos(e);
      setLugares(l);
      setReferidos(r);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodo]);

  // QR de cada lugar (para mostrarlo y que se pueda imprimir el cartel).
  useEffect(() => {
    let vigente = true;
    Promise.all(
      lugares.map((l) =>
        QRCode.toString(urlPlanReferidos(l.clave), { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#2c282d", light: "#ffffff" } }).then((svg) => [l.clave, svg])
      )
    )
      .then((pares) => vigente && setQrs(Object.fromEntries(pares)))
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [lugares]);

  const datos = useMemo(() => {
    const conFecha = escaneos.map((e) => ({ ...e, ...partesLocales(e.created_at) }));
    const actuales = conFecha.filter((e) => e.fecha >= desde);
    const anteriores = conFecha.filter((e) => e.fecha < desde);
    const personas = (lista) => new Set(lista.map((e) => e.visitante)).size;

    const serie = Array.from({ length: Math.min(dias, 90) }, (_, i) => {
      const fecha = sumarDias(hoy, -(Math.min(dias, 90) - 1 - i));
      return { fecha, cantidad: actuales.filter((e) => e.fecha === fecha).length };
    });
    const mejorDia = serie.reduce((m, d) => (d.cantidad > m.cantidad ? d : m), { cantidad: 0 });

    const nombreLugar = Object.fromEntries(lugares.map((l) => [l.clave, l.nombre]));
    const conteoLugar = {};
    for (const e of actuales) conteoLugar[e.lugar] = (conteoLugar[e.lugar] || 0) + 1;
    const total = actuales.length;
    const porLugar = Object.entries(conteoLugar)
      .map(([clave, cantidad]) => ({ clave, texto: nombreLugar[clave] || clave, cantidad, porcentaje: Math.round((cantidad / total) * 100) }))
      .sort((a, b) => b.cantidad - a.cantidad);

    const horas = Array.from({ length: 24 }, (_, h) => actuales.filter((e) => e.hora === h).length);
    const horaPico = horas.indexOf(Math.max(...horas));
    const semana = Array.from({ length: 7 }, (_, d) => actuales.filter((e) => e.diaSemana === d).length);
    // lunes a domingo
    const ordenSemana = [1, 2, 3, 4, 5, 6, 0].map((d) => ({ clave: String(d), texto: DIAS_CORTOS[d], cantidad: semana[d], porcentaje: total ? Math.round((semana[d] / total) * 100) : 0 }));
    const dispositivos = ["Celular", "Tablet", "Computadora"]
      .map((d) => ({ clave: d, texto: d, cantidad: actuales.filter((e) => e.dispositivo === d).length }))
      .map((d) => ({ ...d, porcentaje: total ? Math.round((d.cantidad / total) * 100) : 0 }))
      .filter((d) => d.cantidad > 0);

    return {
      total,
      anterior: anteriores.length,
      personas: personas(actuales),
      personasAnterior: personas(anteriores),
      hoyCantidad: conFecha.filter((e) => e.fecha === hoy).length,
      promedio: total / dias,
      mejorDia,
      serie,
      porLugar,
      conteoLugar,
      horas,
      horaPico: total ? horaPico : null,
      ordenSemana,
      dispositivos,
      ultimos: conFecha.slice(0, 12),
      nombreLugar,
      totalHistorico: conFecha.length,
    };
  }, [escaneos, lugares, desde, dias, hoy]);

  async function agregarLugar(e) {
    e.preventDefault();
    if (!nuevoLugar.trim()) return;
    setError(null);
    try {
      await crearLugarQr(nuevoLugar);
      setNuevoLugar("");
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function alternarLugar(lugar) {
    setError(null);
    try {
      await cambiarActivoLugarQr(lugar.id, !lugar.activo);
      await cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-brown/70">Ortodoncia · Planes</p>
          <h1 className="font-heading text-3xl font-extrabold text-brand-brown">📲 Escaneos del QR</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Cuántas veces se escaneó el QR de los planes de ortodoncia (tarjeta de fidelidad y plan de referidos), de qué cartel y a qué hora.
            Es anónimo: no se guarda ningún dato de las personas.
          </p>
        </div>
        <div className="flex overflow-hidden rounded-lg border border-brand-tan">
          {PERIODOS.map((p) => (
            <button
              key={p.clave}
              onClick={() => setPeriodo(p.clave)}
              className={`px-3 py-1.5 text-sm font-medium ${periodo === p.clave ? "bg-brand-brown text-white" : "bg-white text-brand-brown hover:bg-brand-tan/30"}`}
            >
              {p.texto}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}

      {cargando ? (
        <p className="mt-6 text-sm text-gray-500">Cargando...</p>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tarjeta titulo="Escaneos" valor={formatoNumero(datos.total)} destacada pie={<Delta actual={datos.total} anterior={datos.anterior} />} />
            <Tarjeta titulo="Personas distintas" valor={formatoNumero(datos.personas)} pie={<Delta actual={datos.personas} anterior={datos.personasAnterior} />} />
            <Tarjeta
              titulo="Hoy"
              valor={formatoNumero(datos.hoyCantidad)}
              pie={<span className="text-xs text-gray-500">{datos.total > 0 ? `${datos.promedio.toLocaleString("es-AR", { maximumFractionDigits: 1 })} por día en promedio` : "todavía sin escaneos"}</span>}
            />
            <Tarjeta
              titulo="Referidos anotados"
              valor={referidos == null ? "—" : formatoNumero(referidos)}
              pie={<span className="text-xs text-gray-500">en recepción, en el mismo período</span>}
            />
          </div>

          {datos.totalHistorico === 0 && (
            <div className="mt-4 rounded-xl border border-brand-tan bg-brand-cream px-4 py-3 text-sm text-brand-brown">
              <strong>Todavía no hay escaneos registrados.</strong> Apenas alguien escanee un QR, aparece acá. Los carteles que ya están impresos
              cuentan como “Cartel sin lugar”; para saber de qué lugar viene cada escaneo, imprimí el cartel de cada lugar (abajo).
            </div>
          )}

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Bloque
                titulo="Escaneos por día"
                subtitulo={datos.mejorDia.cantidad > 0 ? `Mejor día: ${fechaCorta(datos.mejorDia.fecha)} con ${datos.mejorDia.cantidad} escaneo${datos.mejorDia.cantidad === 1 ? "" : "s"}` : "Todavía sin datos en este período"}
              >
                <GraficoDiario serie={datos.serie} hoy={hoy} />
              </Bloque>
            </div>
            <Bloque titulo="De dónde vienen" subtitulo="Por cartel o lugar">
              {datos.porLugar.length === 0 ? <p className="text-sm text-gray-500">Sin escaneos en este período.</p> : <BarrasHorizontales filas={datos.porLugar} />}
            </Bloque>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Bloque titulo="¿A qué hora escanean?" subtitulo={datos.horaPico != null ? `Hora pico: entre las ${datos.horaPico}:00 y las ${datos.horaPico}:59` : undefined}>
                <PorHora horas={datos.horas} />
                <div className="mt-4 border-t border-brand-tan/40 pt-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-brown/70">Por día de la semana</p>
                  <BarrasHorizontales filas={datos.ordenSemana} />
                </div>
              </Bloque>
            </div>
            <div className="flex flex-col gap-4">
              <Bloque titulo="Desde qué dispositivo">
                {datos.dispositivos.length === 0 ? <p className="text-sm text-gray-500">Sin datos.</p> : <BarrasHorizontales filas={datos.dispositivos} color="bg-brand-brown" />}
              </Bloque>
              <Bloque titulo="Últimos escaneos">
                {datos.ultimos.length === 0 ? (
                  <p className="text-sm text-gray-500">Todavía no hay.</p>
                ) : (
                  <ul className="divide-y divide-brand-tan/30 text-sm">
                    {datos.ultimos.map((e, i) => (
                      <li key={i} className="flex items-center justify-between gap-2 py-1.5">
                        <span className="truncate text-brand-charcoal">{datos.nombreLugar[e.lugar] || e.lugar}</span>
                        <span className="whitespace-nowrap text-xs text-gray-500">
                          {e.dispositivo} · {tiempoRelativo(e.created_at, hoy)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Bloque>
            </div>
          </div>

          <div className="mt-6">
            <h2 className="font-heading text-lg font-bold text-brand-brown">🖨 Carteles por lugar</h2>
            <p className="text-sm text-gray-600">
              Cada lugar tiene su propio QR: imprimí el cartel y pegalo ahí, así sabés cuál rinde más. Los escaneos se empiezan a contar desde que se
              escanea el nuevo.
            </p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {lugares.map((l) => (
                <CartelDeLugar key={l.id} lugar={l} qr={qrs[l.clave]} escaneos={datos.conteoLugar[l.clave] || 0} onActivo={alternarLugar} />
              ))}
            </div>
            <form onSubmit={agregarLugar} className="mt-3 flex flex-wrap items-center gap-2">
              <input
                value={nuevoLugar}
                onChange={(e) => setNuevoLugar(e.target.value)}
                placeholder="Nuevo lugar (ej. Baño, Vidriera, Folleto)"
                className="w-72 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
              <button type="submit" disabled={!nuevoLugar.trim()} className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50">
                + Agregar lugar
              </button>
            </form>
          </div>
        </>
      )}
    </main>
  );
}

export default function EscaneosQrPage() {
  return (
    <SoloDuena>
      <EscaneosContenido />
    </SoloDuena>
  );
}
