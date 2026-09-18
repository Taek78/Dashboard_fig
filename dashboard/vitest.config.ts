import path from "node:path";
import { defineConfig } from "vitest/config";

/*
 * Tous les tests vivent dans test/, en miroir de src/ (test/domain/orders/rules.test.ts
 * teste src/domain/orders/rules.ts). Vitest ne lit pas le tsconfig : l'alias `@/`
 * est redéclaré ici, sinon les imports `@/domain/...` ne résolvent pas.
 *
 * Deux projets :
 * - unit : règles pures, utilitaires, schéma et mappers, façades et route santé
 *   simulées ; aucune base, en parallèle.
 * - db : couche données, Server Actions et routes de l'API (test/app/api/v1)
 *   contre la base de TEST PostgreSQL
 *   (`docker compose up -d --wait test-db`), migrée et seedée une fois par
 *   test/support/global-setup.ts ; un fichier à la fois, chaque test dans une
 *   transaction annulée (test/support/test-database.ts).
 */
const alias = { "@": path.resolve(import.meta.dirname, "src") };

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          include: [
            "test/domain/**/*.test.ts",
            "test/lib/**/*.test.ts",
            "test/db/**/*.test.ts",
            "test/app/facades.test.ts",
            "test/app/api/health.test.ts",
          ],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "db",
          include: ["test/app/**/*.test.ts", "test/data/**/*.test.ts"],
          exclude: [
            "**/node_modules/**",
            "test/app/facades.test.ts",
            "test/app/api/health.test.ts",
          ],
          globalSetup: ["test/support/global-setup.ts"],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
