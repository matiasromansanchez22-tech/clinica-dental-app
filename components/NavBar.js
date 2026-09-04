"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import InstalarAppBoton from "@/components/InstalarAppBoton";

const GRUPOS = [
  { tipo: "link", href: "/", label: "Inicio" },
  { tipo: "link", href: "/panoramicas", label: "🩻 Pano y fotos", ocultarRoles: ["Contador"] },
  { tipo: "link", href: "/horario", label: "🕐 Mi horario", soloRoles: ["Secretaria", "Duena"] },
  { tipo: "link", href: "/chat", label: "💬 Chat", ocultarRoles: ["Contador"] },
  {
    tipo: "grupo",
    label: "Sistema General",
    ocultarRoles: ["Contador"],
    items: [
      { href: "/agenda", label: "Agenda" },
      { href: "/agenda/ver", label: "Ver Agenda del Día (solo lectura)" },
      { href: "/reprogramar", label: "Turnos a reprogramar" },
      { href: "/pacientes", label: "Pacientes" },
      { href: "/nomenclador", label: "Nomenclador" },
      { href: "/catalogo", label: "Catálogo" },
      { href: "/presupuestos", label: "Presupuestos" },
      { href: "/planes", label: "Planes de Financiación" },
      { href: "/caja", label: "Caja" },
      { href: "/cierre-turno", label: "Cierre de Turno" },
    ],
  },
  {
    tipo: "grupo",
    label: "Sistema Ortodoncia",
    ocultarRoles: ["Contador"],
    items: [
      { href: "/ortodoncia/agenda", label: "Agenda" },
      { href: "/ortodoncia/agenda/ver", label: "Ver Agenda del Día (solo lectura)" },
      { href: "/ortodoncia/reprogramar", label: "Turnos a reprogramar" },
      { href: "/ortodoncia/pacientes", label: "Pacientes" },
      { href: "/ortodoncia/controles", label: "Controles" },
      { href: "/ortodoncia/cuentas-por-cobrar", label: "Cuentas por cobrar" },
      { href: "/ortodoncia/caja", label: "Caja" },
      { href: "/ortodoncia/cierre-turno", label: "Cierre de Turno" },
    ],
  },
  {
    tipo: "grupo",
    label: "Laboratorio",
    ocultarRoles: ["Secretaria", "Contador"],
    items: [{ href: "/laboratorio", label: "Trabajos de laboratorio" }],
  },
  { tipo: "link", href: "/gerencial/estadisticas", label: "📊 Estadísticas", soloDuena: true },
  { tipo: "link", href: "/gerencial/stock", label: "📦 Stock de Insumos", soloRoles: ["Duena", "Laboratorio"] },
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
      { href: "/gerencial/profesionales", label: "Profesionales" },
      { href: "/gerencial/cierre-diario", label: "Cierre Diario (General + Ortodoncia)" },
      { href: "/gerencial/cierre-mensual", label: "🔒 Cierre de Mes" },
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
      { href: "/gerencial/finanzas-personales", label: "🏠 Cuenta Personal" },
      { href: "/gerencial/horarios", label: "🕐 Horarios y liquidación" },
    ],
  },
];

function MenuDesplegable({ grupo, activo }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function alClickearAfuera(e) {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false);
    }
    document.addEventListener("mousedown", alClickearAfuera);
    return () => document.removeEventListener("mousedown", alClickearAfuera);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setAbierto((a) => !a)}
        className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium ${
          activo ? "bg-brand-brown text-brand-cream" : "text-brand-charcoal/70 hover:bg-brand-tan/40"
        }`}
      >
        {grupo.label}
        <span className="text-xs">▾</span>
      </button>
      {abierto && (
        <div className="absolute left-0 z-10 mt-1 w-56 rounded-md border border-brand-tan bg-brand-cream py-1 shadow-lg">
          {grupo.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setAbierto(false)}
              className="block px-4 py-2 text-sm text-brand-charcoal hover:bg-brand-tan/40"
            >
              {item.label}
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
          return <MenuDesplegable key={g.label} grupo={g} activo={activo} />;
        })}
        <span className="ml-auto flex items-center gap-3 text-sm text-brand-charcoal/60">
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
