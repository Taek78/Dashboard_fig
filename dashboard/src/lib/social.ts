/*
 * Pages de FIG sur les réseaux sociaux, affichées au pied du menu (demande du
 * 2026-09-18 : Facebook et Instagram seulement). Adresses À RENSEIGNER ici
 * quand le client les donne : tant qu'une adresse est vide, son icône reste
 * affichée mais inactive (« bientôt disponible »), jamais un lien vers une
 * page qui ne serait pas celle de FIG.
 */
export const SOCIAL_NETWORKS = ["facebook", "instagram"] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

export const SOCIAL_LINKS: Record<SocialNetwork, string> = {
  facebook: "",
  instagram: "",
};

export const SOCIAL_LABELS: Record<SocialNetwork, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
};

/** L'adresse d'un réseau si elle est renseignée et en https, sinon null. */
export function socialHref(
  network: SocialNetwork,
  links: Record<SocialNetwork, string> = SOCIAL_LINKS,
): string | null {
  const url = links[network].trim();
  return /^https:\/\/\S+$/.test(url) ? url : null;
}
