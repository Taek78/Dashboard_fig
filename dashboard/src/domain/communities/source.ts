import type { Community } from "@/domain/communities/types";

/*
 * CONTRAT des communautés, implémenté par PostgreSQL (src/data/communities.db.ts). Lecture seule : l'application FIG crée les
 * communautés et y rattache les clients ; le back-office les consulte
 * (docs/backlog.md, question 15). getMemberCounts : le nombre de membres de
 * chaque communauté (le taux de remise s'en déduit), pour l'API.
 */
export type CommunitiesSource = {
  listCommunities(): Promise<Community[]>;
  getCommunity(id: string): Promise<Community | null>;
  getMemberCounts(): Promise<ReadonlyMap<string, number>>;
};
