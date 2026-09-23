"use client";

import HistorialClinico from "@/components/HistorialClinico";
import {
  actualizarEntradaHistorialGeneral,
  crearEntradaHistorialGeneral,
  eliminarEntradaHistorialGeneral,
  obtenerHistorialClinicoGeneral,
} from "@/lib/data/historialClinicoGeneral";

// Se usa tanto en la ficha del paciente (Pacientes) como en la Agenda
// (normal y "Ver Agenda del Día") de Sistema General.
export default function HistorialClinicoGeneral({ pacienteId, profesionales }) {
  return (
    <HistorialClinico
      pacienteId={pacienteId}
      profesionales={profesionales}
      obtenerHistorial={obtenerHistorialClinicoGeneral}
      crearEntrada={crearEntradaHistorialGeneral}
      actualizarEntrada={actualizarEntradaHistorialGeneral}
      eliminarEntrada={eliminarEntradaHistorialGeneral}
    />
  );
}
