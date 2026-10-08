import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true }, // linting is oxlint: npm run lint
};

export default nextConfig;
