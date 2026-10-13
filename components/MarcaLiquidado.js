"use client";

function formatoFecha(fechaISO) {
  if (!fechaISO) return "";
  const [, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}`;
}

// "Liquidado ✓" de un cobro: ya se le pagó al profesional lo que corresponde a este
// paciente. `liquidacion` viene de obtenerLiquidacionesDeCobros ({ fecha, profesional }).
// Si se pasa `onQuitar`, aparece una ✕ para sacar la marca (por si se tildó por error).
export default function MarcaLiquidado({ liquidacion, onQuitar }) {
  if (!liquidacion) return null;
  return (
    <span
      className={`ml-1.5 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${
        liquidacion.tratamientoSaldado ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-800"
      }`}
      title={`${liquidacion.tratamientoSaldado ? "Tratamiento saldado: ya se le pagó el total" : "Ya se le liquidó"}${liquidacion.profesional ? ` a ${liquidacion.profesional}` : ""}${liquidacion.fecha ? ` el ${formatoFecha(liquidacion.fecha)}` : ""}`}
    >
      {liquidacion.tratamientoSaldado ? "Tratamiento saldado ✓" : "Liquidado ✓"}
      {liquidacion.fecha && ` ${formatoFecha(liquidacion.fecha)}`}
      {onQuitar && (
        <button
          onClick={onQuitar}
          aria-label="Quitar marca de liquidado"
          className={liquidacion.tratamientoSaldado ? "text-emerald-100 hover:text-red-200" : "text-emerald-600 hover:text-red-600"}
        >
          ✕
        </button>
      )}
    </span>
  );
}
