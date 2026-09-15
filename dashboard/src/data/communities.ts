import "server-only";
import { communitiesDb } from "@/data/communities.db";
import type { CommunitiesSource } from "@/domain/communities/source";

/*
 * FAÇADE des communautés (lecture seule) : le seul module que le front (pages, Server Actions) importe.
 * L'implémentation est PostgreSQL (communities.db.ts) ; la façade fixe le contrat
 * CommunitiesSource et `server-only` (un composant client qui l'importerait casse le build).
 */
export const { listCommunities, getCommunity }: CommunitiesSource =
  communitiesDb;
