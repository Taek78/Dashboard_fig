import { z } from "zod";

/*
 * Schéma des variables d'environnement : PUR (aucun accès à process.env ici),
 * donc testable. src/lib/env.ts l'applique au vrai process.env, côté serveur.
 *
 * Le dashboard fonctionne toujours sur PostgreSQL : DATABASE_URL est
 * obligatoire et doit être une URL postgres. Une variable absente ou invalide
 * fait échouer le démarrage, pas la première requête. Les comptes vivent dans
 * la table users : les variables AUTH_BOOTSTRAP_* et AUTH_MANAGER_* ne servent
 * qu'à `npm run db:seed`, l'application ne les lit pas.
 *
 * Garde de production (productionProblems) : avec NODE_ENV=production,
 * AUTH_URL est obligatoire (Auth.js en fait l'origine canonique au lieu de
 * croire l'en-tête Host). Les valeurs ne sont jamais reflétées dans les
 * erreurs : zod ne met pas la valeur d'entrée dans ses issues.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  AUTH_URL: z.url().optional(),
  AUTH_SECRET: z.string().min(32),
});

export type Env = z.infer<typeof envSchema>;

/** Problèmes d'un environnement de PRODUCTION (liste vide = rien à signaler). */
export function productionProblems(env: Env): string[] {
  const problems: string[] = [];
  if (!env.AUTH_URL) {
    problems.push(
      "AUTH_URL est obligatoire en production (l'hôte n'est plus deviné).",
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
