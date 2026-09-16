/*
 * Remise portée par une commande, décidée et appliquée par l'application
 * FIG (jamais par le back-office, qui l'affiche) :
 * - « community » : remise d'une communauté (crèche, école, entreprise) dont le
 *   client est membre ; le pourcentage dépend de son nombre de membres
 *   (src/domain/communities/discount.ts) ;
 * - « loyalty » : fidélité, la commande qui suit huit commandes cumulées
 *   (src/domain/customers/loyalty.ts).
 * Les deux ne se cumulent pas : la plus forte l'emporte (bestDiscount).
 * Le montant est conservé en centimes sur la commande : le total dû est le
 * sous-total des lignes moins ce montant, plus les frais de livraison. L'enum
 * Postgres discount_kind reprend ces clés.
 */
import { LOYALTY_DISCOUNT_PERCENT } from "@/domain/customers/loyalty";

export const DISCOUNT_KINDS = ["community", "loyalty"] as const;
export type DiscountKind = (typeof DISCOUNT_KINDS)[number];

export const DISCOUNT_KIND_LABELS: Record<DiscountKind, string> = {
  community: "Remise communauté",
  loyalty: "Remise fidélité",
};

export type OrderDiscount = {
  kind: DiscountKind;
  /** Pourcentage entier, ex. 10 pour −10 %. */
  percent: number;
  /** Montant déduit, en centimes. */
  amountCents: number;
};

/** Remise attendue sur la prochaine commande (nature et taux), sans montant. */
export type ExpectedDiscount = { kind: DiscountKind; percent: number };

/**
 * La meilleure remise l'emporte (décision du client, 2026-09-16) : la fidélité
 * si elle est prête et plus forte que celle de la communauté, sinon celle de
 * la communauté si elle existe, sinon aucune. À taux égal, la fidélité passe
 * en premier : elle se consomme, la remise de communauté reviendra ensuite.
 */
export function bestDiscount(
  loyaltyReady: boolean,
  communityPercent: number | null,
  loyaltyPercent = LOYALTY_DISCOUNT_PERCENT,
): ExpectedDiscount | null {
  const community = communityPercent !== null && communityPercent > 0;
  if (loyaltyReady && (!community || loyaltyPercent >= communityPercent)) {
    return { kind: "loyalty", percent: loyaltyPercent };
  }
  return community ? { kind: "community", percent: communityPercent } : null;
}

/** Montant d'une remise en pourcentage sur un sous-total, arrondi au centime. */
export function discountAmountCents(
  subtotalCents: number,
  percent: number,
): number {
  return Math.round((subtotalCents * percent) / 100);
}

/** "−10 % communauté" ; "−15 % fidélité". Signe moins typographique, espace insécable. */
export function formatDiscount(discount: OrderDiscount): string {
  const label = discount.kind === "community" ? "communauté" : "fidélité";
  return `−${discount.percent} % ${label}`;
}
