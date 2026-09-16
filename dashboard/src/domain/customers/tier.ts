import { chronological, LOYALTY_THRESHOLD } from "@/domain/customers/loyalty";
import type { Order } from "@/domain/orders/types";
import { addMonths } from "@/lib/days";

/*
 * Catégorie d'un client (décision du client, 2026-09-16) : « fidèle » pendant
 * deux mois après avoir atteint huit commandes cumulées (le compteur de
 * loyalty.ts), « basique » le reste du temps. Rien n'est stocké : la catégorie
 * et son historique se DÉDUISENT des commandes, datés par la commande qui a
 * fait franchir le seuil. Personne dans le dashboard n'assiste à la création
 * d'une commande (c'est l'application FIG qui écrit) : une table écrite à la
 * main pourrait diverger, une règle pure jamais. La requête SQL de l'annuaire
 * renvoie la même date (orders-aggregates.db.ts) et test/data/orders.db.test.ts
 * la compare à cette règle.
 *
 * L'atteinte se compte par CYCLE : chaque fois que le compteur revient à huit
 * après une remise consommée, la catégorie est de nouveau acquise pour deux
 * mois. Un compteur qui dépasse huit sans remise (la remise n'a pas encore été
 * appliquée) ne crée pas de nouvelle atteinte.
 */
export const CUSTOMER_TIERS = ["basic", "loyal"] as const;
export type CustomerTier = (typeof CUSTOMER_TIERS)[number];

export const CUSTOMER_TIER_LABELS: Record<CustomerTier, string> = {
  basic: "Basique",
  loyal: "Fidèle",
};

/** Étoiles affichées pour chaque catégorie (la couleur n'est jamais seule). */
export const CUSTOMER_TIER_STARS: Record<CustomerTier, number> = {
  basic: 1,
  loyal: 2,
};

/** Durée de la catégorie « fidèle », en mois civils. */
export const LOYAL_TIER_MONTHS = 2;

/** Une atteinte de la catégorie « fidèle », datée par la commande qui l'a déclenchée. */
export type TierEvent = {
  /** ISO 8601 : passation de la huitième commande du cycle. */
  reachedAt: string;
  /** ISO 8601 : fin de validité (reachedAt + LOYAL_TIER_MONTHS). */
  expiresAt: string;
  orderId: string;
  orderReference: string;
};

/** Catégorie à un instant donné, avec la période en cours si « fidèle ». */
export type CustomerTierState = {
  tier: CustomerTier;
  /** ISO 8601 de l'atteinte en cours, sinon null. */
  since: string | null;
  /** ISO 8601 de la fin de validité, sinon null. */
  until: string | null;
};

/** Fin de validité d'une atteinte. */
export function tierExpiry(reachedAt: string): string {
  return addMonths(reachedAt, LOYAL_TIER_MONTHS);
}

/**
 * Historique des atteintes d'un client à partir de SES commandes, dans
 * n'importe quel ordre, de la plus ancienne à la plus récente. Même parcours
 * que loyaltyCount : annulées ignorées, remise fidélité consommée.
 */
export function loyalTierEvents(orders: readonly Order[]): TierEvent[] {
  const events: TierEvent[] = [];
  let count = 0;
  for (const o of chronological(orders)) {
    if (o.discount?.kind === "loyalty") {
      count = 0;
      continue;
    }
    if (o.status === "cancelled") continue;
    count += 1;
    if (count === LOYALTY_THRESHOLD) {
      events.push({
        reachedAt: o.createdAt,
        expiresAt: tierExpiry(o.createdAt),
        orderId: o.id,
        orderReference: o.reference,
      });
    }
  }
  return events;
}

/**
 * Catégorie à l'instant `at` à partir de la DERNIÈRE atteinte (ce que la base
 * renvoie pour tout l'annuaire) : fidèle si `at` est dans sa fenêtre de deux
 * mois, bornes début incluse et fin exclue ; basique sinon, ou sans atteinte.
 */
export function tierFromReachedAt(
  reachedAt: string | null,
  at: string,
): CustomerTierState {
  if (reachedAt === null) return { tier: "basic", since: null, until: null };
  const until = tierExpiry(reachedAt);
  if (at < reachedAt || at >= until) {
    return { tier: "basic", since: null, until: null };
  }
  return { tier: "loyal", since: reachedAt, until };
}

/** Catégorie d'un client à l'instant `at` à partir de SES commandes. */
export function customerTier(
  orders: readonly Order[],
  at: string,
): CustomerTierState {
  const events = loyalTierEvents(orders);
  return tierFromReachedAt(events.at(-1)?.reachedAt ?? null, at);
}
