import type {
  ApiArticle,
  ApiCatalog,
  ApiCommunity,
  ApiCustomer,
  ApiListPage,
  ApiMessage,
  ApiNotification,
  ApiOrder,
  ApiPendingNotification,
  ApiProduct,
  ApiQuote,
  ApiSession,
  ApiUpload,
} from "@/domain/api/responses";
import type { CustomerSession } from "@/domain/api/session";
import { API_BASE_PATH, ORDER_BOOKING_HORIZON_DAYS } from "@/domain/api/types";
import { ARTICLE_CATEGORY_LABELS } from "@/domain/articles/category";
import type { Article } from "@/domain/articles/types";
import {
  COMMUNITY_DISCOUNT_TIERS,
  communityDiscountPercent,
} from "@/domain/communities/discount";
import {
  COMMUNITY_KIND_LABELS,
  COMMUNITY_VISIBILITY_LABELS,
} from "@/domain/communities/kind";
import type { Community } from "@/domain/communities/types";
import {
  LOYALTY_DISCOUNT_PERCENT,
  LOYALTY_THRESHOLD,
  loyaltyFromCount,
} from "@/domain/customers/loyalty";
import {
  CUSTOMER_TIER_LABELS,
  tierFromReachedAt,
} from "@/domain/customers/tier";
import type { Customer } from "@/domain/customers/types";
import { MESSAGE_STATUS_LABELS } from "@/domain/messages/status";
import { MESSAGE_SUBJECT_LABELS } from "@/domain/messages/subject";
import type { Message, MessageUpload } from "@/domain/messages/types";
import type { CustomerNotification } from "@/domain/notifications/types";
import { CANCELLATION_REASON_LABELS } from "@/domain/orders/cancellation";
import { REFUND_KIND_LABELS } from "@/domain/orders/refund";
import { DELIVERY_FEE_TIERS } from "@/domain/orders/delivery-fee";
import {
  bestDiscount,
  DISCOUNT_KIND_LABELS,
  type OrderDiscount,
} from "@/domain/orders/discount";
import type { Quote } from "@/domain/orders/quote";
import { computeOrderSubtotalCents } from "@/domain/orders/rules";
import { DELIVERY_SLOT_STARTS } from "@/domain/orders/slot";
import { ORDER_STATUS_LABELS } from "@/domain/orders/status";
import type { Order } from "@/domain/orders/types";
import { PRODUCT_CATEGORY_LABELS } from "@/domain/products/category";
import {
  PRODUCT_SALE_STATUS_LABELS,
  productSaleStatus,
  type CatalogSettings,
} from "@/domain/products/status";
import type { Product } from "@/domain/products/types";
import { encodeCursor, type KeysetResult } from "@/lib/api/cursor";

/*
 * VUES de l'API : des types métier du dashboard vers la forme des réponses
 * (responses.ts). Règles pures, testées : chaque vue est vérifiée contre son
 * schéma. Ce qui n'est pas exposé l'est volontairement : le client ne voit ni
 * les notes internes, ni l'équipe affectée, ni les coordonnées des référents
 * d'une communauté, ni le nom d'un autre client (parrain excepté, qu'il a
 * lui-même saisi).
 */

/** Ce que la fiche seule ne dit pas : chiffres agrégés par la base, à l'instant `now`. */
export type CustomerFacts = {
  loyaltyCount: number;
  loyalSince: string | null;
  /** Membres de sa communauté (0 sans communauté). */
  memberCount: number;
  referralCount: number;
  /** ISO 8601. */
  now: string;
};

export function customerView(
  customer: Customer,
  facts: CustomerFacts,
): ApiCustomer {
  const loyalty = loyaltyFromCount(facts.loyaltyCount);
  const tier = tierFromReachedAt(facts.loyalSince, facts.now);
  const communityPercent = customer.community
    ? communityDiscountPercent(facts.memberCount)
    : null;
  const next = bestDiscount(loyalty.rewardReady, communityPercent);
  return {
    id: customer.id,
    fullName: customer.fullName,
    email: customer.email,
    phone: customer.phone,
    addressLine: customer.addressLine,
    city: customer.city,
    postalCode: customer.postalCode,
    createdAt: customer.createdAt,
    community: customer.community
      ? { ...customer.community, discountPercent: communityPercent ?? 0 }
      : null,
    consents: customer.consents,
    referralCode: customer.referralCode,
    referredBy: customer.referredBy
      ? { fullName: customer.referredBy.fullName }
      : null,
    referralCount: facts.referralCount,
    loyalty: {
      count: loyalty.count,
      threshold: LOYALTY_THRESHOLD,
      rewardReady: loyalty.rewardReady,
      remaining: loyalty.remaining,
      discountPercent: LOYALTY_DISCOUNT_PERCENT,
    },
    tier: {
      tier: tier.tier,
      label: CUSTOMER_TIER_LABELS[tier.tier],
      since: tier.since,
      until: tier.until,
    },
    nextDiscount: next
      ? {
          kind: next.kind,
          label: DISCOUNT_KIND_LABELS[next.kind],
          percent: next.percent,
        }
      : null,
  };
}

export function sessionView(
  token: string,
  session: Pick<CustomerSession, "expiresAt">,
  customer: ApiCustomer,
  created: boolean,
): ApiSession {
  return { token, expiresAt: session.expiresAt, created, customer };
}

export function productView(
  product: Product,
  settings: CatalogSettings,
): ApiProduct {
  const saleStatus = productSaleStatus(product, settings);
  return {
    id: product.id,
    name: product.name,
    variety: product.variety,
    category: product.category,
    categoryLabel: PRODUCT_CATEGORY_LABELS[product.category],
    unit: product.unit,
    priceCents: product.priceCents,
    unitWeightGrams: product.unitWeightGrams,
    container: product.container,
    originCountry: product.originCountry,
    originRegion: product.originRegion,
    caliber: product.caliber,
    organic: product.organic,
    inSeason: product.inSeason,
    saleStatus,
    saleStatusLabel: PRODUCT_SALE_STATUS_LABELS[saleStatus],
    stockQuantity: product.stockQuantity,
    illustration: product.illustration,
    imageUrl: product.imageUrl,
    updatedAt: product.updatedAt,
  };
}

/** Le catalogue tel que l'application l'affiche : produits VISIBLES seulement, avec les barèmes. */
export function catalogView(
  products: readonly Product[],
  settings: CatalogSettings,
  now: string,
): ApiCatalog {
  const visible = products.filter((p) => p.visible);
  const latest = visible.reduce(
    (max, p) => (p.updatedAt > max ? p.updatedAt : max),
    "",
  );
  return {
    updatedAt: latest || now,
    settings: { sellWhenOutOfStock: settings.sellWhenOutOfStock },
    deliveryFeeTiers: DELIVERY_FEE_TIERS.map((t) => ({ ...t })),
    deliverySlotStarts: [...DELIVERY_SLOT_STARTS],
    bookingHorizonDays: ORDER_BOOKING_HORIZON_DAYS,
    loyalty: {
      threshold: LOYALTY_THRESHOLD,
      discountPercent: LOYALTY_DISCOUNT_PERCENT,
    },
    communityDiscountTiers: COMMUNITY_DISCOUNT_TIERS.map((t) => ({ ...t })),
    products: visible.map((p) => productView(p, settings)),
  };
}

export function articleView(article: Article): ApiArticle {
  return {
    id: article.id,
    title: article.title,
    body: article.body,
    category: article.category,
    categoryLabel: ARTICLE_CATEGORY_LABELS[article.category],
    illustration: article.illustration,
    imageUrl: article.imageUrl,
    publishedAt: article.publishedAt,
    updatedAt: article.updatedAt,
  };
}

/** Sans les coordonnées du référent : données personnelles d'un tiers. */
export function communityView(
  community: Community,
  memberCount: number,
): ApiCommunity {
  return {
    id: community.id,
    name: community.name,
    kind: community.kind,
    kindLabel: COMMUNITY_KIND_LABELS[community.kind],
    visibility: community.visibility,
    visibilityLabel: COMMUNITY_VISIBILITY_LABELS[community.visibility],
    pickupPlace: community.pickupPlace,
    pickupCity: community.pickupCity,
    pickupPostalCode: community.pickupPostalCode,
    memberCount,
    discountPercent: communityDiscountPercent(memberCount),
  };
}

function discountView(discount: OrderDiscount | null) {
  return discount
    ? { ...discount, label: DISCOUNT_KIND_LABELS[discount.kind] }
    : null;
}

export function quoteView(quote: Quote): ApiQuote {
  return {
    lines: quote.lines.map((line) => ({
      productId: line.productId,
      productName: line.productName,
      unit: line.unit,
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
      lineTotalCents: line.lineTotalCents,
    })),
    subtotalCents: quote.subtotalCents,
    discount: discountView(quote.discount),
    deliveryFeeCents: quote.deliveryFeeCents,
    totalCents: quote.totalCents,
    community: quote.community,
  };
}

/** Sans l'équipe affectée ni les coordonnées : la commande vue par la personne qui l'a passée. */
export function orderView(order: Order): ApiOrder {
  return {
    id: order.id,
    reference: order.reference,
    createdAt: order.createdAt,
    status: order.status,
    statusLabel: ORDER_STATUS_LABELS[order.status],
    deliverySlot: order.deliverySlot,
    deliveryAddressLine: order.deliveryAddressLine,
    deliveryCity: order.deliveryCity,
    deliveryPostalCode: order.deliveryPostalCode,
    lines: order.lines.map((line) => ({ ...line })),
    subtotalCents: computeOrderSubtotalCents(order.lines),
    discount: discountView(order.discount),
    deliveryFeeCents: order.deliveryFeeCents,
    totalCents: order.totalCents,
    cancellation: order.cancellation
      ? {
          reason: order.cancellation.reason,
          label: CANCELLATION_REASON_LABELS[order.cancellation.reason],
          detail: order.cancellation.detail,
        }
      : null,
    refund: order.refund
      ? {
          kind: order.refund.kind,
          label: REFUND_KIND_LABELS[order.refund.kind],
          amountCents: order.refund.amountCents,
          at: order.refund.at,
        }
      : null,
    community: order.community,
    paymentReference: order.paymentReference,
    cancellable: order.status === "preparing",
  };
}

/** Chemin d'un fichier hébergé sur l'API : relatif, l'application connaît déjà l'hôte. */
export function uploadPath(id: string): string {
  return `${API_BASE_PATH}/fichiers/${encodeURIComponent(id)}`;
}

/** Un fichier téléversé, sans ses octets ni son propriétaire. */
export function uploadView(upload: MessageUpload): ApiUpload {
  return {
    id: upload.id,
    fileName: upload.fileName,
    contentType: upload.contentType,
    sizeBytes: upload.sizeBytes,
    url: uploadPath(upload.id),
    createdAt: upload.createdAt,
  };
}

/** Sans le nom du traitant ni les marques internes (épingle, important). */
export function messageView(message: Message): ApiMessage {
  return {
    id: message.id,
    subject: message.subject,
    subjectLabel: MESSAGE_SUBJECT_LABELS[message.subject],
    body: message.body,
    orderId: message.order?.id ?? null,
    orderReference: message.order?.reference ?? null,
    status: message.status,
    statusLabel: MESSAGE_STATUS_LABELS[message.status],
    receivedAt: message.receivedAt,
    handledAt: message.handledAt,
    attachments: message.attachments.map((file) => ({
      id: file.id,
      fileId: file.uploadId,
      fileName: file.fileName,
      contentType: file.contentType,
      sizeBytes: file.sizeBytes,
      url:
        file.uploadId !== null ? uploadPath(file.uploadId) : (file.url ?? ""),
    })),
  };
}

export function notificationView(
  notification: CustomerNotification,
): ApiNotification {
  return {
    id: notification.id,
    orderId: notification.order.id,
    orderReference: notification.order.reference,
    orderStatus: notification.orderStatus,
    title: notification.title,
    body: notification.body,
    createdAt: notification.createdAt,
    sentAt: notification.sentAt,
  };
}

export function pendingNotificationView(
  notification: CustomerNotification,
): ApiPendingNotification {
  return {
    ...notificationView(notification),
    customerId: notification.customerId,
  };
}

/** Une page de source (curseur structuré) → une page d'API (curseur opaque). */
export function pageView<T, V>(
  result: KeysetResult<T>,
  view: (item: T) => V,
): ApiListPage<V> {
  return {
    items: result.items.map(view),
    nextCursor: result.next ? encodeCursor(result.next) : null,
  };
}
