"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center gap-1 px-6 py-3">
        <span className="mr-4 font-bold text-gray-900">🦷 Clínica Dental</span>
        {SECCIONES.map((s) => {
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
      </div>
    </nav>
  );
}
