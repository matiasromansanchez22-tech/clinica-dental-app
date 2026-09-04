"use client";

import { Component, useEffect } from "react";
import { registrarError } from "@/lib/data/erroresApp";

class LimiteDeError extends Component {
  constructor(props) {
    super(props);
    this.state = { tieneError: false };
  }

  static getDerivedStateFromError() {
    return { tieneError: true };
  }

  componentDidCatch(error) {
    registrarError({
      mensaje: error?.message || String(error),
      stack: error?.stack || null,
      url: typeof window !== "undefined" ? window.location.href : null,
      contexto: "react",
    });
  }

  render() {
    if (this.state.tieneError) {
      return (
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 p-10 text-center">
          <p className="text-lg font-semibold text-gray-900">Uy, algo falló.</p>
          <p className="text-sm text-gray-500">Ya quedó registrado. Probá recargar la página.</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark"
          >
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function CapturaGlobal() {
  useEffect(() => {
    function alError(event) {
      registrarError({
        mensaje: event.message,
        stack: event.error?.stack || null,
        url: window.location.href,
        contexto: "window.onerror",
      });
    }
    function alRechazoSinManejar(event) {
      const razon = event.reason;
      registrarError({
        mensaje: razon?.message || String(razon),
        stack: razon?.stack || null,
        url: window.location.href,
        contexto: "promise",
      });
    }
    window.addEventListener("error", alError);
    window.addEventListener("unhandledrejection", alRechazoSinManejar);
    return () => {
      window.removeEventListener("error", alError);
      window.removeEventListener("unhandledrejection", alRechazoSinManejar);
    };
  }, []);
  return null;
}

export default function CapturaErrores({ children }) {
  return (
    <LimiteDeError>
      <CapturaGlobal />
      {children}
    </LimiteDeError>
  );
}
