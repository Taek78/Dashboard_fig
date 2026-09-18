import type { AlertFeed, AlertScope } from "@/domain/alerts/types";

/*
 * CONTRAT du flux des alertes en direct, implémenté par PostgreSQL
 * (src/data/alerts.db.ts). Types seulement.
 * - getAlertFeed(since, scope, now) : les commandes créées et les messages
 *   reçus APRÈS `since` (ALERT_FEED_LIMIT au plus chacun, les plus récents),
 *   et TOUS les produits sous leur seuil de stock (critique ou à 0) ; une
 *   liste hors du `scope` du rôle reste vide, sans requête.
 */
export type AlertsSource = {
  getAlertFeed(since: Date, scope: AlertScope, now: Date): Promise<AlertFeed>;
};
