/*
 * Types de communautés : un groupe de clients qui commandent ensemble et
 * récupèrent leurs produits à un même point, à une heure convenue (une crèche
 * qui propose aux parents de commander, une école, une entreprise). L'enum
 * Postgres community_kind reprend ces clés.
 */
export const COMMUNITY_KINDS = [
  "creche",
  "ecole",
  "entreprise",
  "association",
  "autre",
] as const;
export type CommunityKind = (typeof COMMUNITY_KINDS)[number];

export const COMMUNITY_KIND_LABELS: Record<CommunityKind, string> = {
  creche: "Crèche",
  ecole: "École",
  entreprise: "Entreprise",
  association: "Association",
  autre: "Autre",
};
