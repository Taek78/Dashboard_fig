/*
 * Garde d'hôte des scripts qui ÉCRIVENT dans une base (seed, restauration,
 * purge RGPD, préparation de la base de test) : règle pure, partagée, testée.
 * Un script destructeur ne vise qu'une base locale, sauf décision explicite
 * par une variable d'environnement (SEED_ALLOW_REMOTE=1, RGPD_ALLOW_REMOTE=1).
 * Attention : « localhost » peut être un tunnel vers la production ; le script
 * affiche l'hôte, à lire avant d'écrire.
 */
export const LOCAL_DATABASE_HOSTS = ["localhost", "127.0.0.1", "::1"] as const;

/** Hôte d'une URL de base ; une adresse IPv6 arrive entre crochets dans URL.hostname. */
export function databaseHost(url: string): string {
  return new URL(url).hostname.replace(/^\[|\]$/g, "");
}

export function isLocalDatabase(url: string): boolean {
  return (LOCAL_DATABASE_HOSTS as readonly string[]).includes(
    databaseHost(url),
  );
}

/**
 * Message d'erreur si `url` ne vise pas une base locale et que la variable
 * `allowVar` ne vaut pas « 1 » dans `env` ; null si l'écriture est permise.
 */
export function remoteDatabaseProblem(
  url: string,
  allowVar: string,
  env: Readonly<Record<string, string | undefined>>,
  purpose: string,
): string | null {
  if (isLocalDatabase(url) || env[allowVar] === "1") return null;
  return `Hôte ${databaseHost(url)} refusé : ${purpose} ne vise qu'une base locale (${allowVar}=1 pour forcer).`;
}
