/*
 * Type de client (décision du client, 2026-09-16) : une PERSONNE est toujours
 * un particulier, qu'elle soit membre d'une communauté ou non ; une communauté
 * est un GROUPE de particuliers, jamais une personne. Être membre d'une
 * communauté s'affiche à part, par un badge « Communauté » à côté de
 * « Particulier » (COMMUNITY_MEMBER_LABEL). Rien n'est stocké : l'appartenance
 * se lit dans la communauté portée par le client ou la commande.
 */
export const CLIENT_TYPES = ["particulier", "communaute"] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];

export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  particulier: "Particulier",
  communaute: "Communauté",
};

/** Libellé du badge d'appartenance d'une personne à une communauté. */
export const COMMUNITY_MEMBER_LABEL = "Communauté";
