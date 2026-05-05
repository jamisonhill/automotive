import type { NextConfig } from "next";

// Standalone output produces a minimal node_modules tree for the Docker runtime image.
// Keeps the container small and lets us avoid copying the whole repo into prod.
const nextConfig: NextConfig = {
  output: "standalone",
  // Allow the iPhone (and other LAN devices) to load Next.js dev resources
  // like the HMR client and client-component JS bundles. Without this,
  // Next 16 blocks the requests as cross-origin and the page renders
  // server HTML but never hydrates — meaning useEffect/onChange never run.
  // Dev-only setting; production is unaffected.
  allowedDevOrigins: ["192.168.0.16"],
  // Allow the OCR endpoint to receive larger image payloads from iPhone camera shots.
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
