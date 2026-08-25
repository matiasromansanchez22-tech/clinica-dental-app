export function calcularEdad(fechaNacimientoISO) {
  if (!fechaNacimientoISO) return null;
  const [anio, mes, dia] = fechaNacimientoISO.split("-").map(Number);
  const nacimiento = new Date(anio, mes - 1, dia);
  const hoy = new Date();

  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const diferenciaMes = hoy.getMonth() - nacimiento.getMonth();
  if (diferenciaMes < 0 || (diferenciaMes === 0 && hoy.getDate() < nacimiento.getDate())) {
    edad--;
  }
  return Math.max(edad, 0);
}

export function formatearDni(valor) {
  const digitos = String(valor || "").replace(/\D/g, "");
  return digitos ? digitos.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "";
}
