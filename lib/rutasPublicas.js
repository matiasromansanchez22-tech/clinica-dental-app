// Páginas que se abren SIN iniciar sesión y sin el menú del sistema: el login y las páginas públicas para pacientes
// (el plan de referidos y la página de consultas de ortodoncia, cada una con su cartel para imprimir).
const RUTAS_PUBLICAS = ["/login", "/referidos", "/referidos/cartel", "/ortodoncia-info", "/ortodoncia-info/cartel"];

export const esRutaPublica = (pathname) => RUTAS_PUBLICAS.includes(pathname);
