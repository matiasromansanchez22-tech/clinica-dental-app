"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { URL_ORTODONCIA_INFO, urlOrtodonciaInfo, WHATSAPP_CLINICA_VISIBLE } from "@/lib/planReferidos";

// Cartel para imprimir (A4 vertical) con el QR que abre la página de consultas de ortodoncia. Se abre desde
// <dominio>/ortodoncia-info/cartel (o ?lugar=sala-espera para el QR de un lugar puntual) y se imprime con el botón
// (o "Guardar como PDF" para llevarlo a la imprenta).
export default function CartelOrtodonciaInfo() {
  const [qrSvg, setQrSvg] = useState("");
  const [lugar, setLugar] = useState("");

  useEffect(() => {
    const lugarDelLink = new URLSearchParams(window.location.search).get("lugar") || "";
    QRCode.toString(urlOrtodonciaInfo(lugarDelLink), {
      type: "svg",
      margin: 0,
      errorCorrectionLevel: "M",
      color: { dark: "#2c282d", light: "#ffffff" },
    })
      .then((svg) => {
        setQrSvg(svg);
        setLugar(lugarDelLink);
      })
      .catch(() => {});
  }, []);

  const puntos = [
    ["🦷", "Cómo es el tratamiento"],
    ["💰", "Cuánto sale"],
    ["💬", "Pedí tu turno por WhatsApp"],
  ];

  return (
    <main className="min-h-screen bg-gray-200 py-6 print:bg-white print:py-0">
      <style>{`@page { size: A4 portrait; margin: 0; } @media print { html, body { background: #fffbf5 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`}</style>

      <div className="mx-auto mb-4 flex max-w-[794px] items-center justify-between px-4 print:hidden">
        <p className="text-sm text-gray-600">
          Cartel A4 vertical. Imprimilo, o elegí «Guardar como PDF» para llevarlo a la imprenta.
          {lugar && lugar !== "general" && (
            <span className="ml-1 rounded-full bg-brand-tan/60 px-2 py-0.5 text-xs font-semibold text-brand-brown">QR del lugar: {lugar}</span>
          )}
        </p>
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

        <p className="mt-2 text-sm font-semibold uppercase tracking-[0.3em] text-brand-brown/70">Ortodoncia</p>

        <h1 className="font-heading mt-4 text-[46px] font-extrabold leading-[1.05] text-brand-brown">
          ¿Querés saber cómo es
          <br />
          tu tratamiento de ortodoncia?
        </h1>

        <p className="mt-3 max-w-md text-xl text-brand-charcoal/80">Mirá toda la información y pedí tu turno de consulta.</p>

        <ul className="mt-6 grid w-full grid-cols-3 gap-3">
          {puntos.map(([icono, texto]) => (
            <li key={texto} className="rounded-2xl bg-white p-4 shadow-sm">
              <p className="text-3xl">{icono}</p>
              <p className="font-heading mt-1.5 text-base font-extrabold leading-tight text-brand-brown">{texto}</p>
            </li>
          ))}
        </ul>

        <div className="mt-6 rounded-3xl border-[6px] border-brand-brown bg-white p-5">
          <div className="h-[280px] w-[280px] [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
        </div>

        <p className="font-heading mt-5 text-3xl font-extrabold text-brand-green">Escaneá el código QR</p>
        <p className="mt-1 text-base text-brand-charcoal/70">y pedí tu consulta en un minuto</p>

        <div className="mt-auto flex flex-col items-center gap-2 pt-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-claro.png" alt="Clínica Dental Marianela Ramírez" className="h-16 w-auto mix-blend-multiply" />
          <p className="text-sm font-semibold text-brand-brown">WhatsApp {WHATSAPP_CLINICA_VISIBLE}</p>
          <p className="text-xs text-brand-charcoal/50">{URL_ORTODONCIA_INFO.replace("https://", "")}</p>
        </div>
      </div>
    </main>
  );
}
