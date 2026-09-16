/*
 * Frais de livraison (barème du client, 2026-09-16), calculés sur le PANIER,
 * c'est-à-dire le sous-total des lignes avant remise :
 *   moins de 5 € → 4,90 € ; dès 5 € → 3,90 € ; dès 10 € → 2,90 € ; dès 20 € →
 *   1,90 €. Une communauté a toujours la livraison offerte.
 * Les frais sont AJOUTÉS après la remise : la remise porte sur les produits,
 * jamais sur la livraison. Le montant réel est celui que l'application FIG a
 * facturé (Order.deliveryFeeCents, instantané sur la commande) ; ce barème
 * sert aux données de démonstration et à l'écran pour l'annoncer.
 */
export const DELIVERY_FEE_TIERS = [
  { minSubtotalCents: 2000, feeCents: 190 },
  { minSubtotalCents: 1000, feeCents: 290 },
  { minSubtotalCents: 500, feeCents: 390 },
  { minSubtotalCents: 0, feeCents: 490 },
] as const;

/** Frais attendus pour un panier (centimes) ; 0 pour une communauté. */
export function deliveryFeeCents(
  subtotalCents: number,
  community: boolean,
): number {
  if (community) return 0;
  const tier = DELIVERY_FEE_TIERS.find(
    (t) => subtotalCents >= t.minSubtotalCents,
  );
  return tier?.feeCents ?? 0;
}
