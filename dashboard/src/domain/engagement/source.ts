import type { EngagementPoint } from "@/domain/engagement/types";

/* CONTRAT des statistiques d'usage : mock aujourd'hui, export des stores / du support demain. */
export type EngagementSource = {
  getEngagement(): Promise<EngagementPoint[]>;
};
