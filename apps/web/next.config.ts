import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The workspace packages ship TypeScript source, not built output.
  transpilePackages: ["@flow/lang", "@flow/layout"],
};

export default nextConfig;
