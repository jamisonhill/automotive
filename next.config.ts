import type { NextConfig } from "next";

// Standalone output produces a minimal node_modules tree for the Docker runtime image.
// Keeps the container small and lets us avoid copying the whole repo into prod.
const nextConfig: NextConfig = {
  output: "standalone",
  // Allow the OCR endpoint to receive larger image payloads from iPhone camera shots.
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
