export default function manifest() {
  return {
    name: "Clínica Dental Marianela Ramírez",
    short_name: "Clínica Dental",
    description: "Sistema de gestión de la Clínica Dental Marianela Ramírez",
    start_url: "/",
    display: "standalone",
    background_color: "#fffbf5",
    theme_color: "#6d3c1b",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
