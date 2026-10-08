"use client";

import { useAuth } from "@/lib/auth/AuthProvider";

// Cajas, cuentas por cobrar y cierres de turno: no son para el Odontólogo, el
// Laboratorio ni Marketing (la Secretaria, las Dueñas y el Contador sí entran).
const ROLES_BLOQUEADOS = ["Odontologo", "Laboratorio", "CM"];

export default function NoOdontologoNiLaboratorio({ children }) {
  const { perfil, cargando } = useAuth();

  if (cargando) return null;

  if (ROLES_BLOQUEADOS.includes(perfil?.rol)) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Acceso restringido — esta sección no está disponible para este usuario.
        </div>
      </main>
    );
  }

  return children;
}
