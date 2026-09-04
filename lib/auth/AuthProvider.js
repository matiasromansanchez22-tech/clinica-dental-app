"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { registrarAcceso } from "@/lib/data/accesos";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [perfilCargando, setPerfilCargando] = useState(true);

  async function cargarPerfil(usuario) {
    if (!usuario) {
      setPerfil(null);
      return;
    }
    const { data } = await supabase.from("perfiles").select("*").eq("id", usuario.id).maybeSingle();
    setPerfil(data);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null);
      await cargarPerfil(session?.user ?? null);
      setCargando(false);
      setPerfilCargando(false);
    });

    // Ojo: este evento también se dispara cuando la pestaña vuelve a tener
    // foco (Supabase refresca el token al volver), no solo al iniciar o
    // cerrar sesión de verdad. Por eso NO tocamos perfilCargando acá — si
    // lo hiciéramos, cada vez que alguien vuelve de otra pestaña, RequireAuth
    // desmontaría y volvería a montar toda la pantalla, y se perdería
    // cualquier cosa que tuviera elegida (por ejemplo, la fecha de la
    // Agenda o de Caja volvería a "hoy").
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      await cargarPerfil(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function iniciarSesion(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    registrarAcceso();
  }

  async function cerrarSesion() {
    await supabase.auth.signOut();
  }

  async function cambiarPassword(passwordActual, passwordNueva) {
    const { error: errorReautenticacion } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: passwordActual,
    });
    if (errorReautenticacion) throw new Error("La contraseña actual no es correcta.");

    const { error } = await supabase.auth.updateUser({ password: passwordNueva });
    if (error) throw error;
  }

  return (
    <AuthContext.Provider
      value={{ user, perfil, cargando, perfilCargando, iniciarSesion, cerrarSesion, cambiarPassword }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
