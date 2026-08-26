"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";

const GRUPOS = [
  { tipo: "link", href: "/", label: "Inicio" },
  {
    tipo: "grupo",
    label: "Sistema General",
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
      { href: "/cierre", label: "Cierre Diario" },
    ],
  },
  {
    tipo: "grupo",
    label: "Sistema Ortodoncia",
    items: [
      { href: "/ortodoncia/agenda", label: "Agenda" },
      { href: "/ortodoncia/agenda/ver", label: "Ver Agenda del Día (solo lectura)" },
      { href: "/ortodoncia/reprogramar", label: "Turnos a reprogramar" },
      { href: "/ortodoncia/pacientes", label: "Pacientes" },
      { href: "/ortodoncia/controles", label: "Controles" },
      { href: "/ortodoncia/cuentas-por-cobrar", label: "Cuentas por cobrar" },
      { href: "/ortodoncia/caja", label: "Caja" },
    ],
  },
  {
    tipo: "grupo",
    label: "Gerencial",
    soloDuena: true,
    items: [{ href: "/gerencial/produccion", label: "Producción y liquidación" }],
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
          activo ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
        }`}
      >
        {grupo.label}
        <span className="text-xs">▾</span>
      </button>
      {abierto && (
        <div className="absolute left-0 z-10 mt-1 w-56 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
          {grupo.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setAbierto(false)}
              className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
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
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-1 px-6 py-3">
        <span className="mr-4 font-bold text-gray-900">🦷 Clínica Dental</span>
        {GRUPOS.filter((g) => !g.soloDuena || esDuena).map((g) => {
          if (g.tipo === "link") {
            const activo = pathname === g.href;
            return (
              <Link
                key={g.href}
                href={g.href}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  activo ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {g.label}
              </Link>
            );
          }
          const activo = g.items.some((i) => i.href === pathname);
          return <MenuDesplegable key={g.label} grupo={g} activo={activo} />;
        })}
        <span className="ml-auto flex items-center gap-3 text-sm text-gray-500">
          {perfil?.nombre || user.email}
          <button onClick={cerrarSesion} className="text-red-600 hover:underline">
            Cerrar sesión
          </button>
        </span>
      </div>
    </nav>
  );
}
