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
 */
const authFields = {
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
  z.object({ DATA_SOURCE: z.literal("mock"), ...authFields }),
  z.object({
    DATA_SOURCE: z.literal("db"),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    ...authFields,
  }),
]);

export type Env = z.infer<typeof envSchema>;

export function parseEnv(raw: Record<string, string | undefined>): Env {
  return envSchema.parse(raw);
}
