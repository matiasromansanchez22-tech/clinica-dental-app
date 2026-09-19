"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { obtenerPresupuestoPorId, suscribirseAPresupuestosAceptados } from "@/lib/data/presupuestos";
import { reproducirSonidoCelebracion } from "@/lib/sonidoAviso";

const COLORES = ["#6d3c1b", "#d4a862", "#3fae7a", "#e0574c", "#4f8fd6", "#f2c14e"];

function crearParticulas(anchoVentana) {
  const particulas = [];
  for (let i = 0; i < 140; i++) {
    particulas.push({
      x: Math.random() * anchoVentana,
      y: -20 - Math.random() * 200,
      velX: (Math.random() - 0.5) * 2.4,
      velY: 2 + Math.random() * 3,
      tamano: 5 + Math.random() * 6,
      color: COLORES[Math.floor(Math.random() * COLORES.length)],
      rotacion: Math.random() * 360,
      velRotacion: (Math.random() - 0.5) * 12,
      vida: 0,
      vidaMax: 260 + Math.random() * 80,
    });
  }
  return particulas;
}

// Confeti dibujado a mano en un <canvas> (sin librerías nuevas que
// instalar) — un festejo visual cuando se cierra una venta. El estado de
// las partículas vive en un ref para no repintar React en cada frame.
function useConfeti(activo) {
  const canvasRef = useRef(null);
  const particulasRef = useRef([]);
  const animandoRef = useRef(false);

  function disparar() {
    if (typeof window === "undefined") return;
    particulasRef.current = particulasRef.current.concat(crearParticulas(window.innerWidth));
    if (!animandoRef.current) {
      animandoRef.current = true;
      requestAnimationFrame(animar);
    }
  }

  function animar() {
    const canvas = canvasRef.current;
    if (!canvas) {
      animandoRef.current = false;
      return;
    }
    const ctx = canvas.getContext("2d");
    if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const vivas = [];
    for (const p of particulasRef.current) {
      p.x += p.velX;
      p.y += p.velY;
      p.velY += 0.03;
      p.rotacion += p.velRotacion;
      p.vida += 1;
      if (p.vida >= p.vidaMax || p.y > canvas.height + 30) continue;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotacion * Math.PI) / 180);
      ctx.globalAlpha = Math.max(0, 1 - p.vida / p.vidaMax);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.tamano / 2, -p.tamano / 4, p.tamano, p.tamano / 2);
      ctx.restore();
      vivas.push(p);
    }
    particulasRef.current = vivas;

    if (vivas.length > 0) {
      requestAnimationFrame(animar);
    } else {
      animandoRef.current = false;
    }
  }

  useEffect(() => {
    if (activo) disparar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activo]);

  return canvasRef;
}

// Cuando un presupuesto pasa a "Aceptado" (se cierra una venta), estalla
// un cartel con confeti y sonido para todo el equipo que tenga la app
// abierta en ese momento — se apoya en el mismo Realtime que el aviso de
// presupuestos nuevos.
export default function CelebracionVenta() {
  const { perfil } = useAuth();
  const [avisos, setAvisos] = useState([]);
  const disparoRef = useRef(0);
  const canvasRef = useConfeti(disparoRef.current);

  const puedeVer = perfil && perfil.rol !== "Contador";

  useEffect(() => {
    if (!puedeVer) return;
    const cortar = suscribirseAPresupuestosAceptados((payload) => {
      obtenerPresupuestoPorId(payload.new.id)
        .then((presupuesto) => {
          setAvisos((actual) => [...actual, { ...presupuesto, claveAviso: `${presupuesto.id}-${Date.now()}` }]);
          disparoRef.current += 1;
          reproducirSonidoCelebracion();
        })
        .catch(() => {});
    });
    return cortar;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puedeVer]);

  useEffect(() => {
    if (avisos.length === 0) return;
    const id = setTimeout(() => setAvisos((actual) => actual.slice(1)), 6500);
    return () => clearTimeout(id);
  }, [avisos]);

  if (!puedeVer) return null;

  function cerrar(clave) {
    setAvisos((actual) => actual.filter((a) => a.claveAviso !== clave));
  }

  return (
    <>
      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-[110]" />
      {avisos.length > 0 && (
        <div className="fixed inset-x-0 top-16 z-[110] flex flex-col items-center gap-2 p-4">
          {avisos.map((p) => (
            <div
              key={p.claveAviso}
              className="flex w-full max-w-lg items-center justify-between gap-3 rounded-lg border-2 border-emerald-500 bg-white p-4 shadow-2xl"
            >
              <div>
                <p className="font-heading text-base font-bold text-emerald-700">🎉 ¡Venta cerrada!</p>
                <p className="mt-0.5 text-sm text-gray-700">
                  {p.profesional !== "—" ? p.profesional : "Alguien del equipo"} cerró a {p.paciente} por $
                  {Number(p.total).toLocaleString("es-AR")}
                </p>
              </div>
              <button
                onClick={() => cerrar(p.claveAviso)}
                aria-label="Cerrar aviso"
                className="shrink-0 text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
