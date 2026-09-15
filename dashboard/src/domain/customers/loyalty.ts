import type { Order } from "@/domain/orders/types";

/*
 * Fidélité : après huit commandes d'affilée, la commande suivante est à −15 %.
 * La remise est appliquée par l'application FIG (Order.discount de type
 * « loyalty ») ; le back-office compte la série et prévient l'équipe.
 *
 * Règle de la série (« d'affilée ») : on parcourt les commandes du client dans
 * l'ordre où elles ont été passées ; une commande annulée remet la série à
 * zéro ; une commande qui porte la remise fidélité la consomme et repart de
 * zéro ; toute autre commande compte pour un. Quand la série atteint le seuil,
 * la prochaine commande est remisée. Hypothèse à confirmer avec le client
 * (docs/backlog.md, question 16).
 */
export const LOYALTY_THRESHOLD = 8;
export const LOYALTY_DISCOUNT_PERCENT = 15;

export type LoyaltyStatus = {
  /** Commandes d'affilée comptées, entre 0 et le seuil. */
  streak: number;
  /** Vrai quand la prochaine commande sera remisée. */
  rewardReady: boolean;
  /** Commandes restantes avant la remise (0 si prête). */
  remaining: number;
};

/**
 * Série BRUTE (non plafonnée) d'un client à partir de SES commandes, dans
 * n'importe quel ordre : le nombre de commandes passées depuis la dernière
 * remise à zéro (annulation ou commande remisée fidélité), celle-ci exclue.
 * C'est ce que la requête SQL de l'annuaire compte (orders-aggregates.db.ts).
 */
export function loyaltyStreak(orders: readonly Order[]): number {
  const chronological = orders.toSorted(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
  let streak = 0;
  for (const o of chronological) {
    if (o.discount?.kind === "loyalty" || o.status === "cancelled") streak = 0;
    else streak += 1;
  }
  return streak;
}

/** Série courante d'un client à partir de SES commandes (dans n'importe quel ordre). */
export function loyaltyStatus(orders: readonly Order[]): LoyaltyStatus {
  return loyaltyFromStreak(loyaltyStreak(orders));
}

/** État de fidélité à partir d'une série brute. */
export function loyaltyFromStreak(streak: number): LoyaltyStatus {
  const capped = Math.min(streak, LOYALTY_THRESHOLD);
  return {
    streak: capped,
    rewardReady: streak >= LOYALTY_THRESHOLD,
    remaining: LOYALTY_THRESHOLD - capped,
  };
}
