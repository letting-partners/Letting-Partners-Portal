import path from "node:path";

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
    ],
  },
  async redirects() {
    return [
      { source: "/register-as-tenant", destination: "/tenant-services/register-as-tenant", permanent: true },
      { source: "/student-accommodation", destination: "/tenant-services/student-accommodation", permanent: true },
      { source: "/tenant-guide", destination: "/tenant-services/tenant-guide", permanent: true },
      { source: "/find-a-tenant", destination: "/landlord-services/find-a-tenant", permanent: true },
      { source: "/property-management", destination: "/landlord-services/property-management", permanent: true },
      { source: "/landlord-guide", destination: "/landlord-services/landlord-guide", permanent: true },
    ];
  },
  webpack(config) {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "@": path.resolve(process.cwd()),
    };
    return config;
  },
};

export default nextConfig;
