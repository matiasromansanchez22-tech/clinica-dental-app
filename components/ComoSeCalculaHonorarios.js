"use client";

// Explicación corta, siempre a mano, de cómo se calcula lo que le corresponde a cada profesional.
// Se usa en Producción y liquidación y en Liquidaciones por profesional, para que todos vean la misma regla.
export default function ComoSeCalculaHonorarios() {
  return (
    <details className="mt-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-950 print:hidden">
      <summary className="cursor-pointer font-semibold">¿Cómo se calcula lo que le corresponde a cada profesional?</summary>
      <div className="mt-2 space-y-2 text-[13px] leading-snug">
        <p>
          <strong>Regla general:</strong> honorario = <strong>valor de catálogo de la prestación × el % del profesional</strong>. Si el profesional tiene un % propio para una
          especialidad (por ejemplo Catalina: Periodoncia 50%), se usa ese. Se calcula sobre el valor de catálogo y no sobre lo que el paciente terminó
          pagando: así un descuento o una financiación no le cambia lo que le toca por lo que hizo.
        </p>
        <p>
          <strong>Planes de financiación:</strong> las cuotas se cargan solo con un monto, así que cada cuota se reparte entre las prestaciones del presupuesto: de la
          más vieja a la más nueva, hasta completar el valor de cada una. Una prestación cuenta desde el día de su primer turno cargado (si nunca se cargó, desde que
          empezó el plan). Lo que le toca a cada prestación va al <strong>profesional que la hizo</strong>, con el % de su especialidad.
        </p>
        <p>
          <strong>Cobrado por adelantado sin tratamiento:</strong> si se cobró antes de poder ubicarlo en un tratamiento, queda «sin asignar» y no se le liquida a nadie
          hasta que se cargue el turno de ese tratamiento.
        </p>
        <p>
          <strong>Obra social:</strong> sobre lo que paga la obra social × el % de obra social del profesional, a mes vencido (cuando se cobra de la obra social). El copago
          que cobra la clínica al paciente se liquida como un cobro más.
        </p>
        <p>
          <strong>Ortodoncia:</strong> se toma el valor normal del control (los descuentos del plan de referidos y de la tarjeta de fidelidad los absorbe la clínica).
        </p>
        <p>
          <strong>No se liquida:</strong> la estampilla y lo marcado «sin honorarios».
        </p>
        <p className="rounded-md bg-white/70 px-3 py-1.5">
          <strong>Ejemplo:</strong> plan de $600.000 de raspado y alisado radicular (Periodoncia). Se cobraron $200.000 entre anticipo y cuota 1. Esos $200.000 se asignan
          al raspado, que lo hizo Catalina con 50% en Periodoncia: <strong>$200.000 × 50% = $100.000</strong>. En cada cuota que se cobre se suma el 50% de esa cuota.
        </p>
      </div>
    </details>
  );
}
