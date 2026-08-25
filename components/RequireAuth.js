"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";

export default function RequireAuth({ children }) {
  const { user, cargando } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const esLogin = pathname === "/login";

  useEffect(() => {
    if (!cargando && !user && !esLogin) {
      router.replace("/login");
    }
  }, [cargando, user, esLogin, router]);

  if (esLogin) return children;

  if (cargando || !user) {
    return (
      <div className="flex flex-1 items-center justify-center p-10 text-sm text-gray-500">
        Cargando...
      </div>
    );
  }

  return children;
}
