"use client";

import { useAuth } from "@/lib/auth/AuthProvider";

export default function SoloDuena({ children }) {
  const { perfil, cargando } = useAuth();

  if (cargando) return null;

  if (perfil?.rol !== "Duena") {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Acceso restringido — esta sección es solo para la Dueña de la clínica.
        </div>
      </main>
    );
  }

  return children;
}
