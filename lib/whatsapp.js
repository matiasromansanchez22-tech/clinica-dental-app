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

  const base = `https://wa.me/${digitos}`;
  return mensaje ? `${base}?text=${encodeURIComponent(mensaje)}` : base;
}
