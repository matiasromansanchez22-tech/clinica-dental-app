"use client";

import { usePathname } from "next/navigation";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import RequireAuth from "@/components/RequireAuth";
import NavBar from "@/components/NavBar";
import CapturaErrores from "@/components/CapturaErrores";

export default function AppShell({ children }) {
  const pathname = usePathname();
  // Páginas que se abren sin iniciar sesión y sin el menú del sistema: el login y las páginas públicas del plan de referidos
  // (la que se abre con el QR del cartel y el cartel para imprimir).
  const esLogin = pathname === "/login" || pathname === "/referidos" || pathname === "/referidos/cartel";

  return (
    <AuthProvider>
      <CapturaErrores>
        {!esLogin && <NavBar />}
        <RequireAuth>{children}</RequireAuth>
      </CapturaErrores>
    </AuthProvider>
  );
}
