import type {
  articles,
  customerNotes,
  customers,
  engagementMonthly,
  orderEvents,
  orderLines,
  orders,
  products,
  users,
} from "@/db/schema";
import type {
  ArticleCategory,
  ArticleIllustration,
} from "@/domain/articles/category";
import type { Article, ArticleInput } from "@/domain/articles/types";
import type { UserAccount } from "@/domain/auth/types";
import type { Customer, CustomerNote } from "@/domain/customers/types";
import type { EngagementPoint } from "@/domain/engagement/types";
import type { Cancellation } from "@/domain/orders/cancellation";
import type { Order, OrderEvent, OrderLine } from "@/domain/orders/types";
import type { Illustration, OriginCountry } from "@/domain/products/category";
import type { Product, ProductInput } from "@/domain/products/types";

/*
 * Mappers PURS entre les lignes Drizzle et les types métier du front (règle 1
 * du découplage : la source renvoie des types métier, jamais des lignes). Seul
 * lieu de conversion de noms de colonnes, de dates et de nullabilité. Chaque
 * fonction déclare son type de retour et construit un objet littéral.
 * Sans server-only ni client : testés dans test/db/mappers.test.ts.
 */
export type OrderRow = typeof orders.$inferSelect;
export type OrderLineRow = typeof orderLines.$inferSelect;
export type OrderEventRow = typeof orderEvents.$inferSelect;
export type CustomerRow = typeof customers.$inferSelect;
export type CustomerNoteRow = typeof customerNotes.$inferSelect;
export type ProductRow = typeof products.$inferSelect;
export type ArticleRow = typeof articles.$inferSelect;
export type EngagementRow = typeof engagementMonthly.$inferSelect;
export type UserRow = typeof users.$inferSelect;

function toCancellation(
  reason: OrderRow["cancellationReason"],
  detail: string | null,
): Cancellation | null {
  return reason === null ? null : { reason, detail };
}

export function toOrderLine(row: OrderLineRow): OrderLine {
  return {
    productId: row.productId,
    productName: row.productName,
    quantity: row.quantity,
    unit: row.unit,
    lineTotalCents: row.lineTotalCents,
  };
}

export function toOrder(
  row: OrderRow,
  customer: Pick<CustomerRow, "id" | "fullName" | "email" | "phone">,
  lines: readonly OrderLineRow[],
): Order {
  return {
    id: row.id,
    reference: row.reference,
    createdAt: row.createdAt.toISOString(),
    status: row.status,
    customer: {
      id: customer.id,
      fullName: customer.fullName,
      email: customer.email,
      phone: customer.phone,
    },
    deliverySlot: {
      date: row.deliveryDate,
      start: row.deliveryStart,
      end: row.deliveryEnd,
    },
    deliveryCity: row.deliveryCity,
    deliveryPostalCode: row.deliveryPostalCode,
    lines: [...lines]
      .toSorted((a, b) => a.position - b.position)
      .map(toOrderLine),
    totalCents: row.totalCents,
    cancellation: toCancellation(
      row.cancellationReason,
      row.cancellationDetail,
    ),
  };
}

export function toOrderEvent(row: OrderEventRow): OrderEvent {
  return {
    id: row.id,
    orderId: row.orderId,
    from: row.fromStatus,
    to: row.toStatus,
    actor: { id: row.actorId, name: row.actorName },
    cancellation: toCancellation(
      row.cancellationReason,
      row.cancellationDetail,
    ),
    at: row.at.toISOString(),
  };
}

export function toCustomerNote(row: CustomerNoteRow): CustomerNote {
  return {
    id: row.id,
    text: row.text,
    authorName: row.authorName,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toCustomer(
  row: CustomerRow,
  notes: readonly CustomerNoteRow[],
): Customer {
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    city: row.city,
    postalCode: row.postalCode,
    createdAt: row.createdAt.toISOString(),
    notes: [...notes]
      .toSorted((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map(toCustomerNote),
  };
}

export function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    variety: row.variety,
    category: row.category,
    unit: row.unit,
    priceCents: row.priceCents,
    unitWeightGrams: row.unitWeightGrams,
    container: row.container,
    // Le pays est une chaîne libre en base ; le domaine le typé plus strictement.
    originCountry: row.originCountry as OriginCountry,
    originRegion: row.originRegion,
    caliber:
      row.caliberMinMm !== null && row.caliberMaxMm !== null
        ? { minMm: row.caliberMinMm, maxMm: row.caliberMaxMm }
        : null,
    organic: row.organic,
    inSeason: row.inSeason,
    available: row.available,
    visible: row.visible,
    stockQuantity: row.stockQuantity,
    illustration: row.illustration as Illustration,
    imageUrl: row.imageUrl,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Colonnes à écrire pour un produit (l'id et updated_at sont posés par l'appelant). */
export function productToRow(
  input: ProductInput,
): Omit<typeof products.$inferInsert, "id" | "updatedAt"> {
  return {
    name: input.name,
    variety: input.variety,
    category: input.category,
    unit: input.unit,
    priceCents: input.priceCents,
    unitWeightGrams: input.unit === "piece" ? input.unitWeightGrams : null,
    container: input.container,
    originCountry: input.originCountry,
    originRegion: input.originRegion,
    caliberMinMm: input.caliber?.minMm ?? null,
    caliberMaxMm: input.caliber?.maxMm ?? null,
    organic: input.organic,
    inSeason: input.inSeason,
    available: input.available,
    visible: input.visible,
    stockQuantity: input.stockQuantity,
    illustration: input.illustration,
    imageUrl: input.imageUrl,
  };
}

export function toArticle(row: ArticleRow): Article {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    category: row.category as ArticleCategory,
    illustration: row.illustration as ArticleIllustration,
    imageUrl: row.imageUrl,
    publishedAt: row.publishedAt,
    visible: row.visible,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function articleToRow(
  input: ArticleInput,
): Omit<typeof articles.$inferInsert, "id" | "updatedAt"> {
  return {
    title: input.title,
    body: input.body,
    category: input.category,
    illustration: input.illustration,
    imageUrl: input.imageUrl,
    publishedAt: input.publishedAt,
    visible: input.visible,
  };
}

export function toEngagementPoint(row: EngagementRow): EngagementPoint {
  return {
    month: row.month,
    downloads: row.downloads,
    signups: row.signups,
    complaints: row.complaints,
    // numeric arrive en chaîne depuis postgres.js : on retourne au nombre.
    rating: row.rating === null ? null : Number(row.rating),
    ratingCount: row.ratingCount,
  };
}

export function toUserAccount(row: UserRow): UserAccount {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    passwordHash: row.passwordHash,
  };
}
