"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { resumenAlertas } from "@/lib/antecedentes";

// Cartel con los antecedentes médicos importantes del paciente (alergias, medicación, condiciones como diabetes o anticoagulantes),
// para que el profesional lo vea antes de atender. Si todavía no se cargaron antecedentes, avisa que faltan.
// Si todavía no se corrió la migración 172, no muestra nada.
export default function AlertaAntecedentes({ pacienteId }) {
  const [datos, setDatos] = useState(null);

  useEffect(() => {
    if (!pacienteId) return;
    let activo = true;
    supabase
      .from("pacientes")
      .select("ant_alergias, ant_medicacion, ant_condiciones, ant_actualizado_en")
      .eq("id", pacienteId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (activo && !error) setDatos(data);
      });
    return () => {
      activo = false;
    };
  }, [pacienteId]);

  if (!datos) return null;
  if (!datos.ant_actualizado_en) {
    return (
      <p className="mb-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-500">
        🩺 Los antecedentes médicos de este paciente todavía no están cargados (enfermedades, patologías, alergias, medicación). Se completan en su ficha.
      </p>
    );
  }
  const r = resumenAlertas({ alergias: datos.ant_alergias, medicacion: datos.ant_medicacion, condiciones: datos.ant_condiciones });
  if (!r.hayAlerta) {
    return <p className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-800">🩺 Sin patologías ni alergias registradas.</p>;
  }
  return (
    <div className="mb-3 rounded-md border-2 border-red-400 bg-red-50 px-3 py-2 text-sm text-red-900">
      <p className="font-semibold">⚠️ Alertas médicas</p>
      <ul className="mt-0.5 list-disc pl-5 text-xs">
        {r.alergias && <li><strong>Alergias:</strong> {r.alergias}</li>}
        {r.condiciones.length > 0 && <li><strong>Condiciones:</strong> {r.condiciones.join(" · ")}</li>}
        {r.medicacion && <li><strong>Medicación:</strong> {r.medicacion}</li>}
      </ul>
    </div>
  );
}
