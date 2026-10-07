import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.DESKTOP_VISUAL_DIST_DIR ? { distDir: process.env.DESKTOP_VISUAL_DIST_DIR } : {}),
  output: "standalone",
  outputFileTracingExcludes: { "/*": ["./.local-backups/**/*"] },
  allowedDevOrigins: ["192.168.2.76", "192.168.178.59"],
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb"
    }
  }
};

export default nextConfig;
