"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";

const SECCIONES = [
  { href: "/", label: "Inicio" },
  { href: "/agenda", label: "Agenda" },
  { href: "/pacientes", label: "Pacientes" },
  { href: "/nomenclador", label: "Nomenclador" },
  { href: "/catalogo", label: "Catálogo" },
  { href: "/presupuestos", label: "Presupuestos" },
  { href: "/planes", label: "Planes" },
  { href: "/caja", label: "Caja" },
  { href: "/cierre", label: "Cierre" },
  { href: "/gerencial", label: "Gerencial", soloDuena: true },
];

export default function NavBar() {
  const pathname = usePathname();
  const { user, perfil, cerrarSesion } = useAuth();

  if (!user) return null;

  const esDuena = perfil?.rol === "Duena";
  const secciones = SECCIONES.filter((s) => !s.soloDuena || esDuena);

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-1 px-6 py-3">
        <span className="mr-4 font-bold text-gray-900">🦷 Clínica Dental</span>
        {secciones.map((s) => {
          const activo = pathname === s.href;
          return (
            <Link
              key={s.href}
              href={s.href}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                activo ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {s.label}
            </Link>
          );
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
