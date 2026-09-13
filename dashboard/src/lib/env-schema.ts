import { z } from "zod";

/*
 * Schéma des variables d'environnement : PUR (aucun accès à process.env ici),
 * donc testable. src/lib/env.ts l'applique au vrai process.env, côté serveur.
 *
 * Union discriminée sur DATA_SOURCE : en "mock", DATABASE_URL n'est pas requise ;
 * en "db" (piste B), elle l'est et doit être une URL postgres. Une variable
 * absente ou invalide fait échouer le démarrage, pas la première requête.
 *
 * A7 : compte d'amorçage (le seul compte tant que les utilisateurs ne viennent
 * pas d'une base, question Q5). Le mot de passe n'est jamais journalisé : zod ne
 * met pas la valeur d'entrée dans ses issues.
 *
 * Gardes de production (audit du 2026-09-14, productionProblems) : avec NODE_ENV=production,
 * AUTH_URL est obligatoire (Auth.js en fait l'origine canonique au lieu de
 * croire l'en-tête Host), les fixtures sont
 * refusées sauf ALLOW_MOCK_IN_PRODUCTION=1 (démo assumée), et le compte
 * d'amorçage est refusé sauf AUTH_ALLOW_BOOTSTRAP=1, à retirer dès que les
 * comptes viendront d'une base (B2).
 */
const flag = z.literal("1").optional();

const commonFields = {
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  AUTH_URL: z.url().optional(),
  AUTH_ALLOW_BOOTSTRAP: flag,
  ALLOW_MOCK_IN_PRODUCTION: flag,
  AUTH_SECRET: z.string().min(32),
  AUTH_BOOTSTRAP_EMAIL: z.email(),
  AUTH_BOOTSTRAP_PASSWORD: z.string().min(12),
  AUTH_BOOTSTRAP_NAME: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .default("Administrateur"),
};

export const envSchema = z.discriminatedUnion("DATA_SOURCE", [
  z.object({ DATA_SOURCE: z.literal("mock"), ...commonFields }),
  z.object({
    DATA_SOURCE: z.literal("db"),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    ...commonFields,
  }),
]);

export type Env = z.infer<typeof envSchema>;

/** Problèmes d'un environnement de PRODUCTION (liste vide = rien à signaler). */
export function productionProblems(env: Env): string[] {
  const problems: string[] = [];
  if (!env.AUTH_URL) {
    problems.push(
      "AUTH_URL est obligatoire en production (l'hôte n'est plus deviné).",
    );
  }
  if (env.DATA_SOURCE === "mock" && env.ALLOW_MOCK_IN_PRODUCTION !== "1") {
    problems.push(
      "DATA_SOURCE=mock en production : fixtures refusées (ALLOW_MOCK_IN_PRODUCTION=1 pour une démo assumée).",
    );
  }
  if (env.AUTH_ALLOW_BOOTSTRAP !== "1") {
    problems.push(
      "Compte d'amorçage refusé en production tant que les comptes ne viennent pas d'une base (B2) ; AUTH_ALLOW_BOOTSTRAP=1 pour l'autoriser explicitement.",
    );
  }
  return problems;
}

/**
 * Valide l'environnement. Les gardes de production s'appliquent quand
 * NODE_ENV=production, sauf demande contraire : `next build` tourne aussi en
 * production mais ne sert personne, src/lib/env.ts l'en dispense.
 */
export function parseEnv(
  raw: Record<string, string | undefined>,
  options: { enforceProduction?: boolean } = {},
): Env {
  const env = envSchema.parse(raw);
  const enforce = options.enforceProduction ?? env.NODE_ENV === "production";
  if (enforce) {
    const problems = productionProblems(env);
    if (problems.length > 0) {
      throw new Error(
        `Environnement de production refusé :\n- ${problems.join("\n- ")}`,
      );
    }
  }
  return env;
}
