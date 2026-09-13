/*
 * Exécuté une fois au démarrage du serveur Next (dev et start), avant la première
 * requête. Valide l'environnement tout de suite : une variable manquante fait
 * échouer le démarrage plutôt que le premier clic d'un collègue (spec B1).
 * Le `runtime` est vérifié car register() est aussi appelé pour le runtime edge.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getEnv } = await import("@/lib/env");
    const env = getEnv();
    console.info(`[env] DATA_SOURCE=${env.DATA_SOURCE}`);
  }
}
