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
