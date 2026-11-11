"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { reproducirSonidoPedidoTurno } from "@/lib/sonidoAviso";
import { supabase } from "@/lib/supabaseClient";

const REVISAR_CADA_MS = 20 * 1000;
const RECORDATORIO_CADA_MS = 5 * 60 * 1000;
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function textoDeTurno(fechaISO, hora) {
  const [a, m, d] = fechaISO.split("-").map(Number);
  return `${DIAS[new Date(a, m - 1, d).getDay()]} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")} a las ${String(hora).slice(0, 5)}`;
}

function hace(creadoEn) {
  const min = Math.max(0, Math.round((Date.now() - new Date(creadoEn).getTime()) / 60000));
  if (min < 1) return "recién";
  if (min < 60) return `hace ${min} min`;
  return `hace ${Math.round(min / 60)} h`;
}

// Aviso para Recepción y las Dueñas cuando un paciente pide turno desde la página pública. Suena un timbre fuerte apenas llega, se
// queda a la vista (y parpadea el título de la pestaña) hasta que el pedido se confirma o se da de baja, y vuelve a sonar cada 5 minutos
// mientras siga pendiente. El horario pedido queda reservado todo ese tiempo.
export default function AvisoPedidosTurnoOnline() {
  const { perfil } = useAuth();
  const pathname = usePathname();
  const [pedidos, setPedidos] = useState([]);
  const conocidos = useRef(null); // ids ya vistos (null = todavía no se hizo la primera revisión)
  const ultimoSonido = useRef(0);
  const habilitado = perfil?.rol === "Secretaria" || perfil?.rol === "Duena";

  useEffect(() => {
    if (!habilitado) return;
    let activo = true;
    async function revisar() {
      const { data, error } = await supabase
        .from("solicitudes_turno_ortodoncia")
        .select("id, nombre, fecha, hora_inicio, created_at")
        .eq("estado", "Pendiente")
        .order("created_at", { ascending: true });
      if (!activo || error) return;
      setPedidos(data);
      const hayNuevo = conocidos.current ? data.some((p) => !conocidos.current.has(p.id)) : data.length > 0;
      conocidos.current = new Set(data.map((p) => p.id));
      const ahora = Date.now();
      if (hayNuevo || (data.length > 0 && ahora - ultimoSonido.current > RECORDATORIO_CADA_MS)) {
        reproducirSonidoPedidoTurno();
        ultimoSonido.current = ahora;
      }
    }
    revisar();
    const temporizador = setInterval(revisar, REVISAR_CADA_MS);
    const alVolver = () => document.visibilityState === "visible" && revisar();
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      activo = false;
      clearInterval(temporizador);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [habilitado]);

  // Mientras haya pedidos esperando, el título de la pestaña parpadea para que se note aunque esté en segundo plano.
  const cantidad = pedidos.length;
  useEffect(() => {
    if (!habilitado || cantidad === 0) return;
    const original = document.title;
    const aviso = `🌐 ${cantidad} pedido${cantidad === 1 ? "" : "s"} de turno`;
    let mostrandoAviso = false;
    const temporizador = setInterval(() => {
      mostrandoAviso = !mostrandoAviso;
      document.title = mostrandoAviso ? aviso : original;
    }, 1500);
    return () => {
      clearInterval(temporizador);
      document.title = original;
    };
  }, [habilitado, cantidad]);

  if (!habilitado || cantidad === 0 || pathname === "/ortodoncia/consultas-online") return null;

  return (
    <div className="fixed right-4 top-20 z-[110] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2" role="alert" aria-live="assertive">
      {pedidos.slice(0, 3).map((p) => (
        <div key={p.id} className="animate-pulse rounded-lg border-2 border-amber-500 bg-white p-3 shadow-2xl [animation-iteration-count:3]">
          <p className="font-heading text-sm font-bold text-amber-800">🌐 Pedido de turno — {p.nombre}</p>
          <p className="mt-0.5 text-xs text-gray-700">
            Quiere el <strong>{textoDeTurno(p.fecha, p.hora_inicio)}</strong> · {hace(p.created_at)}
          </p>
          <p className="mt-1 text-[11px] text-gray-500">El horario queda reservado hasta que lo confirmes o lo des de baja.</p>
        </div>
      ))}
      {cantidad > 3 && <p className="rounded-md bg-white px-2 py-1 text-center text-xs text-gray-600 shadow">y {cantidad - 3} más</p>}
      <Link href="/ortodoncia/consultas-online" className="rounded-md bg-brand-brown px-3 py-2 text-center text-sm font-bold text-white shadow-lg hover:bg-brand-brown-dark">
        Ver y resolver {cantidad === 1 ? "el pedido" : `los ${cantidad} pedidos`} →
      </Link>
    </div>
  );
}
