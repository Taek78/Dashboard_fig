/*
 * Statistiques d'usage de l'application FIG :
 * téléchargements, inscriptions et note, par mois civil. Elles ne se
 * déduisent pas des commandes : elles viendront des stores (App Store, Play)
 * et du support du client (question 11 : source et fréquence). Les
 * réclamations, elles, se comptent dans les messages « Nous contacter »
 * (countComplaints) : plus de chiffre venu d'ailleurs.
 */
export type EngagementPoint = {
  /** "AAAA-MM" */
  month: string;
  downloads: number;
  signups: number;
  /** Note moyenne du mois sur 5, avec deux décimales ; null si aucun avis. */
  rating: number | null;
  ratingCount: number;
};
