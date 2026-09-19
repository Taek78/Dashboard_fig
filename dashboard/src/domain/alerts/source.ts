import type {
  AlertFeed,
  AlertPrefs,
  AlertReadKind,
  AlertScope,
} from "@/domain/alerts/types";

/*
 * CONTRAT du flux des alertes en direct, implémenté par PostgreSQL
 * (src/data/alerts.db.ts). Types seulement.
 * - getAlertFeed(since, scope, now) : les commandes créées et les messages
 *   reçus APRÈS `since` (ALERT_FEED_LIMIT au plus chacun, les plus récents),
 *   et TOUS les produits sous leur seuil de stock (critique ou à 0) ; une
 *   liste hors du `scope` du rôle reste vide, sans requête. Plus les
 *   compteurs non lus du compte `userId` (depuis ses dernières visites) ;
 * - getAlertPrefs / setAlertPrefs : les deux cases de « Mon profil » ;
 * - markAlertsSeen : la section a été ouverte (dernière visite = `at`).
 */
export type AlertsSource = {
  getAlertFeed(
    since: Date,
    scope: AlertScope,
    now: Date,
    userId: string,
  ): Promise<AlertFeed>;
  getAlertPrefs(userId: string): Promise<AlertPrefs>;
  setAlertPrefs(userId: string, prefs: AlertPrefs): Promise<void>;
  /** Dernière visite d'une section : son compteur repart de zéro. */
  markAlertsSeen(userId: string, kind: AlertReadKind, at: Date): Promise<void>;
};
