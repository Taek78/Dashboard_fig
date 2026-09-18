/*
 * Rôles du back-office et règles d'autorisation pures.
 *
 * Les rôles sont consultés par toutes les Server Actions (écriture) et par le
 * proxy et la navigation (lecture des sections). Les règles `canXxx(role)` sont
 * pures et testées ici ; les actions les appellent après avoir relu la session
 * côté serveur, jamais en faisant confiance au client.
 *
 * Rôles à confirmer avec le client (question 5) : « livreur » est le cas concret
 * d'un rôle qui ne voit ni le chiffre d'affaires ni un montant dépensé, ni le
 * catalogue ; il voit les clients depuis le 2026-09-18 (demande de l'auteur).
 */
import type { AlertScope } from "@/domain/alerts/types";

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

/** Changer le statut d'une commande : l'équipe, et le livreur en tournée. */
export function canChangeOrderStatus(role: Role): boolean {
  return WRITERS.includes(role) || role === "livreur";
}

/** Créer, modifier ou supprimer un produit du catalogue. */
export function canEditProduct(role: Role): boolean {
  return WRITERS.includes(role);
}

/** Rédiger, modifier, masquer ou supprimer un article « à lire ». */
export function canEditArticle(role: Role): boolean {
  return WRITERS.includes(role);
}

/** Créer, modifier, désactiver un compte, réinitialiser un mot de passe. */
export function canManageUsers(role: Role): boolean {
  return role === "admin";
}

/**
 * Lire le journal de sécurité. Administrateur seul : il porte les adresses
 * e-mail et les adresses IP saisies sur les pages publiques, et la trace de ce
 * que chaque membre de l'équipe a fait. Personne ne peut l'écrire ni l'effacer
 * depuis un écran.
 */
export function canReadSecurityLog(role: Role): boolean {
  return role === "admin";
}

/**
 * Traiter une demande RGPD d'un client : exporter toutes ses données (droit
 * d'accès et portabilité) ou les anonymiser (droit à l'effacement).
 * Administrateur seul : une anonymisation est irréversible et un export fait
 * sortir toutes les données d'une personne.
 */
export function canHandlePrivacyRequest(role: Role): boolean {
  return role === "admin";
}

/** Ajouter une note interne sur un client. */
export function canAddCustomerNote(role: Role): boolean {
  return WRITERS.includes(role);
}

/** Créer, modifier ou supprimer une personne de l'équipe (section Personnel). */
export function canManageStaff(role: Role): boolean {
  return WRITERS.includes(role);
}

/** Affecter un préparateur ou un livreur à une commande. */
export function canAssignStaff(role: Role): boolean {
  return WRITERS.includes(role);
}

/**
 * Traiter un message client : changer son statut, l'épingler, le signaler
 * important. Le rôle lecture voit la boîte de réception sans pouvoir y toucher ;
 * le livreur n'y a pas accès du tout (SECTION_ACCESS).
 */
export function canHandleMessages(role: Role): boolean {
  return WRITERS.includes(role);
}

/**
 * Ouvrir une pièce jointe hébergée (photo, PDF) : quiconque lit la boîte de
 * réception (admin, gestionnaire, lecture), jamais le livreur. Même règle que
 * la section, redite ici parce que la route du fichier la vérifie seule.
 */
export function canReadMessageFiles(role: Role): boolean {
  return SECTION_ACCESS[role].includes("/messages");
}

/* ---------- Lecture : quelles sections chaque rôle peut ouvrir ---------- */

/**
 * Alertes en direct : un rôle n'est averti que de ce qu'il peut ouvrir
 * (commandes, messages, catalogue pour le stock). Le livreur n'entend donc
 * que les nouvelles commandes.
 */
export function alertScopeFor(role: Role): AlertScope {
  const sections = SECTION_ACCESS[role];
  return {
    orders: sections.includes("/commandes"),
    messages: sections.includes("/messages"),
    stock: sections.includes("/catalogue"),
  };
}

/** Les sections du back-office, par préfixe d'URL (la racine n'est que "/"). */
export const SECTIONS = [
  "/",
  "/commandes",
  "/catalogue",
  "/articles",
  "/clients",
  "/messages",
  "/personnel",
  "/metriques",
  "/comptes",
  "/journal",
  "/profil",
] as const;
export type Section = (typeof SECTIONS)[number];

/** Ce que voit l'équipe : tout sauf ce qui est réservé à l'administrateur. */
const ADMIN_ONLY: readonly Section[] = ["/comptes", "/journal"];
const TEAM_SECTIONS: readonly Section[] = SECTIONS.filter(
  (s) => !ADMIN_ONLY.includes(s),
);

/**
 * Matrice de lecture : la première section est la page d'accueil du rôle.
 * /comptes (gestion des comptes) et /journal (journal de sécurité : adresses
 * e-mail, adresses IP, traces de toute l'équipe) sont réservés à
 * l'administrateur ; /profil
 * (son propre mot de passe) est ouvert à tous. Le livreur (demande du
 * 2026-09-18) : Commandes (sa page d'accueil, la tournée), le tableau de bord
 * et les Clients, jamais un montant d'activité (canSeeRevenue).
 */
export const SECTION_ACCESS: Record<Role, readonly Section[]> = {
  admin: SECTIONS,
  gestionnaire: TEAM_SECTIONS,
  lecture: TEAM_SECTIONS,
  livreur: ["/commandes", "/", "/clients", "/profil"],
};

/**
 * Voir l'argent de l'activité : chiffre d'affaires et panier moyen du tableau
 * de bord, montant dépensé par un client ou une communauté (cartes, fiches,
 * tri « Montant dépensé »), remises accordées. Même règle que l'accès aux
 * Métriques : le livreur n'en voit aucun. Les pages ne rendent pas ces
 * chiffres (rien n'arrive au navigateur), le tri refusé retombe sur le nom.
 */
export function canSeeRevenue(role: Role): boolean {
  return SECTION_ACCESS[role].includes("/metriques");
}

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
