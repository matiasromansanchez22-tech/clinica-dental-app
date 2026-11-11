"use client";

import { useEffect, useRef, useState } from "react";

// Deslizador de antes y después: se arrastra con el dedo o el mouse, o se mueve con el teclado (flechas).
function AntesYDespues({ antes, despues, titulo }) {
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
      className="relative aspect-[4/3] w-full cursor-ew-resize touch-pan-y select-none overflow-hidden rounded-2xl bg-brand-tan/40"
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
      <img src={despues} alt={`${titulo}: después del tratamiento`} className="absolute inset-0 h-full w-full object-cover" draggable={false} loading="lazy" />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - posicion}% 0 0)` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={antes} alt={`${titulo}: antes del tratamiento`} className="h-full w-full object-cover" draggable={false} loading="lazy" />
      </div>
      <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-black/55 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">Antes</span>
      <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-brand-green/90 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">Después</span>
      <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${posicion}%` }}>
        <span className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-brand-brown shadow-lg" aria-hidden="true">
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

// "Nuestros trabajos": casos reales publicados con autorización de los pacientes. Si todavía no hay ninguno, la sección no aparece.
export default function GaleriaCasos() {
  const [casos, setCasos] = useState([]);

  useEffect(() => {
    fetch("/api/publico/galeria")
      .then((r) => r.json())
      .then((d) => d.ok && setCasos(d.casos || []))
      .catch(() => {});
  }, []);

  if (casos.length === 0) return null;

  return (
    <section id="trabajos" className="mx-auto max-w-5xl px-5 py-10">
      <p className="text-sm font-semibold uppercase tracking-widest text-brand-brown/70">Nuestros trabajos</p>
      <h2 className="font-heading mt-1 text-2xl font-extrabold text-brand-brown sm:text-3xl">Casos reales de nuestros pacientes</h2>
      <p className="mt-2 max-w-2xl text-brand-charcoal/80">Deslizá cada foto para ver el antes y el después.</p>
      <div className="-mx-5 mt-6 flex snap-x snap-mandatory gap-5 overflow-x-auto px-5 pb-4">
        {casos.map((c) => (
          <article key={c.id} className="w-[85%] shrink-0 snap-center rounded-3xl bg-white p-4 shadow-sm ring-1 ring-brand-tan/70 sm:w-[420px]">
            <AntesYDespues antes={c.antes} despues={c.despues} titulo={c.titulo} />
            <h3 className="font-heading mt-3 text-xl font-extrabold text-brand-brown">{c.titulo}</h3>
            {(c.tratamiento || c.duracionMeses) && (
              <p className="mt-0.5 text-sm font-semibold text-brand-green">
                {[c.tratamiento, c.duracionMeses ? `${c.duracionMeses} meses de tratamiento` : null].filter(Boolean).join(" · ")}
              </p>
            )}
            {c.descripcion && <p className="mt-1 text-sm text-brand-charcoal/80">{c.descripcion}</p>}
          </article>
        ))}
      </div>
      <p className="mt-2 text-xs text-brand-charcoal/60">Fotos publicadas con la autorización de cada paciente. Los resultados varían en cada caso: el profesional evalúa el tuyo en la consulta.</p>
    </section>
  );
}
