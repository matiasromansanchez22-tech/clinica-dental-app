"use client";

import { useEffect, useState } from "react";
import Revelar from "@/components/publico/Revelar";
import SelectorTurnoGeneral from "@/components/publico/SelectorTurnoGeneral";
import { urlWhatsApp, WHATSAPP_CLINICA_VISIBLE } from "@/lib/planReferidos";

// Página pública de Odontología General (se abre con el link o el QR, sin iniciar sesión): qué atendemos y pedido de turno según el
// motivo de la consulta. Los motivos, los horarios y quién atiende salen de la configuración del sistema (Consultas online).

const MENSAJE_WHATSAPP = "¡Hola! Vi la página de la clínica y quiero pedir un turno de odontología.";

const ESPECIALIDADES = [
  { titulo: "Odontología general", texto: "Consultas, revisiones, limpiezas, arreglos y tratamientos de todos los días.", emoji: "🦷" },
  { titulo: "Endodoncia", texto: "Tratamientos de conducto para salvar el diente cuando hay dolor o infección.", emoji: "🩺" },
  { titulo: "Periodoncia", texto: "Cuidado de las encías: sangrado, sarro y movilidad.", emoji: "🌿" },
  { titulo: "Prótesis y coronas", texto: "Coronas, puentes y prótesis para recuperar la función y la estética.", emoji: "👑" },
  { titulo: "Implantes", texto: "Reemplazo de dientes perdidos con implantes dentales.", emoji: "🔩" },
  { titulo: "Odontopediatría", texto: "Atención pensada para chicos, con paciencia y buen trato.", emoji: "🧒" },
  { titulo: "Ortodoncia", texto: "Brackets y tratamientos para alinear la sonrisa.", emoji: "😁", link: "/ortodoncia-info" },
];

const PREGUNTAS = [
  {
    p: "¿Cómo pido mi turno?",
    r: 'Elegí para qué es tu consulta, el día y el horario que mejor te quede, y dejá tus datos. Después te escribimos por WhatsApp para confirmarlo. El turno queda reservado hasta que lo confirmemos.',
  },
  {
    p: "¿Atienden con obra social?",
    r: "Sí, trabajamos con muchas obras sociales. Elegí la tuya al pedir el turno y te confirmamos por WhatsApp la cobertura y si hay algún copago. Si no tenés, atendemos de forma particular.",
  },
  {
    p: "¿Qué pasa si tengo dolor fuerte o una urgencia?",
    r: "Escribinos directo por WhatsApp: en las urgencias te damos lugar lo antes posible, sin esperar a que haya un turno libre en la página.",
  },
  {
    p: "¿Y si ya soy paciente de la clínica?",
    r: "Marcá «Ya soy paciente» y escribí tu DNI: así encontramos tu ficha y no tenés que repetir tus datos.",
  },
  {
    p: "¿Puedo cambiar o cancelar mi turno?",
    r: "Sí, avisanos por WhatsApp con tiempo y lo reprogramamos. Nos ayuda a darle ese lugar a otra persona.",
  },
];

function BotonWhatsApp({ className = "", children = "Escribirnos por WhatsApp" }) {
  return (
    <a href={urlWhatsApp(MENSAJE_WHATSAPP)} target="_blank" rel="noreferrer" className={`inline-flex items-center justify-center rounded-full px-6 py-3 text-base font-bold ${className}`}>
      {children}
    </a>
  );
}

export default function OdontologiaInfoPage() {
  const [bajo, setBajo] = useState(false);
  const [lugar, setLugar] = useState(null);

  useEffect(() => {
    const alScroll = () => setBajo(window.scrollY > 520);
    alScroll();
    window.addEventListener("scroll", alScroll, { passive: true });
    setLugar(new URLSearchParams(window.location.search).get("lugar"));
    return () => window.removeEventListener("scroll", alScroll);
  }, []);

  return (
    <main className="relative isolate min-h-screen scroll-smooth bg-brand-cream pb-24 text-brand-charcoal sm:pb-0">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[760px] overflow-hidden">
        <div className="absolute -right-24 top-0 h-80 w-80 rounded-full bg-brand-mint/30 blur-3xl" />
        <div className="absolute -left-24 top-[300px] h-64 w-64 rounded-full bg-brand-tan/50 blur-3xl" />
      </div>

      <div
        className={`fixed inset-x-0 top-0 z-30 border-b border-brand-tan/70 bg-brand-cream/95 backdrop-blur transition-transform duration-300 ${bajo ? "translate-y-0" : "-translate-y-full"}`}
        aria-hidden={!bajo}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-claro.png" alt="Clínica Dental Marianela Ramírez" className="h-10 w-auto mix-blend-multiply" />
          <a href="#turno" tabIndex={bajo ? 0 : -1} className="rounded-full bg-brand-green px-5 py-2 text-sm font-bold text-brand-cream">
            Pedir turno
          </a>
        </div>
      </div>

      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 pt-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-claro.png" alt="Clínica Dental Marianela Ramírez" className="h-14 w-auto mix-blend-multiply" />
        <span className="rounded-full bg-brand-tan/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-brown">Odontología</span>
      </header>

      <section className="mx-auto max-w-5xl px-5 pb-12 pt-10 sm:pt-14">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-brown/70">Odontología · Rosario</p>
          <h1 className="font-heading mt-3 text-4xl font-extrabold leading-[1.05] text-brand-brown sm:text-6xl">Cuidamos tu sonrisa, con el profesional indicado.</h1>
          <p className="mt-5 max-w-xl text-lg text-brand-charcoal/80 sm:text-xl">
            Contanos para qué es tu consulta y elegí el día y el horario. Te mostramos solo los turnos de quienes atienden eso.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a href="#turno" className="inline-flex items-center justify-center rounded-full bg-brand-green px-7 py-4 text-base font-bold text-brand-cream shadow-sm transition-transform hover:-translate-y-0.5">
              Pedir mi turno
            </a>
            <a href="#especialidades" className="rounded-full border-2 border-brand-brown px-6 py-3.5 text-base font-semibold text-brand-brown">
              Qué atendemos
            </a>
          </div>
          <ul className="mt-8 flex flex-wrap gap-2.5">
            {["Turnos online", "Varias especialidades", "Atendemos con obra social"].map((t) => (
              <li key={t} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-brand-brown shadow-sm ring-1 ring-brand-tan/70">
                ✓ {t}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 pb-6 pt-2 sm:pt-6">
        <Revelar>
          <SelectorTurnoGeneral lugar={lugar} />
        </Revelar>
      </section>

      <section id="especialidades" className="mx-auto max-w-5xl scroll-mt-20 px-5 py-10">
        <Revelar>
          <h2 className="font-heading text-2xl font-extrabold text-brand-brown sm:text-3xl">Qué atendemos</h2>
          <p className="mt-1 max-w-xl text-sm text-brand-charcoal/80">Un equipo con distintas especialidades, para resolver tu caso en un mismo lugar.</p>
        </Revelar>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ESPECIALIDADES.map((e, i) => (
            <Revelar key={e.titulo} retraso={i * 60}>
              <li className="flex h-full gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-brand-tan/50">
                <span className="text-2xl" aria-hidden="true">
                  {e.emoji}
                </span>
                <div>
                  <p className="font-semibold text-brand-brown">{e.titulo}</p>
                  <p className="mt-0.5 text-sm text-brand-charcoal/80">{e.texto}</p>
                  {e.link && (
                    <a href={e.link} className="mt-1 inline-block text-sm font-semibold text-brand-green underline">
                      Ver ortodoncia →
                    </a>
                  )}
                </div>
              </li>
            </Revelar>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-10">
        <Revelar>
          <h2 className="font-heading text-2xl font-extrabold text-brand-brown sm:text-3xl">Preguntas frecuentes</h2>
        </Revelar>
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
        <p className="mx-auto mt-1 max-w-md text-sm text-brand-cream/90">Pedí tu turno acá arriba o escribinos y coordinamos el día y el horario que mejor te quede.</p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <a href="#turno" className="inline-flex items-center justify-center rounded-full border-2 border-brand-cream px-6 py-3 text-base font-bold text-brand-cream">
            Pedir mi turno
          </a>
          <BotonWhatsApp className="bg-brand-cream text-brand-green" />
        </div>
        <p className="mt-3 text-sm text-brand-cream/90">WhatsApp {WHATSAPP_CLINICA_VISIBLE}</p>
        <p className="mx-auto mt-6 max-w-md text-xs text-brand-cream/70">
          La información de esta página es orientativa. El diagnóstico, el plan de tratamiento y los valores finales los define el profesional en la consulta.
        </p>
        <p className="mt-3 text-xs text-brand-cream/70">Clínica Dental Marianela Ramírez · Rosario</p>
      </footer>

      <div className="fixed inset-x-0 bottom-0 z-20 flex justify-center bg-gradient-to-t from-brand-cream via-brand-cream/95 to-transparent px-5 pb-4 pt-6 sm:hidden">
        <BotonWhatsApp className="w-full max-w-sm bg-brand-green text-brand-cream">Pedir turno por WhatsApp</BotonWhatsApp>
      </div>
    </main>
  );
}
