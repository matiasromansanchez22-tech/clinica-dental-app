import localFont from "next/font/local";
import { Baloo_2 } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";

// Tipografía de marca real de la clínica (JUST Sans®, Jacob Cass — pesos
// Regular y Extra Bold liberados gratis bajo licencia CC BY-ND, archivos
// en app/fonts/ junto con la licencia). La principal de la identidad
// ("Ordinary Boys") es de uso personal solamente, así que para los
// títulos se usa Baloo 2 — una tipografía cálida y redondeada de espíritu
// parecido, gratuita para uso comercial — hasta que la clínica consiga la
// licencia comercial de la original.
const justSans = localFont({
  variable: "--font-body",
  src: [
    { path: "./fonts/JustSans-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/JustSans-ExtraBold.woff2", weight: "800", style: "normal" },
  ],
});

const baloo2 = Baloo_2({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

export const metadata = {
  title: "Clínica Dental Marianela Ramírez",
  description: "Sistema de gestión de la Clínica Dental Marianela Ramírez",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="es"
      className={`${baloo2.variable} ${justSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
