import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    // math.test.ts is a node:test file (MASTER). Vitest treats it as an empty suite.
    exclude: ["src/math.test.ts"],
  },
});
