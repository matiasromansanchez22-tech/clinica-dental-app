"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { borrarSuscripcionPush, guardarSuscripcionPush } from "@/lib/data/pushSubscriptions";

function base64AUint8Array(base64) {
  const relleno = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Normal = (base64 + relleno).replace(/-/g, "+").replace(/_/g, "/");
  const bruto = window.atob(base64Normal);
  const salida = new Uint8Array(bruto.length);
  for (let i = 0; i < bruto.length; i++) salida[i] = bruto.charCodeAt(i);
  return salida;
}

export default function ActivarAvisosBoton() {
  const { perfil } = useAuth();
  const [soportado, setSoportado] = useState(true);
  const [activado, setActivado] = useState(false);
  const [procesando, setProcesando] = useState(false);

  const esDuena = perfil?.rol === "Duena";

  useEffect(() => {
    if (!esDuena) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setSoportado(false);
      return;
    }
    navigator.serviceWorker.ready
      .then((registro) => registro.pushManager.getSubscription())
      .then((sub) => setActivado(!!sub))
      .catch(() => {});
  }, [esDuena]);

  if (!esDuena || !soportado) return null;

  async function activar() {
    setProcesando(true);
    try {
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setProcesando(false);
        return;
      }
      const registro = await navigator.serviceWorker.ready;
      const clavePublica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      const sub = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64AUint8Array(clavePublica),
      });
      await guardarSuscripcionPush(sub);
      setActivado(true);
    } catch {
      // silencioso: si falla, el botón sigue mostrando "Activar"
    } finally {
      setProcesando(false);
    }
  }

  async function desactivar() {
    setProcesando(true);
    try {
      const registro = await navigator.serviceWorker.ready;
      const sub = await registro.pushManager.getSubscription();
      if (sub) {
        await borrarSuscripcionPush(sub.endpoint);
        await sub.unsubscribe();
      }
      setActivado(false);
    } catch {
      // silencioso
    } finally {
      setProcesando(false);
    }
  }

  return (
    <button
      onClick={activado ? desactivar : activar}
      disabled={procesando}
      title={activado ? "Vas a recibir un aviso acá si algo falla en la app" : "Recibí un aviso en este dispositivo si algo falla en la app"}
      className="rounded-md border border-brand-brown/40 px-2.5 py-1 text-xs font-medium text-brand-brown hover:bg-brand-tan/30 disabled:opacity-50"
    >
      {activado ? "🔔 Avisos activados" : "🔕 Activar avisos"}
    </button>
  );
}
