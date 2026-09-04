"use client";

import { useAuth } from "@/lib/auth/AuthProvider";

// Bloquea específicamente al rol Contador de pantallas con ficha completa
// de pacientes (nombre, DNI, celular, historia clínica...) — a diferencia
// del resto del personal, el Contador solo tiene permiso para ver el
// nombre del paciente dentro de un cobro/factura, no su ficha completa.
export default function NoContador({ children }) {
  const { perfil, cargando } = useAuth();

  if (cargando) return null;

  if (perfil?.rol === "Contador") {
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
