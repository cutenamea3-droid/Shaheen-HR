import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Portal-only suites for retired Personal / Dispatch UIs.
    // Mixed coerce-guard tests that still import unwired source may remain.
    exclude: [
      "node_modules/**",
      "dist/**",
      "src/personal/**",
      "src/dispatch/**",
      "src/test/personal-*.test.ts",
      "src/test/hr-personal*.test.ts",
      "src/test/dispatch-*.test.ts",
      "src/test/portal-account-display-guards.test.ts",
    ],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
