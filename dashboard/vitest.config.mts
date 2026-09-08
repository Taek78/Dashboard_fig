import path from "node:path";
import { defineConfig } from "vitest/config";

/*
 * Tous les tests vivent dans test/, en miroir de src/ (test/domain/orders/rules.test.ts
 * teste src/domain/orders/rules.ts). Vitest ne lit pas le tsconfig : l'alias `@/`
 * est redéclaré ici, sinon les imports `@/domain/...` ne résolvent pas.
 */
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
});
