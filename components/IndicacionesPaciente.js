"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { INDICACIONES, sugerirIndicacion } from "@/lib/indicacionesPaciente";
import { linkWhatsApp, nombreCercano } from "@/lib/whatsapp";

// Botón para mandarle al paciente, por WhatsApp, las recomendaciones del tratamiento que se hizo hoy. Sugiere solo el mensaje según lo
// que se registró en esta visita (y lo que se está por registrar); se puede cambiar de tratamiento y editar el texto antes de enviar.
export default function IndicacionesPaciente({ turno, nombresActuales = [] }) {
  const [hechasHoy, setHechasHoy] = useState([]);
  const [celular, setCelular] = useState(null);
  const [elegida, setElegida] = useState(null);
  const [editado, setEditado] = useState({});
  const [abierto, setAbierto] = useState(false);
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    let vigente = true;
    async function leer() {
      const [prest, pac] = await Promise.all([
        supabase.from("prestaciones_realizadas_agenda").select("prestacion").eq("turno_general_id", turno.id),
        turno.pacienteId ? supabase.from("pacientes").select("celular").eq("id", turno.pacienteId).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      if (!vigente) return;
      setHechasHoy((prest.data || []).map((f) => f.prestacion).filter(Boolean));
      setCelular(pac.data?.celular || null);
    }
    leer().catch(() => {});
    return () => {
      vigente = false;
    };
  }, [turno.id, turno.pacienteId]);

  const claveNombres = nombresActuales.join("|");
  const sugerida = useMemo(() => sugerirIndicacion([...hechasHoy, ...(claveNombres ? claveNombres.split("|") : [])]), [hechasHoy, claveNombres]);
  const clave = elegida ?? sugerida ?? "";
  const indicacion = INDICACIONES.find((i) => i.clave === clave) || null;
  const mensaje = indicacion ? editado[clave] ?? indicacion.texto(nombreCercano(turno.paciente)) : "";
  const link = indicacion ? linkWhatsApp(celular, mensaje) : null;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(mensaje);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // si el navegador no deja copiar, queda el texto a la vista para copiarlo a mano
    }
  }

  return (
    <div className="mt-4 rounded-md border border-sky-200 bg-sky-50/60 p-3">
      <button type="button" onClick={() => setAbierto((a) => !a)} className="flex w-full items-center justify-between text-left" aria-expanded={abierto}>
        <span className="text-xs font-semibold text-sky-900">
          📲 Enviar indicaciones al paciente
          {sugerida && !abierto && <span className="ml-1 font-normal text-sky-800">· sugerido: {INDICACIONES.find((i) => i.clave === sugerida)?.titulo.replace("Después de ", "")}</span>}
        </span>
        <span className="text-xs text-sky-700">{abierto ? "▲" : "▼"}</span>
      </button>

      {abierto && (
        <div className="mt-2 flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-xs text-gray-600">
            ¿Qué tratamiento se hizo?
            <select value={clave} onChange={(e) => setElegida(e.target.value)} className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800">
              <option value="">(elegí uno)</option>
              {INDICACIONES.map((i) => (
                <option key={i.clave} value={i.clave}>
                  {i.titulo}
                  {i.clave === sugerida ? " (sugerido)" : ""}
                </option>
              ))}
            </select>
          </label>

          {indicacion && (
            <>
              <textarea
                value={mensaje}
                onChange={(e) => setEditado((m) => ({ ...m, [clave]: e.target.value }))}
                rows={10}
                className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-xs leading-relaxed text-gray-800"
              />
              <div className="flex flex-wrap items-center gap-2">
                {link ? (
                  <a href={link} target="_blank" rel="noopener noreferrer" className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
                    📲 Enviar por WhatsApp
                  </a>
                ) : (
                  <span className="text-xs text-red-700">Este paciente no tiene celular cargado: copiá el mensaje y mandalo a mano.</span>
                )}
                <button type="button" onClick={copiar} className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                  {copiado ? "✓ Copiado" : "Copiar mensaje"}
                </button>
              </div>
              <p className="text-[11px] text-gray-500">Se abre WhatsApp con el mensaje listo: revisalo y tocá enviar. {celular ? `Va al ${celular}.` : ""}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
