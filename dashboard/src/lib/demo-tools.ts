import type { Role } from "@/domain/auth/roles";

/*
 * Outils de DÉMONSTRATION (boutons « Simuler une commande / un message » du
 * tableau de bord, demande du 2026-09-18) : JAMAIS en production. Le serveur
 * construit (`next start`, NODE_ENV=production) ne les montre pas ET leurs
 * actions refusent, même appelées à la main. Réservés à qui gère l'équipe
 * (admin, gestionnaire).
 * À RETIRER avant la livraison au client, avec src/components/demo/,
 * src/app/(dashboard)/demo/, src/db/demo.ts et le bloc du tableau de bord
 * (docs/backlog.md).
 */
export function demoToolsEnabled(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  return nodeEnv !== "production";
}

export function canUseDemoTools(
  role: Role,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  return (
    demoToolsEnabled(nodeEnv) && (role === "admin" || role === "gestionnaire")
  );
}
