// Indicaciones para el paciente después de un tratamiento (mensaje de WhatsApp listo para mandar al terminar).
// Para sumar o corregir un tratamiento se edita esta lista: `palabras` es lo que se busca en el nombre de la prestación para sugerir el
// mensaje solo, y `texto(nombre)` es el mensaje (el nombre ya viene en versión cercana: "Juli", "Agus"…).

const FIRMA = "Clínica Dental Marianela Ramírez";

export const INDICACIONES = [
  {
    clave: "extraccion",
    emoji: "🦷",
    titulo: "Después de una extracción",
    palabras: /extracci|exodoncia/i,
    texto: (n) =>
      `Hola ${n}! 😊 Hoy te hicimos una extracción. Para que cicatrice bien:

• Mordé la gasa 30 minutos. Si sigue sangrando, poné otra gasa limpia y mordé de nuevo.
• Hoy no te enjuagues, no escupas fuerte ni uses sorbete.
• Hielo por fuera de la cara, 10 min sí y 10 min no, durante las primeras horas.
• Comé frío o tibio y blando (yogur, puré, helado). Nada caliente ni duro.
• No fumes ni tomes alcohol durante 48 hs como mínimo.
• Desde mañana, enjuagues suaves con agua tibia y sal. Cepillate normal, sin tocar la herida.
• Tomá la medicación tal como te la indicó el profesional.

⚠️ Escribinos si el sangrado no para, si tenés mucha hinchazón, fiebre o un dolor fuerte que aumenta pasados 2 o 3 días.
${FIRMA}`,
  },
  {
    clave: "conducto",
    emoji: "🦷",
    titulo: "Después de un tratamiento de conducto",
    palabras: /endodoncia|conducto|pulpectom|pulpotom/i,
    texto: (n) =>
      `Hola ${n}! 😊 Hoy te hicimos el tratamiento de conducto. Tené en cuenta:

• Es normal sentir sensibilidad o molestia al masticar unos días. Se calma sola.
• Tomá la medicación que te indicó el profesional.
• Mientras la anestesia no pase, no comas ni muerdas (te podés morder el labio o la mejilla sin darte cuenta).
• Evitá masticar del lado tratado hasta que te coloquemos la restauración definitiva.
• Es importante que vuelvas para la restauración (arreglo o corona). Sin eso el diente puede fracturarse o reinfectarse.
• Seguí cepillándote y usando hilo dental normalmente.

⚠️ Avisanos si aparece hinchazón, fiebre, dolor fuerte que no cede o si se cae la restauración provisoria.
${FIRMA}`,
  },
  {
    clave: "restauracion",
    emoji: "🦷",
    titulo: "Después de una restauración (arreglo / caries)",
    palabras: /restauraci|obturaci|composite|resina|arreglo/i,
    texto: (n) =>
      `Hola ${n}! 😊 Ya terminamos tu arreglo.

• Esperá a que pase la anestesia antes de comer.
• Puede haber sensibilidad al frío o al calor unos días. Es normal.
• Si sentís que la mordida está alta o te molesta al cerrar, avisanos y la ajustamos.
• Cepillado e hilo dental todos los días, y control cada 6 meses.

${FIRMA}`,
  },
  {
    clave: "cirugia",
    emoji: "🦷",
    titulo: "Después de una cirugía o un implante",
    palabras: /implante|cirug|injerto|elevaci|regeneraci|frenectom|apicectom|alveolo/i,
    texto: (n) =>
      `Hola ${n}! 😊 Hoy te hicimos una cirugía. Es muy importante que sigas esto:

• Hielo por fuera de la cara las primeras 24 hs, con descansos.
• Dieta blanda y fría o tibia los primeros días. Masticá del lado contrario.
• No toques la zona con la lengua ni con los dedos. No tires de los labios para mirarla.
• No fumes ni tomes alcohol, retrasan la cicatrización.
• Es normal que tengas algo de hinchazón y pequeñas manchas de sangre en la saliva los primeros días.
• Tomá la medicación exactamente como te la indicaron.
• Cepillado normal en el resto de la boca, y enjuagues suaves con lo que te haya indicado el profesional.

⚠️ Escribinos de inmediato si hay sangrado que no cede, fiebre, mucha hinchazón o dolor que va en aumento.
${FIRMA}`,
  },
  {
    clave: "protesis",
    emoji: "🦷",
    titulo: "Después de colocar una corona o prótesis",
    palabras: /corona|pr[oó]tesis|puente|incrustaci|carilla/i,
    texto: (n) =>
      `Hola ${n}! 😊 Ya tenés tu corona / prótesis.

• Los primeros días puede sentirse distinta o con algo de sensibilidad. Es normal.
• Evitá alimentos muy duros o pegajosos los primeros días.
• Cepillate e higienizá bien alrededor, con hilo dental o cepillos interdentales.
• Si sentís que la mordida está alta, se mueve o te molesta, avisanos y lo ajustamos.

${FIRMA}`,
  },
];

// Orden de prioridad al adivinar el tratamiento por el nombre de lo que se hizo (cirugía antes que extracción, etc.).
const PRIORIDAD = ["cirugia", "extraccion", "conducto", "protesis", "restauracion"];

// Dado el nombre de una o varias prestaciones, devuelve la clave del mensaje que corresponde (o null si no reconoce ninguna).
export function sugerirIndicacion(nombresDePrestaciones) {
  const texto = (nombresDePrestaciones || []).join(" | ");
  if (!texto) return null;
  for (const clave of PRIORIDAD) {
    const ind = INDICACIONES.find((i) => i.clave === clave);
    if (ind?.palabras.test(texto)) return clave;
  }
  return null;
}
