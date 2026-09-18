/*
 * Réseaux sociaux au pied du menu (demande du 2026-09-18 : Facebook et
 * Instagram seulement). Jamais de lien mort : chaque icône mène au moins à la
 * page d'accueil du réseau (SOCIAL_HOMES). Quand le client donnera les pages
 * de FIG, il suffira de les écrire dans SOCIAL_LINKS : une adresse en https
 * y remplace la page d'accueil, toute autre valeur y revient.
 */
export const SOCIAL_NETWORKS = ["facebook", "instagram"] as const;
export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

/** Pages d'accueil des réseaux : la destination tant que celles de FIG ne sont pas connues. */
export const SOCIAL_HOMES: Record<SocialNetwork, string> = {
  facebook: "https://www.facebook.com/",
  instagram: "https://www.instagram.com/",
};

/** Pages de FIG, à renseigner (sinon la page d'accueil du réseau). */
export const SOCIAL_LINKS: Record<SocialNetwork, string> = { ...SOCIAL_HOMES };

export const SOCIAL_LABELS: Record<SocialNetwork, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
};

/** L'adresse d'un réseau : celle renseignée si elle est en https, sinon sa page d'accueil. */
export function socialHref(
  network: SocialNetwork,
  links: Record<SocialNetwork, string> = SOCIAL_LINKS,
): string {
  const url = links[network].trim();
  return /^https:\/\/\S+$/.test(url) ? url : SOCIAL_HOMES[network];
}

/**
 * Nom accessible du lien : il ne promet la page de FIG que si l'adresse n'est
 * pas la simple page d'accueil du réseau.
 */
export function socialLinkLabel(
  network: SocialNetwork,
  links: Record<SocialNetwork, string> = SOCIAL_LINKS,
): string {
  const label = SOCIAL_LABELS[network];
  const fig = socialHref(network, links) !== SOCIAL_HOMES[network];
  return `${fig ? `FIG sur ${label}` : label} (nouvel onglet)`;
}
