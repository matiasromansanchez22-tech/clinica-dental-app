"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";

export default function CambiarPasswordPage() {
  const { perfil, user, cambiarPassword } = useAuth();
  const [passwordActual, setPasswordActual] = useState("");
  const [passwordNueva, setPasswordNueva] = useState("");
  const [passwordConfirmar, setPasswordConfirmar] = useState("");
  const [error, setError] = useState(null);
  const [exito, setExito] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setExito(false);

    if (passwordNueva.length < 6) {
      setError("La contraseña nueva tiene que tener al menos 6 caracteres.");
      return;
    }
    if (passwordNueva !== passwordConfirmar) {
      setError("La confirmación no coincide con la contraseña nueva.");
      return;
    }

    setEnviando(true);
    try {
      await cambiarPassword(passwordActual, passwordNueva);
      setExito(true);
      setPasswordActual("");
      setPasswordNueva("");
      setPasswordConfirmar("");
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-lg border border-brand-tan bg-brand-cream p-6 shadow-sm">
        <h1 className="mb-1 font-heading text-xl font-semibold text-brand-brown">Cambiar contraseña</h1>
        <p className="mb-6 text-sm text-brand-charcoal/60">{perfil?.nombre || user?.email}</p>

        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
        )}
        {exito && (
          <div className="mb-4 rounded-md border border-brand-mint/40 bg-brand-mint/15 px-3 py-2 text-sm text-brand-green">
            Contraseña actualizada correctamente.
          </div>
        )}

        <label className="mb-3 flex flex-col gap-1 text-sm text-brand-charcoal/80">
          Contraseña actual
          <input
            type="password"
            value={passwordActual}
            onChange={(e) => setPasswordActual(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2"
            autoFocus
          />
        </label>

        <label className="mb-3 flex flex-col gap-1 text-sm text-brand-charcoal/80">
          Contraseña nueva
          <input
            type="password"
            value={passwordNueva}
            onChange={(e) => setPasswordNueva(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2"
          />
        </label>

        <label className="mb-6 flex flex-col gap-1 text-sm text-brand-charcoal/80">
          Confirmar contraseña nueva
          <input
            type="password"
            value={passwordConfirmar}
            onChange={(e) => setPasswordConfirmar(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2"
          />
        </label>

        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-md bg-brand-brown px-4 py-2 text-sm font-medium text-white hover:bg-brand-brown-dark disabled:opacity-50"
        >
          {enviando ? "Guardando..." : "Cambiar contraseña"}
        </button>
      </form>
    </main>
  );
}
