/*
 * Statistiques d'usage de l'application FIG (A6, ajout du 2026-09-13) :
 * téléchargements, inscriptions, réclamations et note, par mois civil. Elles ne
 * se déduisent pas des commandes : elles viendront des stores (App Store, Play)
 * et du support du client (question client à ajouter : source et fréquence).
 */
export type EngagementPoint = {
  /** "AAAA-MM" */
  month: string;
  downloads: number;
  signups: number;
  complaints: number;
  /** Note moyenne du mois sur 5, avec deux décimales ; null si aucun avis. */
  rating: number | null;
  ratingCount: number;
};
