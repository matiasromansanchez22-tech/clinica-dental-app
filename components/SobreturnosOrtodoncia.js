"use client";

import { useCallback, useEffect, useState } from "react";
import {
  TIPOS_OTRO_ORTODONCISTA,
  clasificarTurno,
  confirmarSobreturnoConLaOtra,
  obtenerLugaresLibresParaSobreturno,
  obtenerSobreturnos,
  obtenerTurnosSinClasificar,
  pasarSobreturnoASuOrtodoncista,
} from "@/lib/data/sobreturnosOrtodoncia";
import { fechaDeHoyISO } from "@/lib/agenda";

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function fechaCorta(fechaISO) {
  const [a, m, d] = fechaISO.split("-").map(Number);
  return `${DIAS[new Date(a, m - 1, d).getDay()]} ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

function FilaSobreturno({ sobreturno, onCambio }) {
  const [lugares, setLugares] = useState(null);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState(null);
  const hoy = fechaDeHoyISO();
  const vencido = sobreturno.fecha <= hoy;

  useEffect(() => {
    let activo = true;
    obtenerLugaresLibresParaSobreturno(sobreturno)
      .then((l) => activo && setLugares(l))
      .catch((e) => activo && setError(e.message));
    return () => {
      activo = false;
    };
  }, [sobreturno]);

  async function ejecutar(accion) {
    setTrabajando(true);
    setError(null);
    try {
      await accion();
      onCambio();
    } catch (e) {
      setError(e.message);
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <div className={`rounded-md border px-3 py-2 ${vencido ? "border-red-300 bg-red-50" : "border-amber-300 bg-amber-50"}`}>
      <p className="text-sm text-gray-900">
        <strong>{sobreturno.paciente}</strong> · {sobreturno.concepto}
        <span className="text-gray-600">
          {" "}
          · es de <strong>{sobreturno.habitual}</strong> · agendado con <strong>{sobreturno.atiende}</strong> el {fechaCorta(sobreturno.fecha)} {sobreturno.hora}
        </span>
        {vencido && <span className="ml-2 rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{sobreturno.fecha < hoy ? "YA PASÓ" : "ES HOY"}</span>}
      </p>
      {sobreturno.motivo && <p className="text-xs text-gray-600">{sobreturno.motivo}</p>}

      <div className="mt-2 text-xs text-gray-700">
        {lugares === null && !error && "Buscando lugares libres..."}
        {lugares && lugares.length === 0 && `Todavía no se liberó ningún lugar con ${sobreturno.habitual} hasta esa fecha.`}
        {lugares && lugares.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">Se liberó con {sobreturno.habitual}:</span>
            {lugares.slice(0, 6).map((l) => (
              <button
                key={`${l.fecha}${l.hora}${l.consultorio}`}
                disabled={trabajando}
                onClick={() => {
                  if (!window.confirm(`¿Pasar a ${sobreturno.paciente} al ${fechaCorta(l.fecha)} ${l.hora} con ${sobreturno.habitual}? Hay que avisarle al paciente.`)) return;
                  ejecutar(() => pasarSobreturnoASuOrtodoncista(sobreturno, l));
                }}
                className="rounded-md border border-emerald-600 bg-white px-2 py-1 font-medium text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
              >
                Pasar al {fechaCorta(l.fecha)} {l.hora}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
        <button
          disabled={trabajando}
          onClick={() => {
            if (!window.confirm(`¿Confirmar que a ${sobreturno.paciente} lo atiende ${sobreturno.atiende}? Pasa a ser una prioridad normal.`)) return;
            ejecutar(() => confirmarSobreturnoConLaOtra(sobreturno.id));
          }}
          className="rounded-md border border-gray-400 bg-white px-2 py-1 font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
        >
          Confirmar: lo atiende {sobreturno.atiende}
        </button>
        <span className="text-gray-500">Si no hay lugar y no va a venir, cancelá o reprogramá el turno desde la agenda.</span>
      </div>
      {error && <p className="mt-1 text-xs text-red-700">{error}</p>}
    </div>
  );
}

function FilaSinClasificar({ turno, onCambio }) {
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState(null);

  async function clasificar(tipo) {
    setTrabajando(true);
    setError(null);
    try {
      await clasificarTurno(turno.id, tipo, { habitualId: turno.fichaId });
      onCambio();
    } catch (e) {
      setError(e.message);
      setTrabajando(false);
    }
  }

  const botones = [
    { tipo: TIPOS_OTRO_ORTODONCISTA.PRIORIDAD, texto: "⭐ Prioridad" },
    { tipo: TIPOS_OTRO_ORTODONCISTA.SOBRETURNO, texto: "🔁 Sobreturno" },
    { tipo: TIPOS_OTRO_ORTODONCISTA.COBERTURA, texto: "↔ Cobertura" },
  ];

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-gray-200 px-3 py-2">
      <p className="text-sm text-gray-900">
        <strong>{turno.paciente}</strong> · {turno.concepto}
        <span className="text-gray-600">
          {" "}
          · es de {turno.ficha} · lo atiende {turno.atiende} el {fechaCorta(turno.fecha)} {turno.hora}
        </span>
      </p>
      <div className="flex gap-1.5">
        {botones.map((b) => (
          <button
            key={b.tipo}
            disabled={trabajando}
            onClick={() => clasificar(b.tipo)}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
          >
            {b.texto}
          </button>
        ))}
      </div>
      {error && <p className="w-full text-xs text-red-700">{error}</p>}
    </div>
  );
}

// Sobreturnos para acomodar + turnos con otra ortodoncista que todavía no se clasificaron.
export default function SobreturnosOrtodoncia() {
  const [sobreturnos, setSobreturnos] = useState(null);
  const [sinClasificar, setSinClasificar] = useState(null);
  const [disponible, setDisponible] = useState(true);

  const cargar = useCallback(async () => {
    const [s, c] = await Promise.all([obtenerSobreturnos(), obtenerTurnosSinClasificar()]);
    setDisponible(s.disponible && c.disponible);
    setSobreturnos(s.sobreturnos);
    setSinClasificar(c.turnos);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar().catch(() => setDisponible(false));
  }, [cargar]);

  if (!disponible) {
    return (
      <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">Falta activar los sobreturnos (migración 169).</div>
    );
  }
  if (sobreturnos === null || sinClasificar === null) return null;

  return (
    <>
      <section className="mt-6 rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-gray-900">🔁 Sobreturnos para acomodar</h2>
          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${sobreturnos.length > 0 ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-800"}`}>
            {sobreturnos.length > 0 ? sobreturnos.length : "OK"}
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Pacientes agendados con otra ortodoncista para no perder el lugar. Si se libera un turno con su ortodoncista, se pasa con un toque.
        </p>
        {sobreturnos.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {sobreturnos.map((s) => (
              <FilaSobreturno key={s.id} sobreturno={s} onCambio={cargar} />
            ))}
          </div>
        )}
      </section>

      {sinClasificar.length > 0 && (
        <section className="mt-6 rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-gray-900">Turnos con otra ortodoncista sin clasificar</h2>
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-800">{sinClasificar.length}</span>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Los atiende una ortodoncista distinta a la de la ficha y no figura por qué. Elegí cada uno: ⭐ Prioridad (después vuelve con la suya), 🔁 Sobreturno
            (se pasa si se libera un lugar) o ↔ Cobertura (solo ese día, no cambia nada).
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {sinClasificar.map((t) => (
              <FilaSinClasificar key={t.id} turno={t} onCambio={cargar} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
