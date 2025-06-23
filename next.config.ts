import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    // 在 build 阶段忽略所有 ESLint 错误
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
