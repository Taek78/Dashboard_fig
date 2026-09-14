import type {
  articles,
  communities,
  customerNotes,
  customers,
  engagementMonthly,
  orderEvents,
  orderLines,
  orders,
  products,
  staff,
  users,
} from "@/db/schema";
import type {
  ArticleCategory,
  ArticleIllustration,
} from "@/domain/articles/category";
import type { Article, ArticleInput } from "@/domain/articles/types";
import type { ManagedUser, UserAccount } from "@/domain/auth/types";
import type { Community, CommunityRef } from "@/domain/communities/types";
import type { Customer, CustomerNote } from "@/domain/customers/types";
import type { EngagementPoint } from "@/domain/engagement/types";
import type { StaffRef } from "@/domain/orders/assignment";
import type { Cancellation } from "@/domain/orders/cancellation";
import type { OrderDiscount } from "@/domain/orders/discount";
import type { Order, OrderEvent, OrderLine } from "@/domain/orders/types";
import type { Illustration, OriginCountry } from "@/domain/products/category";
import type { Product, ProductInput } from "@/domain/products/types";
import type { Weekday } from "@/domain/staff/kind";
import type { StaffInput, StaffMember } from "@/domain/staff/types";

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
export type StaffRow = typeof staff.$inferSelect;
export type CommunityRow = typeof communities.$inferSelect;

/** Ce qu'une commande ou un client portent d'une personne ou d'une communauté. */
export type StaffRefRow = Pick<StaffRow, "id" | "firstName" | "lastName">;
export type CommunityRefRow = Pick<CommunityRow, "id" | "name">;

export function toStaffRef(row: StaffRefRow | null): StaffRef | null {
  return row === null
    ? null
    : { id: row.id, name: `${row.firstName} ${row.lastName}`.trim() };
}

export function toCommunityRef(
  row: CommunityRefRow | null,
): CommunityRef | null {
  return row === null ? null : { id: row.id, name: row.name };
}

function toDiscount(
  kind: OrderRow["discountKind"],
  percent: number | null,
  amountCents: number,
): OrderDiscount | null {
  return kind === null || percent === null
    ? null
    : { kind, percent, amountCents };
}

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

/** Lignes jointes à la commande : communauté, préparateur, livreur (null si absents). */
export type OrderJoins = {
  community: CommunityRefRow | null;
  preparer: StaffRefRow | null;
  driver: StaffRefRow | null;
};

export function toOrder(
  row: OrderRow,
  customer: Pick<CustomerRow, "id" | "fullName" | "email" | "phone">,
  lines: readonly OrderLineRow[],
  joins: OrderJoins,
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
    community: toCommunityRef(joins.community),
    discount: toDiscount(
      row.discountKind,
      row.discountPercent,
      row.discountCents,
    ),
    preparer: toStaffRef(joins.preparer),
    driver: toStaffRef(joins.driver),
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
  community: CommunityRefRow | null,
): Customer {
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    city: row.city,
    postalCode: row.postalCode,
    createdAt: row.createdAt.toISOString(),
    community: toCommunityRef(community),
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

export function toStaffMember(row: StaffRow): StaffMember {
  return {
    id: row.id,
    kind: row.kind,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone,
    shift: row.shift,
    availability: row.availability,
    // La colonne est un tableau de texte ; le domaine le type plus strictement.
    workDays: row.workDays as Weekday[],
    startedAt: row.startedAt,
    notes: row.notes,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Colonnes à écrire pour une personne (l'id et created_at sont posés par l'appelant). */
export function staffToRow(
  input: StaffInput,
): Omit<typeof staff.$inferInsert, "id" | "createdAt"> {
  return {
    kind: input.kind,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    phone: input.phone,
    shift: input.shift,
    availability: input.availability,
    workDays: [...input.workDays],
    startedAt: input.startedAt,
    notes: input.notes,
    active: input.active,
  };
}

export function toCommunity(row: CommunityRow): Community {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    pickupPlace: row.pickupPlace,
    pickupCity: row.pickupCity,
    pickupPostalCode: row.pickupPostalCode,
    pickupTime: row.pickupTime,
    discountPercent: row.discountPercent,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toManagedUser(row: UserRow): ManagedUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
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
