import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
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
]);
