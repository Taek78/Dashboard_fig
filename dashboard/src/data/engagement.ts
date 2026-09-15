import "server-only";
import { engagementDb } from "@/data/engagement.db";
import type { EngagementSource } from "@/domain/engagement/source";

/*
 * FAÇADE des statistiques d'usage : le seul module que le front (pages, Server Actions) importe.
 * L'implémentation est PostgreSQL (engagement.db.ts) ; la façade fixe le contrat
 * EngagementSource et `server-only` (un composant client qui l'importerait casse le build).
 */
export const { getEngagement }: EngagementSource = engagementDb;
