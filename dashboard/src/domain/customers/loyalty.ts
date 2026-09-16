import type { Order } from "@/domain/orders/types";

/*
 * Fidélité : après huit commandes CUMULÉES, la commande suivante est à −15 %.
 * La remise est appliquée par l'application FIG (Order.discount de type
 * « loyalty ») ; le back-office compte et prévient l'équipe.
 *
 * Règle du compteur (décision du client, 2026-09-16) : on parcourt les
 * commandes du client dans l'ordre où elles ont été passées ; une commande
 * annulée ne compte pas et NE remet PAS le compteur à zéro ; une commande qui
 * porte la remise fidélité la consomme et repart de zéro (elle-même n'est pas
 * comptée) ; toute autre commande, même encore en préparation, compte pour un.
 * Quand le compteur atteint le seuil, la prochaine commande est remisée, et le
 * client devient « fidèle » pour deux mois (domain/customers/tier.ts).
 *
 * Un membre de communauté a le même compteur : quand sa remise fidélité est
 * prête, elle remplace la remise de sa communauté, plus faible
 * (orders/discount.ts, bestDiscount).
 */
export const LOYALTY_THRESHOLD = 8;
export const LOYALTY_DISCOUNT_PERCENT = 15;

export type LoyaltyStatus = {
  /** Commandes comptées depuis la dernière remise, entre 0 et le seuil. */
  count: number;
  /** Vrai quand la prochaine commande sera remisée. */
  rewardReady: boolean;
  /** Commandes restantes avant la remise (0 si prête). */
  remaining: number;
};

/** Copie des commandes dans l'ordre de passation (createdAt puis id). */
export function chronological(orders: readonly Order[]): Order[] {
  return orders.toSorted(
    (a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  );
}

/**
 * Compteur BRUT (non plafonné) d'un client à partir de SES commandes, dans
 * n'importe quel ordre : le nombre de commandes non annulées passées depuis
 * la dernière commande remisée fidélité, celle-ci exclue. C'est ce que la
 * requête SQL de l'annuaire compte (orders-aggregates.db.ts).
 */
export function loyaltyCount(orders: readonly Order[]): number {
  let count = 0;
  for (const o of chronological(orders)) {
    if (o.discount?.kind === "loyalty") count = 0;
    else if (o.status !== "cancelled") count += 1;
  }
  return count;
}

/** État de fidélité d'un client à partir de SES commandes (dans n'importe quel ordre). */
export function loyaltyStatus(orders: readonly Order[]): LoyaltyStatus {
  return loyaltyFromCount(loyaltyCount(orders));
}

/** État de fidélité à partir d'un compteur brut. */
export function loyaltyFromCount(count: number): LoyaltyStatus {
  const capped = Math.min(count, LOYALTY_THRESHOLD);
  return {
    count: capped,
    rewardReady: count >= LOYALTY_THRESHOLD,
    remaining: LOYALTY_THRESHOLD - capped,
  };
}
