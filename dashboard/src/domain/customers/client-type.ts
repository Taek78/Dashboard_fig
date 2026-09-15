import type { CommunityRef } from "@/domain/communities/types";

/*
 * Type de client d'une commande ou d'une fiche : particulier (commande pour
 * soi, livrée à son adresse) ou communauté (membre d'un groupe, retrait au
 * point de la communauté). Déduit de la communauté portée, jamais stocké.
 */
export const CLIENT_TYPES = ["particulier", "communaute"] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];

export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  particulier: "Particulier",
  communaute: "Communauté",
};

export function clientTypeOf(community: CommunityRef | null): ClientType {
  return community === null ? "particulier" : "communaute";
}
