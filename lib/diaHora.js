// Formatos de día y hora para que cada dato se pueda ubicar con exactitud (ej. "mié 08/10", "10:15").

const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

// "2026-10-08" → "jue 08/10"
export function diaConFecha(fechaISO) {
  if (!fechaISO) return "—";
  const [anio, mes, dia] = fechaISO.split("-").map(Number);
  const d = new Date(anio, mes - 1, dia);
  return `${DIAS[d.getDay()]} ${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}`;
}

// Un instante guardado en UTC (created_at) → "11:02" en hora de Argentina.
export function horaLocalDe(isoUTC) {
  if (!isoUTC) return "";
  return new Date(isoUTC).toLocaleTimeString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// Un instante en UTC → "2026-10-08" en hora de Argentina.
export function fechaLocalDe(isoUTC) {
  return new Date(isoUTC).toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}
