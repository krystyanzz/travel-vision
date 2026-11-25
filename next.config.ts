import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // permite um segundo servidor (ex.: testes visuais) sem disputar a pasta .next
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  images: { formats: ["image/avif", "image/webp"] },
  async redirects() {
    return [
      { source: "/mapa", destination: "/explorar", permanent: true },
      { source: "/robos", destination: "/admin/robos", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
