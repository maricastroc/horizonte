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

const CORPUS = "src/**/*.corpus.test.ts";

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [glsl()],
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
          exclude: [CORPUS],
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
      {
        resolve: { alias },
        test: {
          name: "corpus",
          environment: "node",
          include: [CORPUS],
          fileParallelism: false,
        },
      },
    ],
  },
});
