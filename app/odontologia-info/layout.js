// Datos para cuando el link se comparte (por ejemplo por WhatsApp): título, descripción e imagen de la tarjeta de vista previa.
const URL_BASE = "https://clinica-dental-app-gamma.vercel.app";
const TITULO = "Odontología en Rosario | Clínica Dental Marianela Ramírez";
const DESCRIPCION = "Pedí tu turno de odontología online: elegí para qué es tu consulta y el día y horario que mejor te quede.";
const IMAGEN = "/brand/og-general.jpg";

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
    images: [{ url: IMAGEN, secureUrl: `${URL_BASE}${IMAGEN}`, type: "image/jpeg", width: 1200, height: 630, alt: "Odontología · Clínica Dental Marianela Ramírez" }],
  },
  twitter: { card: "summary_large_image", title: TITULO, description: DESCRIPCION, images: [IMAGEN] },
};

export default function LayoutOdontologiaInfo({ children }) {
  return children;
}
