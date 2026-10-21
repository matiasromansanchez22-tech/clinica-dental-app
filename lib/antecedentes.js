// Antecedentes médicos y patologías del paciente de Odontología General (misma idea que el encabezado de la historia clínica en papel:
// enfermedades, patologías, alergias, medicación y ATM, más una lista de condiciones frecuentes para tildar rápido).

export const CONDICIONES_MEDICAS = [
  "Diabetes",
  "Hipertensión",
  "Cardiopatía",
  "Marcapasos / válvula cardíaca",
  "Asma / problemas respiratorios",
  "Epilepsia",
  "Hepatitis",
  "VIH",
  "Trastornos de coagulación / anticoagulantes",
  "Enfermedad renal",
  "Enfermedad hepática",
  "Problemas de tiroides",
  "Osteoporosis / bifosfonatos",
  "Cáncer / quimioterapia / radioterapia",
  "Embarazo",
  "Lactancia",
  "Fiebre reumática",
  "Tabaquismo",
  "Bruxismo",
];

export const CAMPOS_ANTECEDENTES = [
  { clave: "enfermedades", etiqueta: "Enfermedades", ayuda: "Ej: diabetes tipo 2, hipertensión controlada" },
  { clave: "patologias", etiqueta: "Patologías", ayuda: "Ej: patologías de la boca, cirugías o internaciones previas" },
  { clave: "alergias", etiqueta: "Alergias", ayuda: "Ej: penicilina, anestesia, látex, ibuprofeno" },
  { clave: "medicacion", etiqueta: "Medicación actual", ayuda: "Ej: anticoagulantes, metformina, enalapril" },
  { clave: "atm", etiqueta: "ATM (articulación de la mandíbula)", ayuda: "Ej: chasquido, dolor, limitación de apertura" },
];

// "s/p", "no", "ninguna", "niega"… cuentan como "sin patología": no deben disparar una alerta.
export function esSinPatologia(texto) {
  const t = (texto || "").trim();
  if (!t) return true;
  return /^(s[/]p|sp|no|ninguna|ninguno|niega|sin patolog[ií]as?|sin alergias?)[.]?$/i.test(t);
}

// Lo que hay que mostrarle destacado al profesional antes de atender.
export function resumenAlertas(ant) {
  const alergias = esSinPatologia(ant?.alergias) ? null : ant.alergias.trim();
  const medicacion = esSinPatologia(ant?.medicacion) ? null : ant.medicacion.trim();
  const condiciones = ant?.condiciones || [];
  return { alergias, medicacion, condiciones, hayAlerta: Boolean(alergias || medicacion || condiciones.length > 0) };
}
