"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import InstalarAppBoton from "@/components/InstalarAppBoton";
import ActivarAvisosBoton from "@/components/ActivarAvisosBoton";
import { obtenerCantidadTurnosAReprogramar } from "@/lib/data/turnosReprogramar";
import { obtenerCantidadTurnosOrtodonciaAReprogramar } from "@/lib/data/turnosOrtodoncia";
import { obtenerCantidadCobrosConSaldoPendiente } from "@/lib/data/caja";
import { obtenerCantidadDeudoresOrtodoncia } from "@/lib/data/controlesOrtodoncia";
import { obtenerCantidadTurnosSinCerrarHoy } from "@/lib/data/cierres";
import { obtenerCantidadMesesPendientesAprobar } from "@/lib/data/cierresMes";

const GRUPOS = [
  { tipo: "link", href: "/", label: "Inicio" },
  { tipo: "link", href: "/panoramicas", label: "🩻 Pano y fotos", ocultarRoles: ["Contador"] },
  { tipo: "link", href: "/horario", label: "🕐 Mi horario", soloRoles: ["Secretaria", "Laboratorio", "Duena"] },
  { tipo: "link", href: "/gerencial/produccion", label: "💰 Producción", soloRoles: ["Secretaria"] },
  { tipo: "link", href: "/chat", label: "💬 Chat", ocultarRoles: ["Contador"] },
  {
    tipo: "grupo",
    label: "Sistema General",
    ocultarRoles: ["Contador", "CM"],
    items: [
      { href: "/agenda", label: "Agenda" },
      { href: "/agenda/ver", label: "Ver Agenda del Día (solo lectura)" },
      { href: "/reprogramar", label: "Turnos a reprogramar", badgeKey: "general" },
      { href: "/pacientes", label: "Pacientes" },
      { href: "/nomenclador", label: "Nomenclador" },
      { href: "/catalogo", label: "Catálogo" },
      { href: "/presupuestos", label: "Presupuestos" },
      { href: "/planes", label: "Planes de Financiación" },
      { href: "/cuentas-por-cobrar", label: "Cuentas por cobrar", badgeKey: "cobrarGeneral" },
      { href: "/caja", label: "Caja" },
      { href: "/cierre-turno", label: "Cierre de Turno" },
    ],
  },
  {
    tipo: "grupo",
    label: "Sistema Ortodoncia",
    ocultarRoles: ["Contador", "CM"],
    items: [
      { href: "/ortodoncia/agenda", label: "Agenda" },
      { href: "/ortodoncia/agenda/ver", label: "Ver Agenda del Día (solo lectura)" },
      { href: "/ortodoncia/reprogramar", label: "Turnos a reprogramar", badgeKey: "ortodoncia" },
      { href: "/ortodoncia/pacientes", label: "Pacientes" },
      { href: "/ortodoncia/controles", label: "Controles" },
      { href: "/ortodoncia/cuentas-por-cobrar", label: "Cuentas por cobrar", badgeKey: "cobrarOrtodoncia" },
      { href: "/ortodoncia/caja", label: "Caja" },
      { href: "/ortodoncia/cierre-turno", label: "Cierre de Turno" },
    ],
  },
  {
    tipo: "grupo",
    label: "Laboratorio",
    ocultarRoles: ["Secretaria", "Contador", "CM"],
    items: [{ href: "/laboratorio", label: "Trabajos de laboratorio" }],
  },
  { tipo: "link", href: "/calendario-contenido", label: "📅 Calendario de Contenido", soloRoles: ["Duena", "CM"] },
  { tipo: "link", href: "/biblioteca-marca", label: "🎨 Biblioteca de marca", soloRoles: ["Duena", "CM"] },
  { tipo: "link", href: "/gerencial/estadisticas", label: "📊 Tablero Mensual", soloDuena: true },
  { tipo: "link", href: "/gerencial/metas", label: "🎯 Metas y Seguimiento", soloDuena: true },
  { tipo: "link", href: "/gastos-recurrentes", label: "💼 Gastos de la Clínica", soloDuena: true },
  { tipo: "link", href: "/gerencial/stock", label: "📦 Stock de Insumos", soloRoles: ["Duena", "Laboratorio", "Secretaria"] },
  {
    tipo: "grupo",
    label: "💼 Contador",
    soloRoles: ["Duena", "Contador"],
    items: [
      { href: "/caja", label: "Caja General" },
      { href: "/ortodoncia/caja", label: "Caja Ortodoncia" },
      { href: "/gerencial/gastos", label: "Gastos" },
      { href: "/gerencial/obras-sociales", label: "Control de Obras Sociales" },
      { href: "/gerencial/pagos-asor", label: "Pagos ASOR" },
      { href: "/gerencial/produccion", label: "Producción y liquidación" },
      { href: "/gerencial/balance-mensual", label: "Balance Mensual" },
      { href: "/gerencial/balance-anual", label: "Balance Anual" },
    ],
  },
  {
    tipo: "grupo",
    label: "Gerencial",
    soloDuena: true,
    items: [
      { href: "/gerencial/comparativa-mecanicos", label: "🔧 Comparativa de mecánicos" },
      { href: "/gerencial/cuentas-mecanicos", label: "🔧 Cuentas por mecánico" },
      { href: "/gerencial/rentabilidad-diaria", label: "📅 Rentabilidad diaria por profesional" },
      { href: "/gerencial/profesionales", label: "Profesionales" },
      { href: "/gerencial/cierre-diario", label: "Cierre Diario (General + Ortodoncia)", badgeKey: "cierreDiario" },
      { href: "/gerencial/cierre-mensual", label: "🔒 Cierre de Mes", badgeKey: "cierreMes" },
      { href: "/gerencial/produccion", label: "Producción y liquidación" },
      { href: "/gerencial/ranking-prestaciones", label: "Ranking de prestaciones" },
      { href: "/gerencial/obras-sociales", label: "Control de Obras Sociales" },
      { href: "/gerencial/pagos-asor", label: "Pagos ASOR" },
      { href: "/gerencial/aumentos-ortodoncia", label: "Aumento de cuota (Ortodoncia)" },
      { href: "/gerencial/gastos", label: "Gastos" },
      { href: "/gerencial/pedidos", label: "Pedidos de Insumos" },
      { href: "/gerencial/balance-mensual", label: "Balance Mensual" },
      { href: "/gerencial/balance-anual", label: "Balance Anual" },
      { href: "/gerencial/papelera", label: "🗑️ Papelera de reciclaje" },
      { href: "/gerencial/accesos", label: "🔑 Accesos" },
      { href: "/gerencial/errores", label: "🚨 Errores" },
      { href: "/gerencial/finanzas-personales", label: "💰 Consultorio y Personal" },
      { href: "/gerencial/horarios", label: "🕐 Horarios y liquidación" },
      { href: "/gerencial/whatsapp", label: "💬 Bandeja de WhatsApp (vista previa)" },
    ],
  },
];

function PuntoRojo() {
  return <span className="h-2 w-2 rounded-full bg-red-600" aria-label="Hay pendientes" />;
}

function BadgeCantidad({ cantidad }) {
  return (
    <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
      {cantidad}
    </span>
  );
}

function MenuDesplegable({ grupo, activo, badges }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function alClickearAfuera(e) {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false);
    }
    document.addEventListener("mousedown", alClickearAfuera);
    return () => document.removeEventListener("mousedown", alClickearAfuera);
  }, []);

  const tieneAviso = grupo.items.some((item) => item.badgeKey && badges[item.badgeKey] > 0);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setAbierto((a) => !a)}
        className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium ${
          activo ? "bg-brand-brown text-brand-cream" : "text-brand-charcoal/70 hover:bg-brand-tan/40"
        }`}
      >
        {grupo.label}
        {tieneAviso && <PuntoRojo />}
        <span className="text-xs">▾</span>
      </button>
      {abierto && (
        <div className="absolute left-0 z-10 mt-1 w-56 rounded-md border border-brand-tan bg-brand-cream py-1 shadow-lg">
          {grupo.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setAbierto(false)}
              className="flex items-center justify-between gap-2 px-4 py-2 text-sm text-brand-charcoal hover:bg-brand-tan/40"
            >
              {item.label}
              {item.badgeKey && badges[item.badgeKey] > 0 && <BadgeCantidad cantidad={badges[item.badgeKey]} />}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NavBar() {
  const pathname = usePathname();
  const { user, perfil, cerrarSesion } = useAuth();
  const [badges, setBadges] = useState({});

  useEffect(() => {
    if (!user || perfil?.rol === "Contador" || perfil?.rol === "CM") return;

    Promise.all([
      obtenerCantidadTurnosAReprogramar(),
      obtenerCantidadTurnosOrtodonciaAReprogramar(),
      obtenerCantidadCobrosConSaldoPendiente(),
      obtenerCantidadDeudoresOrtodoncia(),
    ])
      .then(([general, ortodoncia, cobrarGeneral, cobrarOrtodoncia]) =>
        setBadges((b) => ({ ...b, general, ortodoncia, cobrarGeneral, cobrarOrtodoncia }))
      )
      .catch(() => {});

    // Cierre Diario y Cierre de Mes solo los ve la Dueña — no hace falta
    // (ni conviene, por los permisos) pedirlos para los demás roles.
    if (perfil?.rol === "Duena") {
      Promise.all([obtenerCantidadTurnosSinCerrarHoy(), obtenerCantidadMesesPendientesAprobar()])
        .then(([cierreDiario, cierreMes]) => setBadges((b) => ({ ...b, cierreDiario, cierreMes })))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, perfil?.rol]);

  if (!user) return null;

  const esDuena = perfil?.rol === "Duena";

  return (
    <nav className="border-b border-brand-tan bg-brand-cream print:hidden">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-1 px-6 py-3">
        <Link href="/" className="mr-4 flex items-center gap-2">
          <Image src="/icon.png" alt="" width={32} height={32} className="rounded-md" />
          <span className="font-heading text-lg font-semibold text-brand-brown">Clínica Dental</span>
        </Link>
        {GRUPOS.filter(
          (g) =>
            (!g.soloDuena || esDuena) &&
            (!g.soloRoles || g.soloRoles.includes(perfil?.rol)) &&
            !(g.ocultarRoles || []).includes(perfil?.rol)
        ).map((g) => {
          if (g.tipo === "link") {
            const activo = pathname === g.href;
            return (
              <Link
                key={g.href}
                href={g.href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  activo ? "bg-brand-brown text-brand-cream" : "text-brand-charcoal/70 hover:bg-brand-tan/40"
                }`}
              >
                {g.label}
              </Link>
            );
          }
          const activo = g.items.some((i) => i.href === pathname);
          return <MenuDesplegable key={g.label} grupo={g} activo={activo} badges={badges} />;
        })}
        <span className="ml-auto flex items-center gap-3 text-sm text-brand-charcoal/60">
          <ActivarAvisosBoton />
          <InstalarAppBoton />
          {perfil?.nombre || user.email}
          <Link href="/cambiar-password" className="hover:underline">
            Cambiar contraseña
          </Link>
          <button onClick={cerrarSesion} className="text-red-700 hover:underline">
            Cerrar sesión
          </button>
        </span>
      </div>
    </nav>
  );
}
