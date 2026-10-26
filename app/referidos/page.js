"use client";

import { useEffect, useState } from "react";
import { CONFIG_REFERIDOS_POR_DEFECTO, obtenerConfigReferidos } from "@/lib/data/referidos";
import { pesosAR } from "@/lib/planReferidos";

// Página pública del plan de referidos de Ortodoncia (se abre con el QR del cartel, sin iniciar sesión). Los montos y las
// condiciones salen de la misma configuración que usa el sistema, así que siempre coinciden con lo que se descuenta.
export default function PlanReferidosPublico() {
  const [cfg, setCfg] = useState(CONFIG_REFERIDOS_POR_DEFECTO);

  useEffect(() => {
    obtenerConfigReferidos()
      .then(setCfg)
      .catch(() => {});
  }, []);

  const cadaCuantos = cfg.referidos_cada_cuantos_control_sin_costo;
  const pasos = [
    { titulo: "Contale a quien quieras", texto: "Un familiar, un amigo, un compañero de trabajo: cualquiera que esté pensando en hacerse ortodoncia." },
    { titulo: "Que diga tu nombre", texto: "Cuando pida su turno o llegue a la consulta, tiene que contar que lo recomendaste vos. Lo anotamos en recepción." },
    { titulo: "Empieza el tratamiento", texto: "Cuando tu referido comienza su instalación, se habilitan los beneficios para los dos." },
    { titulo: "Se descuenta al pagar", texto: "No hay trámites ni cupones: el descuento se aplica solo en el momento del pago, en la clínica." },
  ];

  return (
    <main className="min-h-screen bg-brand-cream text-brand-charcoal">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-5 pt-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo-claro.png" alt="Clínica Dental Marianela Ramírez" className="h-14 w-auto mix-blend-multiply" />
        <span className="rounded-full bg-brand-tan/60 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-brown">Ortodoncia</span>
      </header>

      <section className="mx-auto max-w-3xl px-5 pb-6 pt-8">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-brown/70">Plan de referidos</p>
        <h1 className="font-heading mt-2 text-4xl font-extrabold leading-tight text-brand-brown sm:text-5xl">
          Recomendá tu sonrisa.
          <br />
          Los dos ganan.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-brand-charcoal/80">
          Si venís a la clínica y nos recomendás a alguien que empieza su tratamiento de ortodoncia, los dos tienen un descuento.
        </p>
      </section>

      <section className="mx-auto grid max-w-3xl gap-4 px-5 sm:grid-cols-2">
        <div className="rounded-2xl bg-brand-brown p-6 text-brand-cream shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-tan">Si te recomendaron a vos</p>
          <p className="font-heading mt-3 text-3xl font-extrabold">{pesosAR(cfg.referidos_descuento_instalacion_contado)} menos</p>
          <p className="mt-1 text-brand-cream/90">en tu instalación si pagás todo de contado.</p>
          <div className="my-4 h-px bg-brand-cream/20" />
          <p className="font-heading text-3xl font-extrabold">{pesosAR(cfg.referidos_descuento_instalacion_2_cuotas)} menos</p>
          <p className="mt-1 text-brand-cream/90">en la primera cuota si pagás en 2 veces.</p>
        </div>
        <div className="rounded-2xl border-2 border-brand-brown bg-white p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-brown/70">Si vos recomendás</p>
          <p className="font-heading mt-3 text-3xl font-extrabold text-brand-brown">{cfg.referidos_porcentaje_descuento_control}% de descuento</p>
          <p className="mt-1 text-brand-charcoal/80">en un control, cuando tu referido empieza su tratamiento.</p>
          <div className="my-4 h-px bg-brand-brown/15" />
          <p className="font-heading text-3xl font-extrabold text-brand-green">Un control gratis</p>
          <p className="mt-1 text-brand-charcoal/80">cada {cadaCuantos} personas que recomendás y empiezan su tratamiento.</p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-10">
        <h2 className="font-heading text-2xl font-extrabold text-brand-brown">Cómo funciona</h2>
        <ol className="mt-5 grid gap-4 sm:grid-cols-2">
          {pasos.map((p, i) => (
            <li key={p.titulo} className="flex gap-4 rounded-xl bg-white p-4 shadow-sm">
              <span className="font-heading flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-mint text-lg font-extrabold text-brand-green">{i + 1}</span>
              <div>
                <p className="font-semibold text-brand-brown">{p.titulo}</p>
                <p className="mt-0.5 text-sm text-brand-charcoal/80">{p.texto}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-3xl px-5">
        <div className="rounded-2xl bg-brand-tan/50 p-6">
          <h2 className="font-heading text-xl font-extrabold text-brand-brown">Un ejemplo</h2>
          <p className="mt-2 text-brand-charcoal/90">
            Ana viene a controlarse y le cuenta a Bruno. Bruno saca turno y dice que va de parte de Ana. Cuando Bruno empieza su instalación, tiene{" "}
            <strong>{pesosAR(cfg.referidos_descuento_instalacion_contado)} menos</strong> si paga de contado (o{" "}
            <strong>{pesosAR(cfg.referidos_descuento_instalacion_2_cuotas)} menos</strong> en la primera cuota si paga en 2 veces), y Ana tiene{" "}
            <strong>{cfg.referidos_porcentaje_descuento_control}% de descuento</strong> en su próximo control.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 py-10">
        <h2 className="font-heading text-xl font-extrabold text-brand-brown">Condiciones</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-brand-charcoal/85">
          <li>El plan es para pacientes <strong>nuevos de ortodoncia</strong> que llegan recomendados por un paciente de la clínica.</li>
          <li>Los beneficios se habilitan cuando el paciente recomendado <strong>comienza su instalación</strong>.</li>
          <li>El descuento del paciente nuevo se aplica una sola vez. Si paga en 2 veces, se descuenta de la primera cuota.</li>
          <li>
            El descuento en el control para quien recomienda dura <strong>{cfg.referidos_vigencia_dias} días</strong> desde que se habilita, y se puede usar en un control
            por vez. Hay un máximo de <strong>{cfg.referidos_tope_premios_por_anio} beneficios por año</strong> por paciente.
          </li>
          <li>Cada {cadaCuantos}.° paciente recomendado que empieza su tratamiento, el control es sin costo.</li>
          <li>No se combina con otras promociones ni descuentos.</li>
          <li>Para que el beneficio quede registrado, el paciente nuevo tiene que mencionar quién lo recomendó <strong>antes de empezar su tratamiento</strong>.</li>
        </ul>
      </section>

      <footer className="bg-brand-green px-5 py-8 text-center text-brand-cream">
        <p className="font-heading text-xl font-extrabold">¿Tenés dudas?</p>
        <p className="mt-1 text-sm text-brand-cream/90">Consultá en recepción y te contamos todo.</p>
        <p className="mt-4 text-xs text-brand-cream/70">Clínica Dental Marianela Ramírez · Rosario</p>
      </footer>
    </main>
  );
}
