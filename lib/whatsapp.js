// Arma un link de WhatsApp (wa.me) a partir de un celular guardado en
// cualquier formato (con o sin 0 adelante, con o sin +54). No modifica el
// dato guardado, solo arma el link para abrir la conversación.
export function linkWhatsApp(celular, mensaje) {
  if (!celular) return null;
  let digitos = celular.replace(/\D/g, "");
  if (!digitos) return null;

  digitos = digitos.replace(/^0/, "");
  if (digitos.startsWith("54")) {
    if (digitos[2] !== "9") digitos = digitos.slice(0, 2) + "9" + digitos.slice(2);
  } else {
    digitos = "549" + digitos;
  }

  // Se usa el link directo de WhatsApp Web (en vez de wa.me) para que abra
  // la conversación de una — wa.me primero muestra una pantalla intermedia
  // preguntando "Abrir WhatsApp" o "Usar WhatsApp Web", y esa pantalla es
  // la que termina abriendo otra pestaña más en vez de ir directo al chat.
  const base = `https://web.whatsapp.com/send?phone=${digitos}`;
  return mensaje ? `${base}&text=${encodeURIComponent(mensaje)}` : base;
}

// Diminutivos comunes en Argentina — para que el mensaje suene como lo
// escribiría una persona, no "Estimado Torres Julián Agustín" como
// quedaría con el nombre completo tal cual está cargado. Es a propósito
// una lista corta y conservadora: si el nombre no está acá, se usa tal
// cual (mejor un nombre de pila sin diminutivo que uno inventado mal).
const DIMINUTIVOS = {
  julian: "Juli",
  juliana: "Juli",
  alejandro: "Ale",
  alejandra: "Ale",
  fernando: "Fer",
  fernanda: "Fer",
  valentina: "Vale",
  valentin: "Valen",
  nicolas: "Nico",
  francisco: "Fran",
  francisca: "Fran",
  guillermo: "Guille",
  guillermina: "Guille",
  sebastian: "Seba",
  ignacio: "Nacho",
  rodrigo: "Rodri",
  santiago: "Santi",
  agustin: "Agus",
  agustina: "Agus",
  gonzalo: "Gonza",
  gabriel: "Gabi",
  gabriela: "Gabi",
  patricia: "Pati",
  cristian: "Cris",
  cristina: "Cris",
  veronica: "Vero",
  monica: "Moni",
  claudia: "Clau",
  natalia: "Nati",
  rocio: "Roci",
  eugenia: "Euge",
  florencia: "Flor",
  lorena: "Lore",
  esteban: "Este",
  manuel: "Manu",
  emanuel: "Manu",
  emmanuel: "Manu",
  maximiliano: "Maxi",
  matias: "Mati",
  martina: "Marti",
  daniela: "Dani",
  daniel: "Dani",
  sofia: "Sofi",
  antonella: "Anto",
  federico: "Fede",
  eduardo: "Edu",
  ramiro: "Rami",
  lucia: "Lu",
  camila: "Cami",
};

function quitarAcentos(texto) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// El campo "apellido y nombre" no tiene un formato único: a veces es
// "Apellido, Nombre" y a veces "Apellido Nombre" sin coma — se intenta
// sacar el primer nombre de pila en los dos casos, y si no se puede
// distinguir (una sola palabra) se usa esa palabra tal cual.
export function nombreCercano(nombreCompleto) {
  if (!nombreCompleto) return "";
  const limpio = nombreCompleto.trim();

  let primerNombre;
  if (limpio.includes(",")) {
    primerNombre = limpio.split(",")[1]?.trim().split(/\s+/)[0];
  } else {
    const partes = limpio.split(/\s+/);
    primerNombre = partes.length >= 2 ? partes[1] : partes[0];
  }
  if (!primerNombre) return limpio;

  const clave = quitarAcentos(primerNombre).toLowerCase();
  return DIMINUTIVOS[clave] || primerNombre;
}

// Mensaje sugerido para el seguimiento de un presupuesto sin respuesta —
// el secretario lo puede editar en WhatsApp antes de mandarlo, esto solo
// deja el borrador listo para no tener que escribirlo de cero cada vez.
export function mensajeSeguimientoPresupuesto(nombrePaciente) {
  const nombre = nombreCercano(nombrePaciente);
  return `¡Hola ${nombre}! Te escribimos desde Clínica Dental Marianela Ramírez. Vimos que tenés un presupuesto armado con nosotros y queríamos saber si te quedó alguna duda o si querés que coordinemos un turno para arrancar. ¡Quedamos a tu disposición!`;
}
