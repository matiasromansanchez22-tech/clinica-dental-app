"use client";

import { useAuth } from "@/lib/auth/AuthProvider";

export default function SoloDuenaYContador({ children }) {
  const { perfil, cargando } = useAuth();

  if (cargando) return null;

  if (perfil?.rol !== "Duena" && perfil?.rol !== "Contador") {
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
