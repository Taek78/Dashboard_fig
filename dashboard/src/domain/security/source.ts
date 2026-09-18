import type {
  SecurityEventRecord,
  SecurityFilters,
} from "@/domain/security/types";

/*
 * CONTRAT de lecture du journal de sécurité (table `security_events`,
 * src/data/security-log.db.ts). En LECTURE SEULE, volontairement : le
 * dashboard écrit le journal par `logSecurity` et n'offre aucun moyen de le
 * modifier ni de l'effacer. Un journal qu'on peut corriger ne prouve rien ;
 * seule la purge RGPD (douze mois) y touche, par son script.
 *
 * La page est découpée PAR LA BASE (filtres, recherche, COUNT puis
 * LIMIT/OFFSET), comme les commandes et les messages : aucun écran ne charge
 * un journal entier.
 */
export type SecurityEventsPage = {
  items: SecurityEventRecord[];
  page: number;
  pageCount: number;
  total: number;
};

export type SecurityLogSource = {
  getSecurityEventsPage(
    filters: SecurityFilters,
    page: number,
    size?: number,
  ): Promise<SecurityEventsPage>;
  countSecurityEvents(filters: SecurityFilters): Promise<number>;
  /** Le plus ancien événement encore en base : dit depuis quand le journal couvre. */
  oldestSecurityEventAt(): Promise<string | null>;
};
