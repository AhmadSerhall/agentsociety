import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    VITE_QWEN_API_KEY: process.env.VITE_QWEN_API_KEY,
    VITE_QWEN_BASE_URL: process.env.VITE_QWEN_BASE_URL,
    VITE_QWEN_MODEL: process.env.VITE_QWEN_MODEL,
  },
  /* config options here */
  reactStrictMode: false,
};

export default nextConfig;
