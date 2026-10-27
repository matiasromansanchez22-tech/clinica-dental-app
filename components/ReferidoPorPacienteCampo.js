"use client";

import { useEffect, useMemo, useState } from "react";
import { obtenerPacientesOrtodoncia } from "@/lib/data/pacientesOrtodoncia";
import { obtenerReferidosDePaciente } from "@/lib/data/referidos";

// Campo del plan de referidos en la ficha de un paciente de Ortodoncia: quién lo recomendó (si fue un paciente de la
// clínica) y a quiénes recomendó él. `onChange(id | null)` avisa cuando cambia quién lo recomendó; mientras no se toque,
// el formulario no cambia nada.
export default function ReferidoPorPacienteCampo({ pacienteId, onChange }) {
  const [pacientes, setPacientes] = useState([]);
  const [relacion, setRelacion] = useState(null); // { vinoPor, recomendo } de la base
  const [texto, setTexto] = useState("");
  const [elegido, setElegido] = useState(undefined); // undefined = sin cambios; null = lo sacaron; objeto = paciente elegido

  useEffect(() => {
    obtenerPacientesOrtodoncia()
      .then(setPacientes)
      .catch(() => {});
    if (pacienteId) obtenerReferidosDePaciente(pacienteId).then(setRelacion).catch(() => {});
  }, [pacienteId]);

  const porNombre = useMemo(() => {
    const m = new Map();
    for (const p of pacientes) if (p.id !== pacienteId && !p.esOrtopedia) m.set(p.nombre.trim().toLowerCase(), p);
    return m;
  }, [pacientes, pacienteId]);

  function alEscribir(valor) {
    setTexto(valor);
    const p = porNombre.get(valor.trim().toLowerCase());
    if (p) {
      setElegido(p);
      onChange?.(p.id);
    }
  }

  function quitar() {
    setTexto("");
    setElegido(null);
    onChange?.(null);
  }

  const actual = elegido === undefined ? relacion?.vinoPor : elegido ? { referidor: elegido.nombre, premioReferidoEstado: "Pendiente" } : null;

  return (
    <div className="col-span-2 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
      <p className="text-xs font-semibold uppercase text-sky-700">🤝 Plan de referidos</p>
      {actual ? (
        <p className="mt-1">
          Lo recomendó <strong>{actual.referidor}</strong>
          {elegido === undefined && actual.premioReferidoEstado === "Aplicado" ? " · ya usó su descuento en la instalación" : ""}
          {elegido === undefined && actual.premioReferidoEstado === "Pendiente" ? " · tiene un descuento pendiente en la instalación" : ""}
          {elegido !== undefined && elegido !== null ? " · se guarda al grabar la ficha" : ""}{" "}
          <button type="button" onClick={quitar} className="text-xs underline">
            Quitar
          </button>
        </p>
      ) : (
        <label className="mt-1 flex flex-col gap-1 text-xs text-sky-900">
          ¿Lo recomendó un paciente de la clínica? Escribí su nombre y elegilo de la lista
          <input
            list="pacientes-ortodoncia-referidos"
            value={texto}
            onChange={(e) => alEscribir(e.target.value)}
            placeholder="Nombre del paciente que lo recomendó..."
            className="rounded-md border border-sky-300 bg-white px-2 py-1.5 text-sm text-gray-900"
          />
          <datalist id="pacientes-ortodoncia-referidos">
            {pacientes
              .filter((p) => p.id !== pacienteId && !p.esOrtopedia)
              .map((p) => (
                <option key={p.id} value={p.nombre} />
              ))}
          </datalist>
        </label>
      )}
      {relacion?.recomendo?.length > 0 && (
        <div className="mt-2 text-xs">
          <p className="font-medium">Pacientes que recomendó:</p>
          <ul className="mt-0.5 list-disc pl-5">
            {relacion.recomendo.map((r) => (
              <li key={r.id}>
                {r.referido} — {r.fechaInstalacion ? `empezó la instalación el ${r.fechaInstalacion.split("-").reverse().join("/")}` : "todavía no empezó la instalación"}
                {r.premioReferidorEstado === "Habilitado" && ` · 🎁 ${r.premioReferidorTipo} habilitado hasta el ${r.premioReferidorVence?.split("-").reverse().join("/")}`}
                {r.premioReferidorEstado === "Aplicado" && " · premio ya usado"}
                {r.premioReferidorEstado === "Vencido" && " · premio vencido"}
                {r.premioReferidorEstado === "Sin premio" && " · sin premio (tope del año)"}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
