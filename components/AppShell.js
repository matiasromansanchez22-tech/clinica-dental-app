"use client";

import { usePathname } from "next/navigation";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import RequireAuth from "@/components/RequireAuth";
import NavBar from "@/components/NavBar";

export default function AppShell({ children }) {
  const pathname = usePathname();
  const esLogin = pathname === "/login";

  return (
    <AuthProvider>
      {!esLogin && <NavBar />}
      <RequireAuth>{children}</RequireAuth>
    </AuthProvider>
  );
}
