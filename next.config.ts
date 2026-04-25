import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  devIndicators: {
    appIsrStatus: false,
  },
  // Bu satır senin terminalindeki o uyarıyı susturacak:
  experimental: {
    allowedDevOrigins: ["192.168.1.102", "localhost:3000"]
  }
};

export default nextConfig;