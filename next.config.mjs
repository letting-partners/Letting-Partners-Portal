import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/**
 * Uploaded photos are served from whatever host S3_PUBLIC_BASE_URL points at -
 * an R2 custom domain, or the bucket's public development URL. Deriving the
 * pattern from that variable means the image optimiser keeps working when the
 * bucket moves behind a custom domain, without a second setting to remember.
 */
function storageHostPattern() {
  const base = process.env.S3_PUBLIC_BASE_URL;
  if (!base) return [];
  try {
    const { protocol, hostname } = new URL(base);
    return [{ protocol: protocol.replace(":", ""), hostname }];
  } catch {
    return [];
  }
}

/** @type {import("next").NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      ...storageHostPattern(),
      // R2 public development URLs, for before a custom domain is attached.
      { protocol: "https", hostname: "*.r2.dev" },
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
