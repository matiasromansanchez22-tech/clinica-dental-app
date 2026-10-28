"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { URL_PLAN_REFERIDOS } from "@/lib/planReferidos";

// Cartel para imprimir (A4 vertical) con el QR que abre la página del plan de referidos. Se abre desde
// <dominio>/referidos/cartel y se imprime con el botón (o "Guardar como PDF" para llevarlo a la imprenta).
export default function CartelReferidos() {
  const [qrSvg, setQrSvg] = useState("");

  useEffect(() => {
    QRCode.toString(URL_PLAN_REFERIDOS, {
      type: "svg",
      margin: 0,
      errorCorrectionLevel: "M",
      color: { dark: "#2c282d", light: "#ffffff" },
    })
      .then(setQrSvg)
      .catch(() => {});
  }, []);

  return (
    <main className="min-h-screen bg-gray-200 py-6 print:bg-white print:py-0">
      <style>{`@page { size: A4 portrait; margin: 0; } @media print { html, body { background: #fffbf5 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`}</style>

      <div className="mx-auto mb-4 flex max-w-[794px] items-center justify-between px-4 print:hidden">
        <p className="text-sm text-gray-600">Cartel A4 vertical. Imprimilo, o elegí «Guardar como PDF» para llevarlo a la imprenta.</p>
        <button onClick={() => window.print()} className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark">
          🖨 Imprimir / Guardar PDF
        </button>
      </div>

      <div
        className="relative mx-auto flex w-full max-w-[794px] flex-col items-center overflow-hidden bg-brand-cream px-12 py-10 text-center shadow-lg print:max-w-none print:shadow-none"
        style={{ aspectRatio: "210 / 297" }}
      >
        <div className="absolute inset-x-0 top-0 h-5 bg-brand-brown" />
        <div className="absolute inset-x-0 bottom-0 h-5 bg-brand-green" />

        <p className="mt-2 text-sm font-semibold uppercase tracking-[0.3em] text-brand-brown/70">Beneficios · Ortodoncia</p>

        <h1 className="font-heading mt-4 text-[44px] font-extrabold leading-[1.05] text-brand-brown">
          ¿Querés conocer nuestros
          <br />
          beneficios de ortodoncia?
        </h1>

        <p className="mt-3 max-w-md text-xl text-brand-charcoal/80">Premiamos a quienes cumplen y a quienes nos recomiendan.</p>

        <div className="mt-6 grid w-full grid-cols-2 gap-4 text-left">
          <div className="rounded-2xl bg-brand-brown p-5 text-brand-cream">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-tan">Tarjeta de fidelidad</p>
            <p className="font-heading mt-1.5 text-2xl font-extrabold leading-tight">Premiamos al paciente cumplidor</p>
            <p className="mt-1.5 text-sm text-brand-cream/90">En tu 5.º control seguido, 50% de descuento. En el 10.º, ¡gratis!</p>
          </div>
          <div className="rounded-2xl border-[3px] border-brand-brown bg-white p-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-brand-brown/70">Plan de referidos</p>
            <p className="font-heading mt-1.5 text-2xl font-extrabold leading-tight text-brand-brown">Premiamos tus recomendaciones</p>
            <p className="mt-1.5 text-sm text-brand-charcoal/80">Recomendá tu sonrisa y los dos ganan descuento en ortodoncia.</p>
          </div>
        </div>

        <div className="mt-6 rounded-3xl border-[6px] border-brand-brown bg-white p-5">
          <div className="h-[280px] w-[280px] [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
        </div>

        <p className="font-heading mt-5 text-3xl font-extrabold text-brand-green">Escaneá el código QR</p>
        <p className="mt-1 text-base text-brand-charcoal/70">y mirá toda la información</p>

        <div className="mt-auto flex flex-col items-center gap-2 pt-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-claro.png" alt="Clínica Dental Marianela Ramírez" className="h-16 w-auto mix-blend-multiply" />
          <p className="text-xs text-brand-charcoal/50">{URL_PLAN_REFERIDOS.replace("https://", "")}</p>
        </div>
      </div>
    </main>
  );
}
