import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export served by the Cloudflare Worker in ./worker (which also gates pages and hosts the rooms).
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
