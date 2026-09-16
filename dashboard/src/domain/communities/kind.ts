/*
 * Types de communautés (décision du client, 2026-09-16) : un groupe de clients
 * qui commandent ensemble et récupèrent leurs produits à un même point, à
 * l'heure choisie par chacun. Voisinage (des voisins, une résidence),
 * entreprise (des collègues), point relais (un commerce ou un lieu qui reçoit
 * les commandes). L'enum Postgres community_kind reprend ces clés (migration
 * 0011, qui a remplacé crèche, école, association et autre).
 */
export const COMMUNITY_KINDS = [
  "voisinage",
  "entreprise",
  "point_relais",
] as const;
export type CommunityKind = (typeof COMMUNITY_KINDS)[number];

export const COMMUNITY_KIND_LABELS: Record<CommunityKind, string> = {
  voisinage: "Voisinage",
  entreprise: "Entreprise",
  point_relais: "Point relais",
};

/*
 * Visibilité d'une communauté pour les clients, posée par l'application FIG :
 * « public », on l'intègre directement ; « privé », on y entre sur invitation
 * uniquement. Toujours l'une ou l'autre, jamais vide : l'enum Postgres
 * community_visibility est NOT NULL sans valeur par défaut, comme community_kind.
 * Le dashboard l'affiche seulement.
 */
export const COMMUNITY_VISIBILITIES = ["public", "private"] as const;
export type CommunityVisibility = (typeof COMMUNITY_VISIBILITIES)[number];

export const COMMUNITY_VISIBILITY_LABELS: Record<CommunityVisibility, string> =
  {
    public: "Public",
    private: "Privé",
  };
