export default function manifest() {
  return {
    name: "Clínica Dental Marianela Ramírez",
    short_name: "Clínica Dental",
    description: "Sistema de gestión de la Clínica Dental Marianela Ramírez",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#111827",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
