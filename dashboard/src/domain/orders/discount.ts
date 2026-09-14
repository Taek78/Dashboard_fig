/*
 * Remise portée par une commande, décidée et appliquée par l'application
 * FIG (jamais par le back-office, qui l'affiche) :
 * - « community » : remise d'une communauté (crèche, école, entreprise) dont le
 *   client est membre ; le pourcentage est celui de la communauté ;
 * - « loyalty » : fidélité, la commande qui suit huit commandes d'affilée
 *   (src/domain/customers/loyalty.ts).
 * Le montant est conservé en centimes sur la commande : le total dû est le
 * sous-total des lignes moins ce montant. L'enum Postgres discount_kind
 * reprend ces clés.
 */
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
