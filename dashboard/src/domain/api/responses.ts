import { z } from "zod";
import { ARTICLE_CATEGORIES } from "@/domain/articles/category";
import {
  COMMUNITY_KINDS,
  COMMUNITY_VISIBILITIES,
} from "@/domain/communities/kind";
import { CUSTOMER_TIERS } from "@/domain/customers/tier";
import { ATTACHMENT_CONTENT_TYPES } from "@/domain/messages/attachment";
import { MESSAGE_STATUSES } from "@/domain/messages/status";
import { MESSAGE_SUBJECTS } from "@/domain/messages/subject";
import { CANCELLATION_REASONS } from "@/domain/orders/cancellation";
import { DISCOUNT_KINDS } from "@/domain/orders/discount";
import { QUOTE_PROBLEM_CODES } from "@/domain/orders/quote";
import { ORDER_STATUSES } from "@/domain/orders/status";
import { CONTAINERS, PRODUCT_CATEGORIES } from "@/domain/products/category";
import { PRODUCT_SALE_STATUSES } from "@/domain/products/status";

/*
 * Forme des RÉPONSES de l'API, en zod : une seule source pour les types
 * TypeScript (z.infer, ce que views.ts construit) et pour la documentation
 * OpenAPI (openapi.ts). Elles ne valident rien à l'exécution : les tests
 * vérifient que chaque vue les respecte. Conventions : montants en centimes,
 * quantités en grammes ou pièces selon `unit`, instants ISO 8601, jours
 * AAAA-MM-JJ, heures HH:mm (Europe/Paris) ; chaque clé de vocabulaire est
 * accompagnée de son libellé français (`…Label`) pour que l'application
 * n'ait rien à traduire.
 */
const iso = z.iso.datetime({ offset: true }).meta({
  description: "Instant ISO 8601 (UTC).",
});
const day = z.iso.date().meta({ description: "Jour AAAA-MM-JJ." });
const cents = z.number().int().meta({ description: "Centimes d'euro." });
const unit = z.enum(["piece", "g"]);

export const listOf = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    nextCursor: z.string().nullable().meta({
      description:
        "À passer en ?cursor= pour la page suivante ; null à la fin.",
    }),
  });

export const okResponse = z.object({ ok: z.literal(true) });

export const errorResponse = z.object({
  error: z.object({
    code: z.string().meta({ description: "Code stable, en snake_case." }),
    message: z.string().meta({ description: "Explication en français." }),
    details: z.unknown().optional(),
  }),
});

/* ---------- Clients ---------- */

export const consentsResponse = z.object({
  offers: z.boolean(),
  orderStatus: z.boolean(),
  marketing: z.boolean(),
  updatedAt: iso.nullable(),
});

export const communityRefResponse = z.object({
  id: z.string(),
  name: z.string(),
});

export const loyaltyResponse = z.object({
  count: z.number().int(),
  threshold: z.number().int(),
  rewardReady: z.boolean(),
  remaining: z.number().int(),
  discountPercent: z.number().int(),
});

export const tierResponse = z.object({
  tier: z.enum(CUSTOMER_TIERS),
  label: z.string(),
  since: iso.nullable(),
  until: iso.nullable(),
});

export const nextDiscountResponse = z
  .object({
    kind: z.enum(DISCOUNT_KINDS),
    label: z.string(),
    percent: z.number().int(),
  })
  .nullable();

export const customerResponse = z.object({
  id: z.string(),
  fullName: z.string(),
  email: z.string(),
  phone: z.string(),
  addressLine: z.string().nullable(),
  city: z.string(),
  postalCode: z.string(),
  createdAt: iso,
  community: communityRefResponse
    .extend({ discountPercent: z.number().int() })
    .nullable(),
  consents: consentsResponse,
  referralCode: z.string().nullable(),
  referredBy: z.object({ fullName: z.string() }).nullable(),
  referralCount: z.number().int(),
  loyalty: loyaltyResponse,
  tier: tierResponse,
  nextDiscount: nextDiscountResponse,
});

export const codeSentResponse = z.object({
  ok: z.literal(true),
  expiresAt: iso.meta({ description: "Fin de validité du code envoyé." }),
});

export const sessionResponse = z.object({
  token: z.string().meta({
    description:
      "Jeton de session, remis une seule fois : à envoyer en « Authorization: Bearer ».",
  }),
  expiresAt: iso,
  created: z
    .boolean()
    .meta({ description: "Vrai si le compte vient d'être créé." }),
  customer: customerResponse,
});

/* ---------- Catalogue et contenus ---------- */

export const productResponse = z.object({
  id: z.string(),
  name: z.string(),
  variety: z.string().nullable(),
  category: z.enum(PRODUCT_CATEGORIES),
  categoryLabel: z.string(),
  unit,
  priceCents: cents.meta({
    description: "Par kilo si unit = g, par pièce sinon.",
  }),
  unitWeightGrams: z.number().int().nullable(),
  container: z.enum(CONTAINERS),
  originCountry: z.string(),
  originRegion: z.string().nullable(),
  caliber: z
    .object({ minMm: z.number().int(), maxMm: z.number().int() })
    .nullable(),
  organic: z.boolean(),
  inSeason: z.boolean(),
  saleStatus: z.enum(PRODUCT_SALE_STATUSES),
  saleStatusLabel: z.string(),
  stockQuantity: z.number().int(),
  illustration: z.string(),
  imageUrl: z.string().nullable(),
  updatedAt: iso,
});

export const catalogResponse = z.object({
  updatedAt: iso,
  settings: z.object({ sellWhenOutOfStock: z.boolean() }),
  deliveryFeeTiers: z.array(
    z.object({ minSubtotalCents: cents, feeCents: cents }),
  ),
  deliverySlotStarts: z.array(z.string()),
  bookingHorizonDays: z.number().int(),
  loyalty: z.object({
    threshold: z.number().int(),
    discountPercent: z.number().int(),
  }),
  communityDiscountTiers: z.array(
    z.object({ minMembers: z.number().int(), percent: z.number().int() }),
  ),
  products: z.array(productResponse),
});

export const articleResponse = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  category: z.enum(ARTICLE_CATEGORIES),
  categoryLabel: z.string(),
  illustration: z.string(),
  imageUrl: z.string().nullable(),
  publishedAt: day,
  updatedAt: iso,
});

export const communityResponse = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(COMMUNITY_KINDS),
  kindLabel: z.string(),
  visibility: z.enum(COMMUNITY_VISIBILITIES),
  visibilityLabel: z.string(),
  pickupPlace: z.string(),
  pickupCity: z.string(),
  pickupPostalCode: z.string(),
  memberCount: z.number().int(),
  discountPercent: z.number().int(),
});

/* ---------- Commandes ---------- */

export const discountResponse = z
  .object({
    kind: z.enum(DISCOUNT_KINDS),
    label: z.string(),
    percent: z.number().int(),
    amountCents: cents,
  })
  .nullable();

export const quoteLineResponse = z.object({
  productId: z.string(),
  productName: z.string(),
  unit,
  quantity: z.number().int(),
  unitPriceCents: cents,
  lineTotalCents: cents,
});

export const quoteResponse = z.object({
  lines: z.array(quoteLineResponse),
  subtotalCents: cents,
  discount: discountResponse,
  deliveryFeeCents: cents,
  totalCents: cents,
  community: communityRefResponse.nullable(),
});

export const quoteProblemResponse = z.object({
  productId: z.string(),
  code: z.enum(QUOTE_PROBLEM_CODES),
  message: z.string(),
});

export const orderLineResponse = z.object({
  productId: z.string(),
  productName: z.string(),
  unit,
  quantity: z.number().int(),
  lineTotalCents: cents,
});

export const orderResponse = z.object({
  id: z.string(),
  reference: z.string(),
  createdAt: iso,
  status: z.enum(ORDER_STATUSES),
  statusLabel: z.string(),
  deliverySlot: z.object({ date: day, start: z.string(), end: z.string() }),
  deliveryAddressLine: z.string().nullable(),
  deliveryCity: z.string(),
  deliveryPostalCode: z.string(),
  lines: z.array(orderLineResponse),
  subtotalCents: cents,
  discount: discountResponse,
  deliveryFeeCents: cents,
  totalCents: cents,
  cancellation: z
    .object({
      reason: z.enum(CANCELLATION_REASONS),
      label: z.string(),
      detail: z.string().nullable(),
    })
    .nullable(),
  community: communityRefResponse.nullable(),
  paymentReference: z.string().nullable(),
  cancellable: z.boolean().meta({
    description: "Vrai tant que la commande est en préparation.",
  }),
});

/* ---------- Messages et notifications ---------- */

export const messageAttachmentResponse = z.object({
  id: z.string(),
  fileName: z.string(),
  contentType: z.enum(ATTACHMENT_CONTENT_TYPES),
  sizeBytes: z.number().int(),
  url: z.string(),
});

export const messageResponse = z.object({
  id: z.string(),
  subject: z.enum(MESSAGE_SUBJECTS),
  subjectLabel: z.string(),
  body: z.string(),
  orderId: z.string().nullable(),
  orderReference: z.string().nullable(),
  status: z.enum(MESSAGE_STATUSES),
  statusLabel: z.string(),
  receivedAt: iso,
  handledAt: iso.nullable(),
  attachments: z.array(messageAttachmentResponse),
});

export const notificationResponse = z.object({
  id: z.string(),
  orderId: z.string(),
  orderReference: z.string(),
  orderStatus: z.enum(ORDER_STATUSES),
  title: z.string(),
  body: z.string(),
  createdAt: iso,
  sentAt: iso.nullable(),
});

export const pendingNotificationResponse = notificationResponse.extend({
  customerId: z.string(),
});

export type ApiCustomer = z.infer<typeof customerResponse>;
export type ApiSession = z.infer<typeof sessionResponse>;
export type ApiProduct = z.infer<typeof productResponse>;
export type ApiCatalog = z.infer<typeof catalogResponse>;
export type ApiArticle = z.infer<typeof articleResponse>;
export type ApiCommunity = z.infer<typeof communityResponse>;
export type ApiQuote = z.infer<typeof quoteResponse>;
export type ApiQuoteProblem = z.infer<typeof quoteProblemResponse>;
export type ApiOrder = z.infer<typeof orderResponse>;
export type ApiMessage = z.infer<typeof messageResponse>;
export type ApiNotification = z.infer<typeof notificationResponse>;
export type ApiPendingNotification = z.infer<
  typeof pendingNotificationResponse
>;
export type ApiListPage<T> = { items: T[]; nextCursor: string | null };
export type ApiErrorBody = z.infer<typeof errorResponse>;
