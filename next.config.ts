import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow local network access during development
  allowedDevOrigins: [
    'http://192.168.0.101:3000',
    'http://192.168.0.101:3001',
    'http://localhost:3000',
    'http://localhost:3001',
  ],
};

export default nextConfig;
