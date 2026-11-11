"use client";

import { useEffect, useState } from "react";
import { pesosAR, registrarEscaneoPlan, urlWhatsApp, WHATSAPP_CLINICA_VISIBLE } from "@/lib/planReferidos";

// Página pública para pacientes (se abre con el QR o el link, sin iniciar sesión): qué es el tratamiento de ortodoncia, cuánto
// sale y cómo pedir turno por WhatsApp. Los valores salen de la misma configuración que usa el sistema (ruta /api/publico/ortodoncia),
// así que cuando se cambia un precio en el Catálogo de Ortodoncia, esta página se actualiza sola.

const MENSAJE_WHATSAPP = "¡Hola! Vi la información de ortodoncia en la página de la clínica y quiero pedir un turno de consulta.";

const PASOS = [
  { titulo: "Consulta", texto: "Te revisamos, evaluamos tu caso y te explicamos qué tratamiento necesitás y cómo sería." },
  { titulo: "Instalación", texto: "Colocamos los brackets (los aparatos). Podés elegir entre metálicos o de porcelana." },
  { titulo: "Controles mensuales", texto: "Venís una vez por mes para ajustar los aparatos y seguir el avance de tu tratamiento." },
  { titulo: "Final del tratamiento", texto: "Cuando terminamos, retiramos los aparatos y te indicamos cómo mantener el resultado." },
];

function BotonWhatsApp({ className = "", children = "Pedir turno por WhatsApp" }) {
  return (
    <a
      href={urlWhatsApp(MENSAJE_WHATSAPP)}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-base font-bold shadow-sm transition-transform hover:-translate-y-0.5 ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
        <path d="M20.5 3.5A11.8 11.8 0 0 0 12 0C5.4 0 .1 5.3.1 11.9c0 2.1.6 4.1 1.6 5.9L0 24l6.4-1.7a11.9 11.9 0 0 0 5.6 1.4c6.6 0 11.9-5.3 11.9-11.9 0-3.2-1.2-6.2-3.4-8.3zM12 21.7c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.8 1 1-3.7-.2-.4a9.8 9.8 0 0 1-1.5-5.1C2.1 6.5 6.5 2.1 12 2.1c2.6 0 5.1 1 6.9 2.9a9.7 9.7 0 0 1 2.9 6.9c0 5.4-4.4 9.8-9.8 9.8zm5.4-7.3c-.3-.1-1.8-.9-2-1s-.5-.1-.7.1-.8 1-.9 1.1-.3.2-.6.1a8 8 0 0 1-4-3.5c-.3-.5.3-.5.9-1.6.1-.2 0-.4 0-.5l-.9-2.1c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4s-1 1-1 2.4 1 2.8 1.2 3c.1.2 2 3.1 4.9 4.3 1.8.8 2.5.8 3.4.7.6-.1 1.8-.7 2-1.4s.2-1.3.2-1.4-.2-.2-.5-.4z" />
      </svg>
      {children}
    </a>
  );
}

function TarjetaValores({ titulo, subtitulo, contado, cuotaDe, control, bracket, oscura }) {
  const base = oscura ? "bg-brand-brown text-brand-cream" : "border-2 border-brand-brown bg-white text-brand-charcoal";
  const apagado = oscura ? "text-brand-tan" : "text-brand-brown/70";
  const linea = oscura ? "bg-brand-cream/20" : "bg-brand-brown/15";
  return (
    <div className={`rounded-2xl p-6 shadow-sm ${base}`}>
      <p className={`text-xs font-semibold uppercase tracking-widest ${apagado}`}>{subtitulo}</p>
      <h3 className={`font-heading mt-1 text-2xl font-extrabold ${oscura ? "" : "text-brand-brown"}`}>{titulo}</h3>

      <p className={`mt-4 text-xs font-semibold uppercase tracking-widest ${apagado}`}>Instalación</p>
      <p className="font-heading mt-1 text-3xl font-extrabold">{pesosAR(contado)}</p>
      <p className="text-sm opacity-90">pagando todo de contado</p>
      <p className="mt-2 text-base font-semibold">
        o 2 cuotas de {pesosAR(cuotaDe)}
      </p>

      <div className={`my-4 h-px ${linea}`} />
      <p className={`text-xs font-semibold uppercase tracking-widest ${apagado}`}>Control mensual</p>
      <p className="font-heading mt-1 text-2xl font-extrabold">{pesosAR(control)}</p>

      <div className={`my-4 h-px ${linea}`} />
      <p className="text-sm opacity-90">
        Si se despega un bracket, la reposición es de <strong>{pesosAR(bracket)}</strong> cada uno.
      </p>
    </div>
  );
}

const PREGUNTAS = [
  {
    p: "¿Cuánto dura el tratamiento?",
    r: "En general entre 18 y 24 meses, pero depende de cada caso. En la consulta el profesional te da una estimación para tu situación.",
  },
  {
    p: "¿Cómo se paga?",
    r: "La instalación se puede pagar de contado o en 2 cuotas, y después hay un control cada mes. Los valores de referencia están más arriba y se confirman en la consulta.",
  },
  {
    p: "¿Qué diferencia hay entre brackets metálicos y de porcelana?",
    r: "Los dos cumplen la misma función. Los de porcelana son del color del diente, por eso se notan menos. Los metálicos son más económicos. En la consulta te ayudamos a elegir.",
  },
  {
    p: "¿Qué pasa si no puedo ir a un control?",
    r: "Avisanos con tiempo y lo reprogramamos. Si avisás antes, no perdés tus visitas de la tarjeta de fidelidad. Venir a los controles es lo que mantiene el tratamiento en tiempo.",
  },
  {
    p: "¿Y si se me despega un bracket?",
    r: "Avisanos y te damos un turno para reponerlo. Cada bracket despegado se abona aparte, al valor indicado más arriba.",
  },
  {
    p: "¿Cómo pido turno para la consulta?",
    r: `Tocá el botón de WhatsApp y escribinos. Te respondemos para coordinar el día y el horario que mejor te quede. También podés escribirnos al ${WHATSAPP_CLINICA_VISIBLE}.`,
  },
];

export default function OrtodonciaInfoPublica() {
  const [v, setV] = useState(null); // valores de la configuración; null = todavía no llegaron o no se pudieron leer

  // Cada vez que alguien abre la página (por el QR o el link) se anota la visita, de forma anónima.
  useEffect(() => {
    registrarEscaneoPlan("ortodoncia");
  }, []);

  useEffect(() => {
    fetch("/api/publico/ortodoncia")
      .then((r) => r.json())
      .then((d) => d.ok && d.valores && setV(d.valores))
      .catch(() => {});
  }, []);

  const hayPrecios = v && v.precio_instalacion_metalica_contado && v.precio_instalacion_porcelana_contado && v.cuota_control_metalico;
  const mesAnio = new Date().toLocaleDateString("es-AR", { month: "long", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" });

  return (
    <main className="min-h-screen bg-brand-cream pb-24 text-brand-charcoal">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 pt-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-claro.png" alt="Clínica Dental Marianela Ramírez" className="h-14 w-auto mix-blend-multiply" />
        <span className="rounded-full bg-brand-tan/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-brown">Ortodoncia</span>
      </header>

      <section className="mx-auto max-w-3xl px-5 pb-8 pt-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-brown/70">Ortodoncia · Rosario</p>
        <h1 className="font-heading mt-2 text-4xl font-extrabold leading-tight text-brand-brown sm:text-5xl">
          Tu sonrisa, con un plan claro desde el primer día.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-brand-charcoal/80">
          Mirá cómo es el tratamiento, cuánto sale y pedí tu turno de consulta por WhatsApp en un minuto.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <BotonWhatsApp className="bg-brand-green text-brand-cream" />
          <a href="#valores" className="rounded-full border-2 border-brand-brown px-5 py-3 text-base font-semibold text-brand-brown">
            Ver valores
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-6">
        <h2 className="font-heading text-2xl font-extrabold text-brand-brown">Cómo es el tratamiento</h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-2">
          {PASOS.map((p, i) => (
            <li key={p.titulo} className="flex gap-4 rounded-xl bg-white p-4 shadow-sm">
              <span className="font-heading flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-mint text-lg font-extrabold text-brand-green">{i + 1}</span>
              <div>
                <p className="font-semibold text-brand-brown">{p.titulo}</p>
                <p className="mt-0.5 text-sm text-brand-charcoal/80">{p.texto}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 rounded-xl bg-brand-tan/50 px-4 py-3 text-sm text-brand-charcoal/90">
          <strong>Duración estimada:</strong> entre 18 y 24 meses. Depende de cada caso: el profesional te da la estimación en tu consulta.
        </p>
      </section>

      <section id="valores" className="mx-auto max-w-3xl px-5 py-8">
        <h2 className="font-heading text-2xl font-extrabold text-brand-brown">Cuánto sale</h2>
        {hayPrecios ? (
          <>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <TarjetaValores
                oscura
                subtitulo="Más económico"
                titulo="Brackets metálicos"
                contado={v.precio_instalacion_metalica_contado}
                cuotaDe={v.precio_instalacion_metalica_2_cuotas}
                control={v.cuota_control_metalico}
                bracket={v.precio_bracket_metalico}
              />
              <TarjetaValores
                subtitulo="Más discretos"
                titulo="Brackets de porcelana"
                contado={v.precio_instalacion_porcelana_contado}
                cuotaDe={v.precio_instalacion_porcelana_2_cuotas}
                control={v.cuota_control_porcelana}
                bracket={v.precio_bracket_porcelana}
              />
            </div>
            <p className="mt-3 text-xs text-brand-charcoal/70">
              Valores de referencia, vigentes a {mesAnio}. Se confirman en la consulta, según tu caso.
            </p>
          </>
        ) : (
          <p className="mt-3 rounded-xl bg-white p-4 text-brand-charcoal/85 shadow-sm">
            Escribinos por WhatsApp y te pasamos los valores actualizados de la instalación y los controles.
          </p>
        )}
      </section>

      {v?.fidelidad_porcentaje_descuento && v?.referidos_descuento_instalacion_contado && (
        <section className="mx-auto max-w-3xl px-5 py-6">
          <h2 className="font-heading text-2xl font-extrabold text-brand-brown">Beneficios para vos</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border-2 border-brand-brown bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-brown/70">Si te recomendaron</p>
              <p className="font-heading mt-2 text-2xl font-extrabold text-brand-brown">{pesosAR(v.referidos_descuento_instalacion_contado)} menos</p>
              <p className="mt-1 text-sm text-brand-charcoal/80">en tu instalación si pagás de contado ({pesosAR(v.referidos_descuento_instalacion_2_cuotas)} menos en la primera cuota si pagás en 2 veces).</p>
            </div>
            <div className="rounded-2xl bg-brand-green p-6 text-brand-cream shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-widest text-brand-cream/80">Tarjeta de fidelidad</p>
              <p className="font-heading mt-2 text-2xl font-extrabold">Premiamos a quien cumple</p>
              <p className="mt-1 text-sm text-brand-cream/90">
                {v.fidelidad_porcentaje_descuento}% de descuento en tu control N.º {v.fidelidad_visitas_descuento} y un control gratis en el N.º {v.fidelidad_visitas_control_gratis}, si venís seguido.
              </p>
            </div>
          </div>
          <p className="mt-3 text-sm">
            <a href="/referidos" className="font-semibold text-brand-brown underline">
              Ver todos los beneficios y sus condiciones →
            </a>
          </p>
        </section>
      )}

      <section className="mx-auto max-w-3xl px-5 py-8">
        <h2 className="font-heading text-2xl font-extrabold text-brand-brown">Preguntas frecuentes</h2>
        <div className="mt-4 flex flex-col gap-2">
          {PREGUNTAS.map((q) => (
            <details key={q.p} className="group rounded-xl bg-white p-4 shadow-sm">
              <summary className="cursor-pointer list-none font-semibold text-brand-brown marker:hidden">
                <span className="flex items-center justify-between gap-3">
                  {q.p}
                  <span className="text-xl leading-none text-brand-green transition-transform group-open:rotate-45" aria-hidden="true">
                    +
                  </span>
                </span>
              </summary>
              <p className="mt-2 text-sm text-brand-charcoal/85">{q.r}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="bg-brand-green px-5 py-10 text-center text-brand-cream">
        <p className="font-heading text-2xl font-extrabold">¿Listo para tu consulta?</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-brand-cream/90">Escribinos y coordinamos el día y el horario que mejor te quede.</p>
        <div className="mt-5">
          <BotonWhatsApp className="bg-brand-cream text-brand-green" />
        </div>
        <p className="mt-3 text-sm text-brand-cream/90">WhatsApp {WHATSAPP_CLINICA_VISIBLE}</p>
        <p className="mx-auto mt-6 max-w-md text-xs text-brand-cream/70">
          La información de esta página es orientativa. El diagnóstico, el plan de tratamiento y los valores finales los define el profesional en la consulta.
        </p>
        <p className="mt-3 text-xs text-brand-cream/70">Clínica Dental Marianela Ramírez · Rosario</p>
      </footer>

      {/* Botón fijo para pedir turno desde cualquier parte de la página (se ve sobre todo en el celular) */}
      <div className="fixed inset-x-0 bottom-0 z-20 flex justify-center bg-gradient-to-t from-brand-cream via-brand-cream/95 to-transparent px-5 pb-4 pt-6 sm:hidden">
        <BotonWhatsApp className="w-full max-w-sm bg-brand-green text-brand-cream">Pedir turno por WhatsApp</BotonWhatsApp>
      </div>
    </main>
  );
}
