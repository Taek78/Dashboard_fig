import {
  MAX_LINE_QUANTITY,
  ORDER_BOOKING_HORIZON_DAYS,
} from "@/domain/api/types";
import type { CommunityRef } from "@/domain/communities/types";
import { todayInParis } from "@/domain/deliveries/rules";
import {
  bestDiscount,
  discountAmountCents,
  type OrderDiscount,
} from "@/domain/orders/discount";
import { deliveryFeeCents } from "@/domain/orders/delivery-fee";
import { computeOrderTotalCents } from "@/domain/orders/rules";
import { isDeliverySlot } from "@/domain/orders/slot";
import type { OrderLine } from "@/domain/orders/types";
import {
  productSaleStatus,
  type CatalogSettings,
} from "@/domain/products/status";
import type { Product } from "@/domain/products/types";
import { addDays } from "@/lib/days";

/*
 * DEVIS d'une commande passée par l'application (API, 2026-09-17) : à partir
 * d'un panier (produit, quantité), du catalogue relu et de la situation du
 * client (fidélité prête, communauté et son taux), l'API calcule elle-même
 * les lignes (nom et prix instantanés), la remise (la meilleure l'emporte :
 * orders/discount.ts), les frais (barème, offerts à une communauté) et le
 * total. L'application paie ce total et le renvoie à la création
 * (expectedTotalCents) : s'il diffère, la commande est refusée. Un seul
 * endroit calcule un prix : le dashboard.
 *
 * Le stock n'est PAS décrémenté par la commande (le dashboard ne l'a jamais
 * fait : la quantité en stock est tenue par l'équipe, question 27) ; il borne
 * seulement la quantité commandable quand le catalogue ne vend pas à stock 0.
 */
export type CartLine = { productId: string; quantity: number };

export const QUOTE_PROBLEM_CODES = [
  "unknown_product",
  "not_for_sale",
  "stock_insufficient",
  "quantity_too_large",
  "duplicate_line",
] as const;
export type QuoteProblemCode = (typeof QUOTE_PROBLEM_CODES)[number];

export type QuoteProblem = {
  productId: string;
  code: QuoteProblemCode;
  message: string;
};

export type QuoteLine = OrderLine & { unitPriceCents: number };

export type Quote = {
  lines: QuoteLine[];
  subtotalCents: number;
  discount: OrderDiscount | null;
  deliveryFeeCents: number;
  totalCents: number;
  /** Communauté de retrait quand le client en est membre, sinon null. */
  community: CommunityRef | null;
};

export type QuoteContext = {
  products: readonly Product[];
  settings: CatalogSettings;
  /** La remise fidélité est prête (huit commandes cumulées). */
  loyaltyReady: boolean;
  community: CommunityRef | null;
  /** Taux annoncé de la communauté (0 sans communauté ou sous quatre membres). */
  communityPercent: number;
};

const PROBLEM_MESSAGES: Record<QuoteProblemCode, string> = {
  unknown_product: "Ce produit n'existe pas ou n'est plus au catalogue.",
  not_for_sale: "Ce produit n'est pas en vente actuellement.",
  stock_insufficient: "La quantité demandée dépasse le stock disponible.",
  quantity_too_large: "La quantité demandée dépasse le maximum par ligne.",
  duplicate_line: "Ce produit apparaît deux fois dans le panier.",
};

/** Total d'une ligne : prix au kilo × grammes / 1000, ou prix à la pièce × pièces, arrondi au centime. */
export function lineTotalCents(
  product: Pick<Product, "unit" | "priceCents">,
  quantity: number,
): number {
  return product.unit === "g"
    ? Math.round((product.priceCents * quantity) / 1000)
    : product.priceCents * quantity;
}

/**
 * Construit le devis ou la liste complète des problèmes (une entrée par ligne
 * fautive, jamais seulement la première : l'application les affiche toutes).
 */
export function buildQuote(
  cart: readonly CartLine[],
  context: QuoteContext,
): { ok: true; quote: Quote } | { ok: false; problems: QuoteProblem[] } {
  const byId = new Map(context.products.map((p) => [p.id, p]));
  const seen = new Set<string>();
  const problems: QuoteProblem[] = [];
  const lines: QuoteLine[] = [];
  const problem = (productId: string, code: QuoteProblemCode) =>
    problems.push({ productId, code, message: PROBLEM_MESSAGES[code] });

  for (const line of cart) {
    if (seen.has(line.productId)) {
      problem(line.productId, "duplicate_line");
      continue;
    }
    seen.add(line.productId);
    const product = byId.get(line.productId);
    if (!product || !product.visible) {
      problem(line.productId, "unknown_product");
      continue;
    }
    if (productSaleStatus(product, context.settings) !== "en_vente") {
      problem(line.productId, "not_for_sale");
      continue;
    }
    if (line.quantity > MAX_LINE_QUANTITY[product.unit]) {
      problem(line.productId, "quantity_too_large");
      continue;
    }
    if (
      !context.settings.sellWhenOutOfStock &&
      line.quantity > product.stockQuantity
    ) {
      problem(line.productId, "stock_insufficient");
      continue;
    }
    lines.push({
      productId: product.id,
      productName: product.name,
      quantity: line.quantity,
      unit: product.unit,
      unitPriceCents: product.priceCents,
      lineTotalCents: lineTotalCents(product, line.quantity),
    });
  }
  if (problems.length > 0) return { ok: false, problems };

  const subtotalCents = lines.reduce((sum, l) => sum + l.lineTotalCents, 0);
  const expected = bestDiscount(
    context.loyaltyReady,
    context.community ? context.communityPercent : null,
  );
  const discount: OrderDiscount | null = expected
    ? {
        kind: expected.kind,
        percent: expected.percent,
        amountCents: discountAmountCents(subtotalCents, expected.percent),
      }
    : null;
  const fee = deliveryFeeCents(subtotalCents, context.community !== null);
  return {
    ok: true,
    quote: {
      lines,
      subtotalCents,
      discount,
      deliveryFeeCents: fee,
      totalCents: computeOrderTotalCents(lines, discount, fee),
      community: context.community,
    },
  };
}

/** Heure courante à Paris (0..23). */
export function hourInParis(now: Date): number {
  const hour = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "numeric",
    hourCycle: "h23",
  }).format(now);
  return Number(hour.replace(/\D/g, ""));
}

/**
 * Un créneau se réserve s'il est un créneau FIG (une heure pile entre 10:00
 * et 20:00), au plus tôt aujourd'hui et au plus tard dans trente jours ; le
 * jour même, seulement s'il commence au moins deux heures après l'heure
 * courante (le temps de préparer), en heure de Paris.
 */
export function isSlotBookable(
  slot: { date: string; start: string; end: string },
  now: Date,
  horizonDays = ORDER_BOOKING_HORIZON_DAYS,
): boolean {
  if (!isDeliverySlot(slot)) return false;
  const today = todayInParis(now);
  if (slot.date < today || slot.date > addDays(today, horizonDays)) {
    return false;
  }
  return (
    slot.date > today || Number(slot.start.slice(0, 2)) >= hourInParis(now) + 2
  );
}

/** Référence d'une commande : « FIG-AAMMJJ-NNN », jour de livraison et rang du jour. */
export function orderReference(deliveryDate: string, seq: number): string {
  const day = deliveryDate.replace(/-/g, "").slice(2);
  return `FIG-${day}-${String(seq).padStart(3, "0")}`;
}
