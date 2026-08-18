import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(import.meta.dirname),
    rules: {
      "*.glsl": { loaders: ["raw-loader"], as: "*.js" },
    },
  },
};

export default nextConfig;
