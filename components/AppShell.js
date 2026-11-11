"use client";

import { usePathname } from "next/navigation";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import RequireAuth from "@/components/RequireAuth";
import NavBar from "@/components/NavBar";
import CapturaErrores from "@/components/CapturaErrores";
import { esRutaPublica } from "@/lib/rutasPublicas";

export default function AppShell({ children }) {
  const pathname = usePathname();
  // Páginas que se abren sin iniciar sesión y sin el menú del sistema (ver lib/rutasPublicas.js).
  const esLogin = esRutaPublica(pathname);

  return (
    <AuthProvider>
      <CapturaErrores>
        {!esLogin && <NavBar />}
        <RequireAuth>{children}</RequireAuth>
      </CapturaErrores>
    </AuthProvider>
  );
}
