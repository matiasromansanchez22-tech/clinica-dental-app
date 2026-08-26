"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";

export default function RequireAuth({ children }) {
  const { user, perfil, cargando, perfilCargando, cerrarSesion } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const esLogin = pathname === "/login";

  useEffect(() => {
    if (!cargando && !user && !esLogin) {
      router.replace("/login");
    }
  }, [cargando, user, esLogin, router]);

  if (esLogin) return children;

  if (cargando || !user || perfilCargando) {
    return (
      <div className="flex flex-1 items-center justify-center p-10 text-sm text-gray-500">
        Cargando...
      </div>
    );
  }

  // El usuario tiene una sesión válida en Supabase Auth, pero la Dueña nunca
  // lo dio de alta como personal en "perfiles" (por ejemplo, alguien que se
  // creó una cuenta por su cuenta). No dejamos ver nada de la app.
  if (!perfil) {
    return (
      <div className="flex flex-1 items-center justify-center p-10">
        <div className="max-w-sm text-center">
          <p className="text-sm text-red-700">
            Esta cuenta no tiene acceso a esta aplicación. Contactá a la dueña de la clínica.
          </p>
          <button
            onClick={cerrarSesion}
            className="mt-3 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    );
  }

  return children;
}
