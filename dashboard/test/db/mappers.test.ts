import { describe, expect, it } from "vitest";
import {
  articleToRow,
  productToRow,
  toArticle,
  toCustomer,
  toCustomerNotification,
  toCustomerReferral,
  toEngagementPoint,
  toMessage,
  toOrder,
  toOrderEvent,
  toProduct,
  toStaffMember,
  toCommunity,
  staffToRow,
  toAuthToken,
  toManagedUser,
  toUserAccount,
  type ArticleRow,
  type CustomerNoteRow,
  type CustomerRow,
  type MessageAttachmentRow,
  type MessageOrderJoins,
  type MessageRow,
  type NotificationRow,
  type OrderEventRow,
  type OrderLineRow,
  type OrderRow,
  type ProductRow,
} from "@/db/mappers";
import { articlesFixtures } from "@/domain/articles/fixtures";
import { communitiesFixtures } from "@/domain/communities/fixtures";
import { customersFixtures } from "@/domain/customers/fixtures";
import type { Customer } from "@/domain/customers/types";
import { messagesFixtures } from "@/domain/messages/fixtures";
import { notificationsFixtures } from "@/domain/notifications/fixtures";
import { orderEventsFixtures, ordersFixtures } from "@/domain/orders/fixtures";
import type { Order } from "@/domain/orders/types";
import { productsFixtures } from "@/domain/products/fixtures";
import { staffFixtures } from "@/domain/staff/fixtures";

/** Retire id et updatedAt : ce que le formulaire fournit (ProductInput, ArticleInput). */
function withoutMeta<T extends { id: string; updatedAt: string }>(
  entity: T,
): Omit<T, "id" | "updatedAt"> {
  const copy: Partial<T> = { ...entity };
  delete copy.id;
  delete copy.updatedAt;
  return copy as Omit<T, "id" | "updatedAt">;
}

/** Une ligne `customers` telle que le seed l'écrit. */
function customerRow(c: Customer): CustomerRow {
  return {
    id: c.id,
    fullName: c.fullName,
    email: c.email,
    phone: c.phone,
    addressLine: c.addressLine,
    city: c.city,
    postalCode: c.postalCode,
    communityId: c.community?.id ?? null,
    notifyOffers: c.consents.offers,
    notifyOrderStatus: c.consents.orderStatus,
    marketingConsent: c.consents.marketing,
    consentsUpdatedAt:
      c.consents.updatedAt === null ? null : new Date(c.consents.updatedAt),
    referralCode: c.referralCode,
    referredById: c.referredBy?.id ?? null,
    createdAt: new Date(c.createdAt),
    anonymizedAt: c.anonymizedAt === null ? null : new Date(c.anonymizedAt),
  };
}

/** Une ligne `orders` telle que le seed l'écrit. */
function orderRow(o: Order): OrderRow {
  return {
    id: o.id,
    reference: o.reference,
    createdAt: new Date(o.createdAt),
    status: o.status,
    customerId: o.customer.id,
    deliveryDate: o.deliverySlot.date,
    deliveryStart: o.deliverySlot.start,
    deliveryEnd: o.deliverySlot.end,
    deliveryAddressLine: o.deliveryAddressLine,
    deliveryCity: o.deliveryCity,
    deliveryPostalCode: o.deliveryPostalCode,
    deliveryFeeCents: o.deliveryFeeCents,
    totalCents: o.totalCents,
    cancellationReason: o.cancellation?.reason ?? null,
    cancellationDetail: o.cancellation?.detail ?? null,
    communityId: o.community?.id ?? null,
    discountKind: o.discount?.kind ?? null,
    discountPercent: o.discount?.percent ?? null,
    discountCents: o.discount?.amountCents ?? 0,
    preparerId: o.preparer?.id ?? null,
    driverId: o.driver?.id ?? null,
    paymentReference: o.paymentReference,
  };
}

const person = (ref: { id: string; name: string } | null) =>
  ref === null
    ? null
    : {
        id: ref.id,
        firstName: ref.name.split(" ")[0]!,
        lastName: ref.name.split(" ").slice(1).join(" "),
      };

/*
 * Aller-retour : une fixture transformée en lignes (comme le seed) puis
 * remappée doit redonner la fixture. Garantit que l'écran ne change pas quand
 * DATA_SOURCE passe de mock à db.
 */
describe("toOrder / toOrderEvent", () => {
  it("reconstitue chaque commande des fixtures à partir de ses lignes", () => {
    for (const o of ordersFixtures) {
      const customer: CustomerRow = {
        ...customerRow(customersFixtures[0]!),
        id: o.customer.id,
        fullName: o.customer.fullName,
        email: o.customer.email,
        phone: o.customer.phone,
        notifyOrderStatus: o.customer.notifyOrderStatus,
      };
      // Lignes fournies dans le désordre : le mapper remet l'ordre des positions.
      const lines: OrderLineRow[] = o.lines
        .map((l, position) => ({
          orderId: o.id,
          position,
          productId: l.productId,
          productName: l.productName,
          quantity: l.quantity,
          unit: l.unit,
          lineTotalCents: l.lineTotalCents,
        }))
        .toReversed();
      expect(
        toOrder(orderRow(o), customer, lines, {
          community: o.community,
          preparer: person(o.preparer),
          driver: person(o.driver),
          wasDelivered: o.wasDelivered,
        }),
      ).toEqual(o);
    }
  });

  it("reconstitue les événements", () => {
    for (const e of orderEventsFixtures) {
      const row: OrderEventRow = {
        id: e.id,
        orderId: e.orderId,
        fromStatus: e.from,
        toStatus: e.to,
        actorId: e.actor.id,
        actorName: e.actor.name,
        cancellationReason: e.cancellation?.reason ?? null,
        cancellationDetail: e.cancellation?.detail ?? null,
        at: new Date(e.at),
      };
      expect(toOrderEvent(row)).toEqual(e);
    }
  });
});

describe("toMessage", () => {
  it("reconstitue chaque message des fixtures, pièces jointes remises en ordre, commande jointe comprise", () => {
    for (const m of messagesFixtures) {
      const row: MessageRow = {
        id: m.id,
        customerId: m.customer.id,
        subject: m.subject,
        body: m.body,
        orderId: m.order?.id ?? null,
        status: m.status,
        receivedAt: new Date(m.receivedAt),
        pinnedAt: m.pinnedAt === null ? null : new Date(m.pinnedAt),
        important: m.important,
        handledAt: m.handledAt === null ? null : new Date(m.handledAt),
        handledByName: m.handledByName,
      };
      // Pièces jointes fournies dans le désordre : le mapper remet les positions.
      const attachments: MessageAttachmentRow[] = m.attachments
        .map((a, position) => ({
          id: a.id,
          messageId: m.id,
          position,
          fileName: a.fileName,
          contentType: a.contentType,
          sizeBytes: a.sizeBytes,
          uploadId: a.uploadId,
          url: a.url,
        }))
        .toReversed();
      const joined = m.order
        ? ordersFixtures.find((o) => o.id === m.order?.id)
        : undefined;
      const order: MessageOrderJoins | null = joined
        ? {
            order: orderRow(joined),
            community: joined.community,
            preparer: person(joined.preparer),
            driver: person(joined.driver),
          }
        : null;
      expect(
        toMessage(row, attachments, {
          customer: {
            id: m.customer.id,
            fullName: m.customer.fullName,
            email: m.customer.email,
          },
          order,
        }),
      ).toEqual(m);
    }
  });
});

describe("toCustomerNotification", () => {
  it("reconstitue chaque notification des fixtures avec la référence de sa commande", () => {
    expect(notificationsFixtures.length).toBeGreaterThan(0);
    for (const n of notificationsFixtures) {
      const row: NotificationRow = {
        id: n.id,
        customerId: n.customerId,
        orderId: n.order.id,
        kind: n.kind,
        orderStatus: n.orderStatus,
        title: n.title,
        body: n.body,
        createdAt: new Date(n.createdAt),
        sentAt: n.sentAt === null ? null : new Date(n.sentAt),
        failedAt: n.failedAt === null ? null : new Date(n.failedAt),
        failureReason: n.failureReason,
      };
      expect(toCustomerNotification(row, n.order)).toEqual(n);
    }
  });
});

describe("toProduct / productToRow", () => {
  it("fait l'aller-retour sur chaque produit des fixtures", () => {
    for (const p of productsFixtures) {
      const columns = productToRow(withoutMeta(p));
      const row: ProductRow = {
        id: p.id,
        updatedAt: new Date(p.updatedAt),
        name: columns.name,
        variety: columns.variety ?? null,
        category: columns.category,
        unit: columns.unit,
        priceCents: columns.priceCents,
        unitWeightGrams: columns.unitWeightGrams ?? null,
        container: columns.container ?? "none",
        originCountry: columns.originCountry ?? "FR",
        originRegion: columns.originRegion ?? null,
        caliberMinMm: columns.caliberMinMm ?? null,
        caliberMaxMm: columns.caliberMaxMm ?? null,
        organic: columns.organic ?? false,
        inSeason: columns.inSeason ?? false,
        available: columns.available ?? true,
        visible: columns.visible ?? true,
        stockQuantity: columns.stockQuantity ?? 0,
        illustration: columns.illustration,
        imageUrl: columns.imageUrl ?? null,
      };
      expect(toProduct(row)).toEqual(p);
    }
  });
});

describe("toCustomer / toCustomerReferral", () => {
  it("rattache les notes dans l'ordre chronologique, le parrain et les autorisations", () => {
    for (const c of customersFixtures) {
      const notes: CustomerNoteRow[] = c.notes
        .map((n) => ({
          id: n.id,
          customerId: c.id,
          text: n.text,
          authorName: n.authorName,
          createdAt: new Date(n.createdAt),
        }))
        .toReversed();
      expect(
        toCustomer(customerRow(c), notes, c.community, c.referredBy),
      ).toEqual(c);
    }
    expect(customersFixtures.some((c) => c.referredBy !== null)).toBe(true);
  });

  it("rend la date d'anonymisation en ISO, sans parrain ni code", () => {
    const [c] = customersFixtures;
    const row: CustomerRow = {
      ...customerRow(c!),
      fullName: "Client anonymisé",
      email: `anonyme-${c!.id}@anonyme.invalid`,
      phone: "",
      addressLine: null,
      city: "",
      postalCode: "",
      communityId: null,
      referralCode: null,
      referredById: null,
      anonymizedAt: new Date("2026-09-15T10:00:00.000Z"),
    };
    const mapped = toCustomer(row, [], null, null);
    expect(mapped.anonymizedAt).toBe("2026-09-15T10:00:00.000Z");
    expect(mapped.referralCode).toBeNull();
    expect(mapped.referredBy).toBeNull();
  });

  it("un filleul ne porte que son nom et sa date d'inscription", () => {
    expect(
      toCustomerReferral({
        id: "cli-0002",
        fullName: "Théo Marchand",
        createdAt: new Date("2026-04-02T08:30:00.000Z"),
      }),
    ).toEqual({
      id: "cli-0002",
      fullName: "Théo Marchand",
      createdAt: "2026-04-02T08:30:00.000Z",
    });
  });
});

describe("toStaffMember / staffToRow / toCommunity", () => {
  it("fait l'aller-retour sur chaque personne des fixtures", () => {
    for (const m of staffFixtures) {
      const { id, createdAt, ...input } = m;
      const columns = staffToRow(input);
      expect(
        toStaffMember({
          id,
          createdAt: new Date(createdAt),
          ...columns,
          notes: columns.notes ?? null,
          active: columns.active ?? true,
          leftAt: columns.leftAt ?? null,
        }),
      ).toEqual(m);
    }
  });

  it("reconstitue chaque communauté des fixtures", () => {
    for (const c of communitiesFixtures) {
      expect(toCommunity({ ...c, createdAt: new Date(c.createdAt) })).toEqual(
        c,
      );
    }
  });
});

describe("toArticle / articleToRow", () => {
  it("fait l'aller-retour sur chaque article des fixtures", () => {
    for (const a of articlesFixtures) {
      const columns = articleToRow(withoutMeta(a));
      const row: ArticleRow = {
        id: a.id,
        updatedAt: new Date(a.updatedAt),
        title: columns.title,
        body: columns.body,
        category: columns.category,
        illustration: columns.illustration,
        imageUrl: columns.imageUrl ?? null,
        publishedAt: columns.publishedAt,
        visible: columns.visible ?? true,
      };
      expect(toArticle(row)).toEqual(a);
    }
  });
});

describe("toEngagementPoint / toUserAccount", () => {
  it("convertit la note numeric (chaîne) en nombre, null conservé", () => {
    expect(
      toEngagementPoint({
        month: "2026-09",
        downloads: 10,
        signups: 3,
        rating: "4.35",
        ratingCount: 12,
      }),
    ).toEqual({
      month: "2026-09",
      downloads: 10,
      signups: 3,
      rating: 4.35,
      ratingCount: 12,
    });
    expect(
      toEngagementPoint({
        month: "2026-01",
        downloads: 0,
        signups: 0,
        rating: null,
        ratingCount: 0,
      }).rating,
    ).toBeNull();
  });

  it("ne garde d'un compte que ce que le contrat expose", () => {
    const row = {
      id: "usr-1",
      email: "a@b.invalid",
      firstName: "A",
      lastName: "B",
      role: "admin" as const,
      passwordHash: "scrypt$x$y",
      active: true,
      passwordChangedAt: new Date("2026-09-17T10:00:00.000Z"),
      invitationExpiredAt: null,
      invitationMailFailedAt: null,
      invitationMailError: null,
      invitationMailSentAt: null,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    expect(toUserAccount(row)).toEqual({
      id: "usr-1",
      email: "a@b.invalid",
      firstName: "A",
      lastName: "B",
      name: "A B",
      role: "admin",
      passwordHash: "scrypt$x$y",
      active: true,
      passwordChangedAt: "2026-09-17T10:00:00.000Z",
    });
    expect(
      toUserAccount({ ...row, passwordHash: null, passwordChangedAt: null }),
    ).toMatchObject({ passwordHash: null, passwordChangedAt: null });
    expect(toManagedUser(row)).toEqual({
      id: "usr-1",
      email: "a@b.invalid",
      firstName: "A",
      lastName: "B",
      name: "A B",
      role: "admin",
      active: true,
      hasPassword: true,
      invitationExpiresAt: null,
      invitationMail: null,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(toManagedUser({ ...row, passwordHash: null }).hasPassword).toBe(
      false,
    );
    // L'issue du dernier envoi : l'échec l'emporte sur un envoi confirmé plus ancien.
    expect(
      toManagedUser({
        ...row,
        invitationMailSentAt: new Date("2026-09-17T09:00:00.000Z"),
      }).invitationMail,
    ).toEqual({ state: "sent", at: "2026-09-17T09:00:00.000Z" });
    expect(
      toManagedUser({
        ...row,
        invitationMailSentAt: new Date("2026-09-17T09:00:00.000Z"),
        invitationMailFailedAt: new Date("2026-09-17T11:00:00.000Z"),
        invitationMailError: "adresse_refusee" as const,
      }).invitationMail,
    ).toEqual({
      state: "failed",
      at: "2026-09-17T11:00:00.000Z",
      reason: "adresse_refusee",
    });
    // L'expiration du dernier lien d'invitation, jointe par la source, passe en ISO.
    expect(
      toManagedUser(row, new Date("2026-09-19T10:00:00.000Z"))
        .invitationExpiresAt,
    ).toBe("2026-09-19T10:00:00.000Z");
  });

  it("convertit un jeton d'authentification, dates en ISO", () => {
    expect(
      toAuthToken({
        id: "tok-1",
        kind: "recovery_code",
        userId: "usr-1",
        secretHash: "abc",
        expiresAt: new Date("2026-09-17T10:05:00.000Z"),
        attempts: 2,
        consumedAt: null,
        requestedIp: "203.0.113.5",
        createdAt: new Date("2026-09-17T10:00:00.000Z"),
      }),
    ).toEqual({
      id: "tok-1",
      kind: "recovery_code",
      userId: "usr-1",
      secretHash: "abc",
      expiresAt: "2026-09-17T10:05:00.000Z",
      attempts: 2,
      consumedAt: null,
      requestedIp: "203.0.113.5",
      createdAt: "2026-09-17T10:00:00.000Z",
    });
  });
});
