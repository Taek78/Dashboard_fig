import type { SecurityFamily } from "@/domain/security/events";

/*
 * Journal de sécurité, côté lecture. La table `security_events` est écrite
 * depuis partout (src/data/security-log.ts) ; ici, seulement ce que l'écran
 * d'administration lit. Rien n'est jamais modifié ni supprimé par le
 * dashboard : un journal qui se corrige ne prouve plus rien. Seule la purge
 * RGPD (douze mois, domain/privacy/retention.ts) y touche.
 */
export type SecurityEventRecord = {
  id: string;
  /** ISO 8601. */
  at: string;
  /** Le type brut tel qu'il a été écrit ; un type inconnu reste affichable. */
  type: string;
  /** Le reste de l'événement ; jamais un secret (par construction de l'écriture). */
  details: Record<string, unknown>;
};

/**
 * Filtres de l'écran. La recherche libre porte sur les IDENTIFIANTS de
 * l'événement (adresse e-mail, IP, identifiant de compte, de commande, de
 * client) et sur son type : c'est ainsi qu'on enquête, en partant de ce qu'on
 * sait déjà. Les familles cochées s'additionnent (aucune = toutes).
 */
export type SecurityFilters = {
  query?: string;
  families?: readonly SecurityFamily[];
  /** Jours du journal (`AAAA-MM-JJ`), règle commune des périodes. */
  from?: string;
  to?: string;
};

export const SECURITY_SEARCH_MAX_LENGTH = 120;

/** Lignes par page. Un journal se parcourt par blocs courts et datés. */
export const SECURITY_PAGE_SIZE = 50;
