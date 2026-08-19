import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vitest/config";

const glsl = (): Plugin => ({
  name: "horizonte-glsl",
  transform(code, id) {
    if (!id.endsWith(".glsl")) return null;
    return { code: `export default ${JSON.stringify(code)};`, map: null };
  },
});

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

export default defineConfig({
  resolve: { alias },
  plugins: [glsl()],
  test: {
    projects: [
      {
        plugins: [glsl()],
        resolve: { alias },
        test: {
          name: "unidade",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        plugins: [glsl(), react()],
        resolve: { alias },
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["src/**/*.test.tsx"],
        },
      },
    ],
  },
});
