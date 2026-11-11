"use client";

import { useEffect, useRef, useState } from "react";

// Hace que su contenido aparezca suavemente (sube y se aclara) cuando entra en pantalla al bajar por la página.
// Si la persona tiene activada la opción de "reducir movimiento", o el navegador no lo soporta, se muestra directamente.
export default function Revelar({ children, retraso = 0, className = "" }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sinMovimiento = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (sinMovimiento || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (entrada.isIntersecting) {
          setVisible(true);
          observador.disconnect();
        }
      },
      { threshold: 0.12 }
    );
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : "translateY(18px)",
        transition: `opacity 600ms ease ${retraso}ms, transform 600ms ease ${retraso}ms`,
      }}
    >
      {children}
    </div>
  );
}
