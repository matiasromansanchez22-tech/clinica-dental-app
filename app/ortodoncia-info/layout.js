// Datos para cuando el link se comparte (por ejemplo por WhatsApp): título, descripción y la imagen que aparecen en la tarjeta
// de vista previa, y el título de la pestaña del navegador.
const URL_BASE = "https://clinica-dental-app-gamma.vercel.app";
const TITULO = "Ortodoncia en Rosario | Clínica Dental Marianela Ramírez";
const DESCRIPCION = "Mirá cómo es el tratamiento de ortodoncia, cuánto sale y pedí tu turno de consulta por WhatsApp.";

export const metadata = {
  metadataBase: new URL(URL_BASE),
  title: TITULO,
  description: DESCRIPCION,
  openGraph: {
    type: "website",
    locale: "es_AR",
    siteName: "Clínica Dental Marianela Ramírez",
    title: TITULO,
    description: DESCRIPCION,
    url: "/ortodoncia-info",
    images: [{ url: "/brand/og-ortodoncia.png", width: 1200, height: 630, alt: "Ortodoncia · Clínica Dental Marianela Ramírez" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITULO,
    description: DESCRIPCION,
    images: ["/brand/og-ortodoncia.png"],
  },
};

export default function LayoutOrtodonciaInfo({ children }) {
  return children;
}
