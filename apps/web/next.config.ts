import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "bcryptjs"],
  /*
   * No dev-tools badge. It floats in the bottom-left corner, which is where
   * the rail's own account row sits, and this is a product people are shown
   * as much as they use — a Next.js mark on top of the client's is the wrong
   * thing to be explaining.
   */
  devIndicators: false,
  // The design system ships as TypeScript source, so Next compiles it here.
  transpilePackages: ["@tpm/ui"],
  outputFileTracingRoot: path.join(import.meta.dirname, "../../"),
};

export default nextConfig;
