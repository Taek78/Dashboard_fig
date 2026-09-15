import type { EngagementPoint } from "@/domain/engagement/types";

/* CONTRAT des statistiques d'usage : table engagement_monthly aujourd'hui, export des stores / du support demain. */
export type EngagementSource = {
  getEngagement(): Promise<EngagementPoint[]>;
};
