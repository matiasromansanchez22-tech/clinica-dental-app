"use client";

import { useEffect, useState } from "react";

export default function InstalarAppBoton() {
  const [eventoInstalar, setEventoInstalar] = useState(null);
  const [yaInstalada, setYaInstalada] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone) {
      setYaInstalada(true);
    }

    function alPoderInstalar(e) {
      e.preventDefault();
      setEventoInstalar(e);
    }
    function alInstalar() {
      setYaInstalada(true);
      setEventoInstalar(null);
    }

    window.addEventListener("beforeinstallprompt", alPoderInstalar);
    window.addEventListener("appinstalled", alInstalar);
    return () => {
      window.removeEventListener("beforeinstallprompt", alPoderInstalar);
      window.removeEventListener("appinstalled", alInstalar);
    };
  }, []);

  if (!eventoInstalar || yaInstalada) return null;

  async function instalar() {
    eventoInstalar.prompt();
    await eventoInstalar.userChoice;
    setEventoInstalar(null);
  }

  return (
    <button
      onClick={instalar}
      className="rounded-md bg-brand-brown px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-brown-dark"
    >
      📲 Instalar
    </button>
  );
}
