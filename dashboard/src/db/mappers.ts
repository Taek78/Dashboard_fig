import type {
  articles,
  authTokens,
  communities,
  customerMessages,
  customerNotes,
  customerNotifications,
  customers,
  engagementMonthly,
  messageAttachments,
  messageUploads,
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
import { fullName } from "@/domain/auth/rules";
import type { AuthToken } from "@/domain/auth/tokens";
import type { ManagedUser, UserAccount } from "@/domain/auth/types";
import type { Community, CommunityRef } from "@/domain/communities/types";
import type {
  Customer,
  CustomerNote,
  CustomerReferral,
  ReferrerRef,
} from "@/domain/customers/types";
import type { EngagementPoint } from "@/domain/engagement/types";
import type {
  Message,
  MessageAttachment,
  MessageOrder,
  MessageUpload,
} from "@/domain/messages/types";
import type { CustomerNotification } from "@/domain/notifications/types";
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
// Sans les colonnes de recherche calculées par la base : jamais lues, jamais mappées.
export type OrderRow = Omit<typeof orders.$inferSelect, "searchText">;
export type OrderLineRow = typeof orderLines.$inferSelect;
export type OrderEventRow = typeof orderEvents.$inferSelect;
export type CustomerRow = Omit<
  typeof customers.$inferSelect,
  "searchText" | "phoneDigits"
>;
export type CustomerNoteRow = typeof customerNotes.$inferSelect;
// Sans la colonne de recherche calculée par la base : jamais lue, jamais mappée.
export type MessageRow = Omit<
  typeof customerMessages.$inferSelect,
  "searchText"
>;
export type MessageAttachmentRow = typeof messageAttachments.$inferSelect;
/** Un téléversement lu SANS ses octets (liste, rattachement). */
export type MessageUploadMetaRow = Omit<
  typeof messageUploads.$inferSelect,
  "bytes"
>;
export type NotificationRow = typeof customerNotifications.$inferSelect;
export type ProductRow = typeof products.$inferSelect;
export type ArticleRow = typeof articles.$inferSelect;
export type EngagementRow = typeof engagementMonthly.$inferSelect;
export type UserRow = typeof users.$inferSelect;
export type StaffRow = typeof staff.$inferSelect;
export type CommunityRow = typeof communities.$inferSelect;

/** Ce qu'une commande ou un client portent d'une personne ou d'une communauté. */
export type StaffRefRow = Pick<StaffRow, "id" | "firstName" | "lastName">;
export type CommunityRefRow = Pick<CommunityRow, "id" | "name">;
/** Ce qu'un client porte de son parrain (jointure de customers sur elle-même). */
export type ReferrerRow = Pick<CustomerRow, "id" | "fullName">;

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

/** Lignes jointes à la commande : communauté, préparateur, livreur (null si absents) ; `wasDelivered` = un événement d'historique a déjà mené la commande à « livrée » (EXISTS calculé par la base). */
export type OrderJoins = {
  community: CommunityRefRow | null;
  preparer: StaffRefRow | null;
  driver: StaffRefRow | null;
};

export function toOrder(
  row: OrderRow,
  customer: Pick<
    CustomerRow,
    "id" | "fullName" | "email" | "phone" | "notifyOrderStatus"
  >,
  lines: readonly OrderLineRow[],
  joins: OrderJoins & { wasDelivered: boolean },
): Order {
  return {
    id: row.id,
    reference: row.reference,
    createdAt: row.createdAt.toISOString(),
    status: row.status,
    wasDelivered: joins.wasDelivered,
    customer: {
      id: customer.id,
      fullName: customer.fullName,
      email: customer.email,
      phone: customer.phone,
      notifyOrderStatus: customer.notifyOrderStatus,
    },
    deliverySlot: {
      date: row.deliveryDate,
      start: row.deliveryStart,
      end: row.deliveryEnd,
    },
    deliveryAddressLine: row.deliveryAddressLine,
    deliveryCity: row.deliveryCity,
    deliveryPostalCode: row.deliveryPostalCode,
    lines: [...lines]
      .toSorted((a, b) => a.position - b.position)
      .map(toOrderLine),
    deliveryFeeCents: row.deliveryFeeCents,
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
    paymentReference: row.paymentReference,
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

export function toMessageAttachment(
  row: MessageAttachmentRow,
): MessageAttachment {
  return {
    id: row.id,
    fileName: row.fileName,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    uploadId: row.uploadId,
    url: row.url,
  };
}

/** Les métadonnées d'un fichier téléversé, sans ses octets. */
export function toMessageUpload(row: MessageUploadMetaRow): MessageUpload {
  return {
    id: row.id,
    customerId: row.customerId,
    fileName: row.fileName,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    createdAt: row.createdAt.toISOString(),
    attachedAt: row.attachedAt?.toISOString() ?? null,
  };
}

/** Ce qu'un message porte de la commande que le client a jointe : la commande et ses jointures. */
export type MessageOrderRow = Pick<
  OrderRow,
  | "id"
  | "reference"
  | "createdAt"
  | "status"
  | "deliveryDate"
  | "deliveryStart"
  | "deliveryEnd"
  | "deliveryAddressLine"
  | "deliveryCity"
  | "deliveryPostalCode"
>;
export type MessageOrderJoins = { order: MessageOrderRow } & OrderJoins;

export function toMessageOrder(joins: MessageOrderJoins): MessageOrder {
  const { order } = joins;
  return {
    id: order.id,
    reference: order.reference,
    createdAt: order.createdAt.toISOString(),
    status: order.status,
    deliverySlot: {
      date: order.deliveryDate,
      start: order.deliveryStart,
      end: order.deliveryEnd,
    },
    deliveryAddressLine: order.deliveryAddressLine,
    deliveryCity: order.deliveryCity,
    deliveryPostalCode: order.deliveryPostalCode,
    community: toCommunityRef(joins.community),
    preparer: toStaffRef(joins.preparer),
    driver: toStaffRef(joins.driver),
  };
}

/** Ce qu'un message porte de son auteur et de la commande qu'il cite. */
export type MessageJoins = {
  customer: Pick<CustomerRow, "id" | "fullName" | "email">;
  order: MessageOrderJoins | null;
};

export function toMessage(
  row: MessageRow,
  attachments: readonly MessageAttachmentRow[],
  joins: MessageJoins,
): Message {
  return {
    id: row.id,
    customer: {
      id: joins.customer.id,
      fullName: joins.customer.fullName,
      email: joins.customer.email,
    },
    subject: row.subject,
    body: row.body,
    order: joins.order === null ? null : toMessageOrder(joins.order),
    attachments: [...attachments]
      .toSorted((a, b) => a.position - b.position)
      .map(toMessageAttachment),
    status: row.status,
    receivedAt: row.receivedAt.toISOString(),
    pinnedAt: row.pinnedAt?.toISOString() ?? null,
    important: row.important,
    handledAt: row.handledAt?.toISOString() ?? null,
    handledByName: row.handledByName,
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

export function toReferrerRef(row: ReferrerRow | null): ReferrerRef | null {
  return row === null ? null : { id: row.id, fullName: row.fullName };
}

export function toCustomer(
  row: CustomerRow,
  notes: readonly CustomerNoteRow[],
  community: CommunityRefRow | null,
  referrer: ReferrerRow | null = null,
): Customer {
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    addressLine: row.addressLine,
    city: row.city,
    postalCode: row.postalCode,
    createdAt: row.createdAt.toISOString(),
    community: toCommunityRef(community),
    consents: {
      offers: row.notifyOffers,
      orderStatus: row.notifyOrderStatus,
      marketing: row.marketingConsent,
      updatedAt: row.consentsUpdatedAt?.toISOString() ?? null,
    },
    referralCode: row.referralCode,
    referredBy: toReferrerRef(referrer),
    notes: [...notes]
      .toSorted((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map(toCustomerNote),
    anonymizedAt: row.anonymizedAt?.toISOString() ?? null,
  };
}

/** Un filleul, tel que la fiche de son parrain le liste. */
export function toCustomerReferral(
  row: Pick<CustomerRow, "id" | "fullName" | "createdAt">,
): CustomerReferral {
  return {
    id: row.id,
    fullName: row.fullName,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toCustomerNotification(
  row: NotificationRow,
  order: Pick<OrderRow, "id" | "reference">,
): CustomerNotification {
  return {
    id: row.id,
    customerId: row.customerId,
    order: { id: order.id, reference: order.reference },
    kind: row.kind,
    orderStatus: row.orderStatus,
    title: row.title,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    sentAt: row.sentAt?.toISOString() ?? null,
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
    visibility: row.visibility,
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    pickupPlace: row.pickupPlace,
    pickupCity: row.pickupCity,
    pickupPostalCode: row.pickupPostalCode,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
  };
}

/** `invitationExpiresAt` : expiration du dernier lien d'invitation, jointe par la source (null si aucun). */
export function toManagedUser(
  row: UserRow,
  invitationExpiresAt: Date | null = null,
): ManagedUser {
  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    name: fullName(row),
    role: row.role,
    active: row.active,
    hasPassword: row.passwordHash !== null,
    invitationExpiresAt: invitationExpiresAt?.toISOString() ?? null,
    invitationMail:
      row.invitationMailFailedAt && row.invitationMailError
        ? {
            state: "failed",
            at: row.invitationMailFailedAt.toISOString(),
            reason: row.invitationMailError,
          }
        : row.invitationMailSentAt
          ? { state: "sent", at: row.invitationMailSentAt.toISOString() }
          : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toUserAccount(row: UserRow): UserAccount {
  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    name: fullName(row),
    role: row.role,
    passwordHash: row.passwordHash,
    active: row.active,
    passwordChangedAt: row.passwordChangedAt?.toISOString() ?? null,
  };
}

export type AuthTokenRow = typeof authTokens.$inferSelect;

export function toAuthToken(row: AuthTokenRow): AuthToken {
  return {
    id: row.id,
    kind: row.kind,
    userId: row.userId,
    secretHash: row.secretHash,
    expiresAt: row.expiresAt.toISOString(),
    attempts: row.attempts,
    consumedAt: row.consumedAt?.toISOString() ?? null,
    requestedIp: row.requestedIp,
    createdAt: row.createdAt.toISOString(),
  };
}
