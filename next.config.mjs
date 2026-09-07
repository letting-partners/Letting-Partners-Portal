import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import("next").NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  serverExternalPackages: ["postgres", "@electric-sql/pglite"],
  experimental: {
    // Enables forbidden() and unauthorized(), so a permission denial renders a
    // real 403/401 page instead of surfacing as a server error.
    authInterrupts: true,
  },
  turbopack: { root: projectRoot },
  productionBrowserSourceMaps: false,
};

export default nextConfig;
