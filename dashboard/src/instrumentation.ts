/*
 * Exécuté une fois au démarrage du serveur Next (dev et start), avant la première
 * requête. Valide l'environnement tout de suite : une variable manquante (base,
 * secret) fait échouer le démarrage plutôt que le premier clic d'un collègue.
 * Le `runtime` est vérifié car register() est aussi appelé pour le runtime edge.
 * Lance ensuite le balayage périodique des invitations expirées (un mail à la
 * personne et aux administrateurs au bout des 48 h), jamais pendant un build.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getEnv } = await import("@/lib/env");
    getEnv();
    console.info("[env] environnement valide, base PostgreSQL configurée");
    if (process.env.NEXT_PHASE !== "phase-production-build") {
      const { startInvitationExpiryTimer } =
        await import("@/data/invitation-expiry");
      startInvitationExpiryTimer();
    }
  }
}
