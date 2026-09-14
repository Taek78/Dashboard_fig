/*
 * Rôles du back-office et règles d'autorisation pures.
 *
 * Pourquoi un domaine auth séparé des commandes : les rôles sont consultés par
 * toutes les Server Actions (commandes, catalogue, clients, articles) et, depuis
 * l'audit du 2026-09-14, par le proxy pour la LECTURE des sections. Les règles
 * `canXxx(role)` sont pures et testées ici ; les actions les appellent après
 * avoir relu la session côté serveur, jamais en faisant confiance au client.
 *
 * Vocabulaire provisoire (question Q5 au client) : « livreur » est ajouté comme
 * cas concret d'un rôle qui ne doit voir ni le chiffre d'affaires, ni les
 * clients, ni le catalogue.
 */
export const ROLES = ["admin", "gestionnaire", "lecture", "livreur"] as const;
export type Role = (typeof ROLES)[number];

/** Libellés français des rôles, pour la sidebar et le bandeau. */
export const ROLE_LABELS: Record<Role, string> = {
  admin: "Administrateur",
  gestionnaire: "Gestionnaire",
  lecture: "Lecture seule",
  livreur: "Livreur",
};

/* ---------- Écriture : une règle par action métier ---------- */

const WRITERS: readonly Role[] = ["admin", "gestionnaire"];

/** Changer le statut d'une commande (A2) : l'équipe, et le livreur en tournée. */
export function canChangeOrderStatus(role: Role): boolean {
  return WRITERS.includes(role) || role === "livreur";
}

/** Modifier prix, disponibilité et stock du catalogue (A4). */
export function canEditProduct(role: Role): boolean {
  return WRITERS.includes(role);
}

/** Rédiger, modifier, masquer ou supprimer un article « à lire » (2026-09-13). */
export function canEditArticle(role: Role): boolean {
  return WRITERS.includes(role);
}

/** Créer, modifier, désactiver un compte, réinitialiser un mot de passe (2026-09-14). */
export function canManageUsers(role: Role): boolean {
  return role === "admin";
}

/** Ajouter une note interne sur un client (A5). */
export function canAddCustomerNote(role: Role): boolean {
  return WRITERS.includes(role);
}

/* ---------- Lecture : quelles sections chaque rôle peut ouvrir ---------- */

/** Les sections du back-office, par préfixe d'URL (la racine n'est que "/"). */
export const SECTIONS = [
  "/",
  "/commandes",
  "/livraisons",
  "/catalogue",
  "/articles",
  "/clients",
  "/metriques",
  "/comptes",
  "/profil",
] as const;
export type Section = (typeof SECTIONS)[number];

const TEAM_SECTIONS: readonly Section[] = SECTIONS.filter(
  (s) => s !== "/comptes",
);

/**
 * Matrice de lecture : la première section est la page d'accueil du rôle.
 * /comptes (gestion des comptes) est réservé à l'administrateur ; /profil
 * (son propre mot de passe) est ouvert à tous.
 */
export const SECTION_ACCESS: Record<Role, readonly Section[]> = {
  admin: SECTIONS,
  gestionnaire: TEAM_SECTIONS,
  lecture: TEAM_SECTIONS,
  livreur: ["/livraisons", "/commandes", "/profil"],
};

/** Section d'un chemin : "/commandes/cmd-1" → "/commandes" ; inconnu → null. */
export function sectionOf(pathname: string): Section | null {
  if (pathname === "/") return "/";
  return (
    SECTIONS.find(
      (s) => s !== "/" && (pathname === s || pathname.startsWith(`${s}/`)),
    ) ?? null
  );
}

/** Un chemin hors section (404, API) est laissé au reste de l'application. */
export function canViewSection(role: Role, pathname: string): boolean {
  const section = sectionOf(pathname);
  return section === null || SECTION_ACCESS[role].includes(section);
}

/** Où envoyer un rôle qui ouvre une section interdite. */
export function homeFor(role: Role): Section {
  return SECTION_ACCESS[role][0] ?? "/";
}
