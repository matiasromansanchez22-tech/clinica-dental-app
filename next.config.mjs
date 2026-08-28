/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["pdfjs-dist"],
  outputFileTracingIncludes: {
    "/api/asor/parsear-pdf": ["./node_modules/pdfjs-dist/**/*"],
  },
};

export default nextConfig;
