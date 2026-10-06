"use client";

import { useState } from "react";
import ContadorBilletes from "@/components/ContadorBilletes";
import SoloDuenaContadorYSecretaria from "@/components/SoloDuenaContadorYSecretaria";
import { CONTEO_VACIO } from "@/lib/billetes";

function ContadorContenido() {
  const [conteo, setConteo] = useState(CONTEO_VACIO);
  const [esperado, setEsperado] = useState("");

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">💵 Contador de billetes</h1>
      <p className="mt-1 text-sm text-gray-500">
        Para contar el efectivo en cualquier momento. No se guarda nada: es solo para sumar y comparar.
      </p>

      <label className="mt-4 flex flex-col gap-1 text-sm text-gray-700">
        Efectivo que tendría que haber (opcional)
        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={esperado}
          onChange={(e) => setEsperado(e.target.value)}
          placeholder="Ej: lo que da el limpio en efectivo del día"
          className="rounded-md border border-gray-300 px-2 py-1.5 tabular-nums"
        />
      </label>

      <div className="mt-4">
        <ContadorBilletes
          conteo={conteo}
          onChange={setConteo}
          esperado={esperado === "" ? null : Number(esperado)}
          etiquetaEsperado="Tendría que haber"
        />
      </div>
    </main>
  );
}

export default function ContadorBilletesPage() {
  return (
    <SoloDuenaContadorYSecretaria>
      <ContadorContenido />
    </SoloDuenaContadorYSecretaria>
  );
}
