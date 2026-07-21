import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "lang",
          root: "./packages/lang",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "layout",
          root: "./packages/layout",
          environment: "node",
          include: ["src/**/*.test.ts"],
        },
      },
    ],
  },
});
