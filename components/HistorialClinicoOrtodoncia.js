"use client";

import HistorialClinico from "@/components/HistorialClinico";
import {
  actualizarEntradaHistorial,
  crearEntradaHistorial,
  eliminarEntradaHistorial,
  obtenerHistorialClinico,
} from "@/lib/data/historialClinicoOrtodoncia";

// Se usa tanto en la ficha del paciente (Pacientes → Ortodoncia) como en la
// Agenda (normal y "Ver Agenda del Día").
export default function HistorialClinicoOrtodoncia({ pacienteId, profesionales }) {
  return (
    <HistorialClinico
      pacienteId={pacienteId}
      profesionales={profesionales}
      obtenerHistorial={obtenerHistorialClinico}
      crearEntrada={crearEntradaHistorial}
      actualizarEntrada={actualizarEntradaHistorial}
      eliminarEntrada={eliminarEntradaHistorial}
    />
  );
}
