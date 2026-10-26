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
        className="relative mx-auto flex w-full max-w-[794px] flex-col items-center overflow-hidden bg-brand-cream px-12 py-14 text-center shadow-lg print:max-w-none print:shadow-none"
        style={{ aspectRatio: "210 / 297" }}
      >
        <div className="absolute inset-x-0 top-0 h-5 bg-brand-brown" />
        <div className="absolute inset-x-0 bottom-0 h-5 bg-brand-green" />

        <p className="mt-4 text-sm font-semibold uppercase tracking-[0.3em] text-brand-brown/70">Plan de referidos · Ortodoncia</p>

        <h1 className="font-heading mt-6 text-[56px] font-extrabold leading-[1.05] text-brand-brown">
          ¿Querés conocer
          <br />
          nuestro plan
          <br />
          de referidos?
        </h1>

        <p className="mt-6 max-w-md text-2xl text-brand-charcoal/80">Recomendá tu sonrisa y los dos ganan.</p>

        <div className="mt-10 rounded-3xl border-[6px] border-brand-brown bg-white p-6">
          <div className="h-[300px] w-[300px] [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
        </div>

        <p className="font-heading mt-8 text-4xl font-extrabold text-brand-green">Escaneá el código QR</p>
        <p className="mt-2 text-lg text-brand-charcoal/70">y mirá toda la información</p>

        <div className="mt-auto flex flex-col items-center gap-2 pt-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-claro.png" alt="Clínica Dental Marianela Ramírez" className="h-20 w-auto mix-blend-multiply" />
          <p className="text-xs text-brand-charcoal/50">{URL_PLAN_REFERIDOS.replace("https://", "")}</p>
        </div>
      </div>
    </main>
  );
}
