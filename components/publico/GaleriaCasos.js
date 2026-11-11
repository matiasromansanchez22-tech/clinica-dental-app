"use client";

import { useEffect, useRef, useState } from "react";

// Protección básica de las fotos: sin menú de clic derecho ni arrastrar (además llevan la marca de agua de la clínica dentro de la imagen).
const bloquear = (e) => e.preventDefault();

// Deslizador de antes y después: se arrastra con el dedo o el mouse, o se mueve con el teclado (flechas).
function Comparador({ antes, despues, titulo, etiquetaDespues }) {
  const [posicion, setPosicion] = useState(50);
  const caja = useRef(null);
  const arrastrando = useRef(false);

  function mover(clientX) {
    const r = caja.current?.getBoundingClientRect();
    if (!r) return;
    setPosicion(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100)));
  }

  return (
    <div
      ref={caja}
      className="relative aspect-[3/2] w-full cursor-ew-resize touch-pan-y select-none overflow-hidden bg-brand-tan/40 [-webkit-touch-callout:none]"
      onContextMenu={bloquear}
      onDragStart={bloquear}
      onPointerDown={(e) => {
        arrastrando.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        mover(e.clientX);
      }}
      onPointerMove={(e) => arrastrando.current && mover(e.clientX)}
      onPointerUp={() => (arrastrando.current = false)}
      onPointerCancel={() => (arrastrando.current = false)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={despues} alt={`${titulo}: ${etiquetaDespues}`} className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover" draggable={false} loading="lazy" />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - posicion}% 0 0)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={antes} alt={`${titulo}: antes del tratamiento`} className="pointer-events-none h-full w-full select-none object-cover" draggable={false} loading="lazy" />
      </div>
      <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/55 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">Antes</span>
      <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-brand-green/90 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">{etiquetaDespues}</span>
      <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${posicion}%` }}>
        <span className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-lg text-brand-brown shadow-lg" aria-hidden="true">
          ⇆
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(posicion)}
        onChange={(e) => setPosicion(Number(e.target.value))}
        aria-label={`Comparar antes y después: ${titulo}`}
        className="absolute inset-x-0 bottom-0 h-full w-full cursor-ew-resize opacity-0"
        style={{ pointerEvents: "none" }}
        tabIndex={0}
      />
    </div>
  );
}

// Fotos de a una, grandes y completas, para pasar con el dedo (o con las flechas en la compu), como un posteo con varias fotos.
function Fotos({ caso, onAbrir }) {
  const pista = useRef(null);
  const [indice, setIndice] = useState(0);
  const diapositivas = [
    { src: caso.antes, etiqueta: "Antes" },
    { src: caso.despues, etiqueta: caso.etiquetaDespues },
  ];

  function alMover() {
    const el = pista.current;
    if (el) setIndice(Math.round(el.scrollLeft / el.clientWidth));
  }
  function ir(i) {
    const el = pista.current;
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div className="relative">
      <div
        ref={pista}
        onScroll={alMover}
        onContextMenu={bloquear}
        onDragStart={bloquear}
        className="flex snap-x snap-mandatory overflow-x-auto [-webkit-touch-callout:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {diapositivas.map((d) => (
          <button
            key={d.etiqueta}
            type="button"
            onClick={() => onAbrir(d)}
            aria-label={`Ver en pantalla grande: ${d.etiqueta}`}
            className="relative aspect-[3/2] w-full shrink-0 cursor-zoom-in snap-center select-none"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={d.src} alt={`${caso.titulo}: ${d.etiqueta}`} className="pointer-events-none h-full w-full select-none object-cover" draggable={false} loading="lazy" />
            <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/55 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">{d.etiqueta}</span>
          </button>
        ))}
      </div>
      {indice > 0 && (
        <button onClick={() => ir(indice - 1)} aria-label="Foto anterior" className="absolute left-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl text-brand-brown shadow sm:flex">
          ‹
        </button>
      )}
      {indice < diapositivas.length - 1 && (
        <button onClick={() => ir(indice + 1)} aria-label="Foto siguiente" className="absolute right-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl text-brand-brown shadow sm:flex">
          ›
        </button>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
        {diapositivas.map((d, i) => (
          <span key={d.etiqueta} className={`h-1.5 rounded-full transition-all ${i === indice ? "w-5 bg-white" : "w-1.5 bg-white/60"}`} />
        ))}
      </div>
    </div>
  );
}

function Posteo({ caso, onAbrir }) {
  const [comparar, setComparar] = useState(false);
  // Si la segunda foto no es "Después" (el resultado final), el tratamiento todavía sigue.
  const enCurso = caso.etiquetaDespues && caso.etiquetaDespues !== "Después";
  return (
    <article className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-brand-tan/70">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-claro.png" alt="" className="h-10 w-10 shrink-0 rounded-full bg-brand-cream object-contain ring-1 ring-brand-tan" />
        <div className="min-w-0 flex-1 basis-36">
          <p className="truncate text-sm font-bold text-brand-charcoal">Marianela Ramírez</p>
          <p className="truncate text-xs text-brand-charcoal/60">Clínica Dental · {caso.tratamiento || "Ortodoncia"}</p>
        </div>
        <span className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${enCurso ? "bg-brand-tan/70 text-brand-brown" : "bg-brand-mint/50 text-brand-green"}`}>
          {enCurso && <span className="h-2 w-2 animate-pulse rounded-full bg-brand-green" aria-hidden="true" />}
          {enCurso ? "Tratamiento en curso" : "Resultado final"}
        </span>
      </header>

      {comparar ? <Comparador antes={caso.antes} despues={caso.despues} titulo={caso.titulo} etiquetaDespues={caso.etiquetaDespues} /> : <Fotos caso={caso} onAbrir={onAbrir} />}

      <div className="flex items-center justify-between gap-3 px-4 pt-3">
        <p className="text-xs text-brand-charcoal/60">{comparar ? "Deslizá sobre la foto para comparar" : "Deslizá para ver cada foto · tocá para agrandar"}</p>
        <button
          onClick={() => setComparar((v) => !v)}
          className="shrink-0 rounded-full border-2 border-brand-green px-4 py-1.5 text-sm font-bold text-brand-green hover:bg-brand-green hover:text-brand-cream"
        >
          {comparar ? "Ver fotos" : "⇆ Comparar"}
        </button>
      </div>

      <div className="px-4 pb-4 pt-2">
        <p className="text-[15px] leading-snug text-brand-charcoal">
          <strong>Clínica Dental Marianela Ramírez</strong> {caso.titulo}
        </p>
        {caso.descripcion && <p className="mt-1 text-sm text-brand-charcoal/80">{caso.descripcion}</p>}
        {caso.duracionMeses && <p className="mt-1 text-sm font-semibold text-brand-green">{caso.duracionMeses} meses de tratamiento</p>}
      </div>
    </article>
  );
}

// Foto en pantalla grande, completa (se cierra tocando, con la X o con Esc).
function PantallaGrande({ foto, onCerrar }) {
  useEffect(() => {
    if (!foto) return;
    const alTeclear = (e) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", alTeclear);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = overflow;
    };
  }, [foto, onCerrar]);

  if (!foto) return null;
  return (
    <div role="dialog" aria-label={`Foto: ${foto.etiqueta}`} className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3 [-webkit-touch-callout:none]" onClick={onCerrar} onContextMenu={bloquear}>
      <button onClick={onCerrar} aria-label="Cerrar" className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-2xl text-white hover:bg-white/25">
        ✕
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={foto.src} alt={foto.etiqueta} className="max-h-[88vh] max-w-full select-none rounded-xl object-contain" draggable={false} onDragStart={bloquear} />
      <span className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1.5 text-sm font-bold uppercase tracking-wide text-white">{foto.etiqueta}</span>
    </div>
  );
}

// "Nuestros trabajos": casos reales publicados con autorización de los pacientes, como un feed de posteos. Si todavía no hay ninguno,
// la sección no aparece.
export default function GaleriaCasos() {
  const [casos, setCasos] = useState([]);
  const [grande, setGrande] = useState(null);

  useEffect(() => {
    fetch("/api/publico/galeria")
      .then((r) => r.json())
      .then((d) => d.ok && setCasos(d.casos || []))
      .catch(() => {});
  }, []);

  if (casos.length === 0) return null;

  return (
    <section id="trabajos" className="mx-auto max-w-2xl px-3 py-10 sm:px-5">
      <p className="text-sm font-semibold uppercase tracking-widest text-brand-brown/70">Nuestros trabajos</p>
      <h2 className="font-heading mt-1 text-2xl font-extrabold text-brand-brown sm:text-3xl">Casos reales de nuestros pacientes</h2>
      <p className="mt-2 text-brand-charcoal/80">Mirá cómo avanzan los tratamientos.</p>
      <div className="mt-6 flex flex-col gap-8">
        {casos.map((c) => (
          <Posteo key={c.id} caso={c} onAbrir={setGrande} />
        ))}
      </div>
      <p className="mt-4 text-xs text-brand-charcoal/60">Fotos publicadas con la autorización de cada paciente. Los resultados varían en cada caso: el profesional evalúa el tuyo en la consulta.</p>
      <PantallaGrande foto={grande} onCerrar={() => setGrande(null)} />
    </section>
  );
}
