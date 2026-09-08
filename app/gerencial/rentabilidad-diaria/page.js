"use client";

import { useEffect, useState } from "react";
import SoloDuena from "@/components/SoloDuena";
import { fechaDeHoyISO } from "@/lib/agenda";
import { obtenerProfesionales } from "@/lib/data/profesionales";
import { obtenerTurnosGeneralPorFecha } from "@/lib/data/turnosGeneral";
import { obtenerProduccionPorProfesional } from "@/lib/data/produccionProfesionales";

function formatoPesos(n) {
  return `$${Math.round(n).toLocaleString("es-AR")}`;
}

function horaANumero(horaHHMM) {
  const [h, m] = horaHHMM.slice(0, 5).split(":").map(Number);
  return h + m / 60;
}

// Semáforo simple para ver de un vistazo quién tuvo el día flojo, sin
// tener que leer el número.
function semaforoOcupacion(porcentaje) {
  if (porcentaje >= 70) return { emoji: "🟢", color: "text-emerald-700" };
  if (porcentaje >= 40) return { emoji: "🟡", color: "text-amber-600" };
  return { emoji: "🔴", color: "text-red-600" };
}

function FilaProfesional({ fila }) {
  const [abierto, setAbierto] = useState(false);
  const semaforo = fila.horasDisponibles > 0 ? semaforoOcupacion(fila.porcentajeOcupacion) : null;

  return (
    <>
      <tr onClick={() => setAbierto((a) => !a)} className="cursor-pointer border-t border-gray-100 hover:bg-gray-50">
        <td className="px-3 py-2 font-medium text-gray-900">
          {fila.turnos.length > 0 ? (abierto ? "▾" : "▸") : ""} {fila.nombre}
        </td>
        <td className="px-2 py-2 text-center text-gray-600">
          {fila.horasDisponibles > 0 ? `${fila.horasDisponibles.toFixed(1)} hs` : "No trabaja hoy"}
        </td>
        <td className="px-2 py-2 text-center text-gray-600">{fila.turnosAgendados}</td>
        <td className="px-2 py-2 text-center text-emerald-700">{fila.turnosAtendidos}</td>
        <td className="px-2 py-2 text-center text-amber-600">{fila.turnosNoAsistioOCancelado}</td>
        <td className="px-2 py-2 text-center">
          {semaforo ? (
            <span className={`font-semibold ${semaforo.color}`}>
              {semaforo.emoji} {fila.porcentajeOcupacion.toFixed(0)}%
            </span>
          ) : (
            "—"
          )}
        </td>
        <td className="px-3 py-2 text-right font-medium text-gray-900">{formatoPesos(fila.facturacionDelDia)}</td>
        <td className="px-3 py-2 text-right text-gray-600">
          {fila.horasOcupadas > 0 ? `${formatoPesos(fila.facturacionDelDia / fila.horasOcupadas)}/hs` : "—"}
        </td>
      </tr>
      {abierto && fila.turnos.length > 0 && (
        <tr className="bg-gray-50">
          <td colSpan={8} className="px-3 py-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500">
                  <th className="px-2 py-1 text-left font-medium">Hora</th>
                  <th className="px-2 py-1 text-left font-medium">Paciente</th>
                  <th className="px-2 py-1 text-left font-medium">Tipo</th>
                  <th className="px-2 py-1 text-center font-medium">Duración</th>
                  <th className="px-2 py-1 text-left font-medium">Asistencia</th>
                </tr>
              </thead>
              <tbody>
                {fila.turnos.map((t) => (
                  <tr key={t.id} className="border-t border-gray-200">
                    <td className="px-2 py-1">{t.horaInicio}</td>
                    <td className="px-2 py-1">{t.paciente}</td>
                    <td className="px-2 py-1">{t.tipoAtencion}</td>
                    <td className="px-2 py-1 text-center">{t.duracionMin} min</td>
                    <td
                      className={`px-2 py-1 ${
                        t.asistencia === "Asistió"
                          ? "text-emerald-700"
                          : t.asistencia === "No asistió" || t.asistencia === "Canceló"
                            ? "text-red-600"
                            : "text-gray-400"
                      }`}
                    >
                      {t.asistencia}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}

function RentabilidadDiariaContenido() {
  const hoy = fechaDeHoyISO();
  const [fecha, setFecha] = useState(hoy);
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setCargando(true);
    setError(null);
    Promise.all([obtenerProfesionales(), obtenerTurnosGeneralPorFecha(fecha), obtenerProduccionPorProfesional(fecha, fecha)])
      .then(([profesionales, turnos, produccion]) => {
        const [anio, mes, dia] = fecha.split("-").map(Number);
        const diaSemana = new Date(anio, mes - 1, dia).getDay();

        const activos = profesionales.filter((p) => p.activo && p.especialidad !== "Ortodoncia");

        const nuevasFilas = activos.map((p) => {
          const bloquesHoy = (p.disponibilidad_profesional || []).filter(
            (d) => d.activo && d.dia_semana === diaSemana
          );
          const horasDisponibles = bloquesHoy.reduce(
            (acc, b) => acc + (horaANumero(b.hora_fin) - horaANumero(b.hora_inicio)),
            0
          );

          // "Reprogramado" significa que ese turno se movió a otro día/hora —
          // ya no ocupa esta franja, así que no cuenta acá (si no, se vería
          // un hueco como "ocupado" cuando en realidad quedó libre).
          const turnosDelProfesional = turnos
            .filter((t) => t.profesionalDeTurnoId === p.id && t.estado !== "Cancelado" && t.estado !== "Reprogramado")
            .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));

          const atendidos = turnosDelProfesional.filter((t) => t.asistencia === "Asistió");
          const noAsistioOCancelado = turnosDelProfesional.filter(
            (t) => t.asistencia === "No asistió" || t.asistencia === "Canceló"
          );
          const minutosOcupados = atendidos.reduce((acc, t) => acc + (t.duracionMin || 0), 0);
          const horasOcupadas = minutosOcupados / 60;

          const produccionProf = produccion.find((f) => f.profesionalId === p.id);

          return {
            profesionalId: p.id,
            nombre: p.nombre,
            horasDisponibles,
            horasOcupadas,
            porcentajeOcupacion: horasDisponibles > 0 ? (horasOcupadas / horasDisponibles) * 100 : 0,
            turnosAgendados: turnosDelProfesional.length,
            turnosAtendidos: atendidos.length,
            turnosNoAsistioOCancelado: noAsistioOCancelado.length,
            facturacionDelDia: produccionProf?.totalCopago || 0,
            turnos: turnosDelProfesional,
          };
        });

        nuevasFilas.sort((a, b) => b.facturacionDelDia - a.facturacionDelDia);
        setFilas(nuevasFilas);
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [fecha]);

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-bold text-gray-900">Rentabilidad diaria por profesional</h1>
      <p className="mt-1 text-sm text-gray-500">
        Cuánto generó cada uno ese día y qué tan ocupada estuvo su agenda — para ver de un vistazo si el día rindió,
        o si hubo mucho hueco vacío. Por ahora solo Odontología General.
      </p>

      <div className="mt-4 flex items-center gap-2">
        <input
          type="date"
          value={fecha}
          max={hoy}
          onChange={(e) => setFecha(e.target.value)}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
        />
        {fecha !== hoy && (
          <button onClick={() => setFecha(hoy)} className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50">
            Volver a hoy
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-brand-brown text-white">
              <th className="px-3 py-2 text-left font-semibold">Profesional</th>
              <th className="px-2 py-2 text-center font-semibold">Disponible</th>
              <th className="px-2 py-2 text-center font-semibold">Agendados</th>
              <th className="px-2 py-2 text-center font-semibold">Atendidos</th>
              <th className="px-2 py-2 text-center font-semibold">No asistió/Canceló</th>
              <th className="px-2 py-2 text-center font-semibold">Ocupación</th>
              <th className="px-3 py-2 text-right font-semibold">Facturó ese día</th>
              <th className="px-3 py-2 text-right font-semibold">$/hora trabajada</th>
            </tr>
          </thead>
          <tbody>
            {cargando && (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-gray-500">
                  Cargando...
                </td>
              </tr>
            )}
            {!cargando && filas.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-4 text-center text-gray-500">
                  No hay profesionales activos de Odontología General.
                </td>
              </tr>
            )}
            {!cargando && filas.map((fila) => <FilaProfesional key={fila.profesionalId} fila={fila} />)}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-gray-400">
        "Disponible" sale del horario cargado en Profesionales para ese día de la semana (no descuenta feriados ni
        licencias puntuales). "Ocupación" es el tiempo de los turnos realmente atendidos sobre ese horario
        disponible. Tocá una fila para ver el detalle de los turnos de ese día.
      </p>
    </main>
  );
}

export default function RentabilidadDiariaPage() {
  return (
    <SoloDuena>
      <RentabilidadDiariaContenido />
    </SoloDuena>
  );
}
