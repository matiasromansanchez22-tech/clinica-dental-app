"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { consentimientoPendienteDe, marcarConsentimientoFirmado } from "@/lib/data/consentimientos";

// Aviso dentro del turno: al paciente le falta firmar el consentimiento, así se aprovecha que está en el consultorio para hacerlo
// firmar. La secretaria y las dueñas pueden marcarlo como firmado desde acá.
export default function AvisoConsentimiento({ pacienteId, esOrtodoncia = false }) {
  const { perfil } = useAuth();
  const [pendiente, setPendiente] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const puedeMarcar = perfil?.rol === "Secretaria" || perfil?.rol === "Duena";
  const sistema = esOrtodoncia ? "ortodoncia" : "general";

  useEffect(() => {
    let activo = true;
    consentimientoPendienteDe(sistema, pacienteId)
      .then((p) => activo && setPendiente(p))
      .catch(() => {});
    return () => {
      activo = false;
    };
  }, [sistema, pacienteId]);

  async function marcar() {
    setGuardando(true);
    setError(null);
    try {
      await marcarConsentimientoFirmado(sistema, pacienteId);
      setPendiente(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  if (!pendiente) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      <span>
        ✍️ <strong>Falta firmar el consentimiento.</strong> Aprovechá que está acá para que lo firme.
      </span>
      {puedeMarcar && (
        <button
          type="button"
          onClick={marcar}
          disabled={guardando}
          className="rounded-md border border-amber-700 bg-white px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50"
        >
          {guardando ? "Guardando..." : "Ya firmó ✓"}
        </button>
      )}
      {error && <span className="w-full text-xs text-red-700">{error}</span>}
    </div>
  );
}
