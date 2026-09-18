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
export const MAIL_TRANSPORTS = ["brevo", "fichier"] as const;
export type MailTransport = (typeof MAIL_TRANSPORTS)[number];

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  AUTH_URL: z.url().optional(),
  AUTH_SECRET: z.string().min(32),
  /*
   * Envoi des mails (récupération de compte, invitations, alertes) :
   * `brevo` par l'API HTTP de Brevo (clé et adresse d'expédition validée chez
   * Brevo), `fichier` écrit chaque mail dans un dossier (développement, suite
   * navigateur). Absent : brevo si une clé est posée, sinon fichier.
   */
  MAIL_TRANSPORT: z.enum(MAIL_TRANSPORTS).optional(),
  MAIL_API_KEY: z.string().min(1).optional(),
  MAIL_FROM: z.email().optional(),
  MAIL_FROM_NAME: z.string().min(1).max(80).optional(),
  MAIL_FILE_DIR: z.string().min(1).optional(),
  /** "0" désactive la vérification des mots de passe contre les fuites (Have I Been Pwned). */
  PASSWORD_BREACH_CHECK: z.enum(["0", "1"]).optional(),
  /**
   * Jeton attendu par la route de santé /api/health (en-tête
   * « Authorization: Bearer … », 16 caractères au moins). Sans lui, la route
   * est publique et chaque appel sonde la base : facultatif en développement
   * et dans les tests, OBLIGATOIRE en production (productionProblems), à
   * fournir au système de supervision.
   */
  HEALTH_TOKEN: z.string().min(16).optional(),
  /**
   * API de l'application FIG (/api/v1) : clé du SERVEUR de l'application
   * (32 caractères au moins), pour la file des notifications ; sans elle, les
   * routes de service répondent 503. Facultative : les routes des clients
   * (code par mail, jetons de session) n'en dépendent pas.
   */
  API_SERVICE_KEY: z.string().min(32).optional(),
  /**
   * Origines autorisées à appeler l'API depuis un navigateur (CORS), séparées
   * par des virgules, ex. « https://app.fig.example,http://localhost:5173 ».
   * Sans elle, aucun en-tête CORS : une application native n'en a pas besoin.
   */
  API_CORS_ORIGINS: z
    .string()
    .transform((v) =>
      v
        .split(",")
        .map((origin) => origin.trim())
        .filter((origin) => origin !== ""),
    )
    .pipe(z.array(z.url()))
    .optional(),
});

export type Env = z.infer<typeof envSchema>;

/** Transport de mail effectif : explicite, sinon brevo dès qu'une clé est posée, sinon fichier. */
export function mailTransportOf(env: Env): MailTransport {
  return env.MAIL_TRANSPORT ?? (env.MAIL_API_KEY ? "brevo" : "fichier");
}

/** Problèmes d'un environnement de PRODUCTION (liste vide = rien à signaler). */
export function productionProblems(env: Env): string[] {
  const problems: string[] = [];
  if (!env.AUTH_URL) {
    problems.push(
      "AUTH_URL est obligatoire en production (l'hôte n'est plus deviné).",
    );
  }
  if (!env.HEALTH_TOKEN) {
    problems.push(
      "HEALTH_TOKEN est obligatoire en production (16 caractères au moins) : la route de santé /api/health ne doit pas être publique ; fournir ce jeton au système de supervision.",
    );
  }
  if (!env.MAIL_TRANSPORT) {
    problems.push(
      "MAIL_TRANSPORT est obligatoire en production : brevo (avec MAIL_API_KEY et MAIL_FROM), ou fichier pour un serveur de test qui n'envoie rien.",
    );
  } else if (env.MAIL_TRANSPORT === "brevo") {
    if (!env.MAIL_API_KEY) {
      problems.push("MAIL_API_KEY est obligatoire avec MAIL_TRANSPORT=brevo.");
    }
    if (!env.MAIL_FROM) {
      problems.push(
        "MAIL_FROM est obligatoire avec MAIL_TRANSPORT=brevo (adresse validée chez Brevo).",
      );
    }
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
