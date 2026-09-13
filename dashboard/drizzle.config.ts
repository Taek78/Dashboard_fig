import { defineConfig } from "drizzle-kit";

/*
 * Config lue par `npx drizzle-kit generate|migrate|studio`.
 * Le schéma vit dans src/db/schema.ts, les migrations SQL dans ./drizzle.
 * DATABASE_URL vient de .env.local (voir .env.example). Ce fichier tourne hors
 * Next (pas d'alias @/), d'où la lecture directe de process.env avec un message
 * clair plutôt qu'un `!` qui masquerait une variable absente.
 */
const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    "DATABASE_URL manquante : drizzle-kit ne peut pas se connecter.",
  );
}
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url,
  },
});
