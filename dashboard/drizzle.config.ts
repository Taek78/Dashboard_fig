import { defineConfig } from "drizzle-kit";

/*
 * Config lue par `npx drizzle-kit generate|migrate|studio`.
 * Le schéma vit dans src/db/schema.ts, les migrations SQL dans ./drizzle.
 * DATABASE_URL vient de .env.local (voir .env.example).
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
