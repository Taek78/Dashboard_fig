import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";
import { articlesFixtures } from "@/domain/articles/fixtures";
import { communitiesFixtures } from "@/domain/communities/fixtures";
import { customersFixtures } from "@/domain/customers/fixtures";
import { engagementFixtures } from "@/domain/engagement/fixtures";
import { messagesFixtures } from "@/domain/messages/fixtures";
import { notificationsFixtures } from "@/domain/notifications/fixtures";
import { orderEventsFixtures, ordersFixtures } from "@/domain/orders/fixtures";
import { productsFixtures } from "@/domain/products/fixtures";
import { staffFixtures } from "@/domain/staff/fixtures";
import { hashPassword } from "@/lib/password";

/*
 * Remplissage d'une base avec les données FICTIVES du projet (fixtures des
 * domaines) et des comptes du back-office. Partagé par :
 *   - `npm run db:seed` (scripts/seed.ts) : la base locale de développement,
 *     comptes lus dans l'environnement ;
 *   - Vitest et Playwright (test/support/global-setup.ts) : la base de test,
 *     comptes de test publics.
 * Tout est effacé puis réinséré dans UNE transaction : la base repart toujours
 * du même état. Refuse un hôte distant (assertLocalDatabase) : ce code n'a rien
 * à faire sur une base partagée. Hors Next : aucun module server-only.
 */
export type SeedAccount = { email: string; password: string; name: string };
export type SeedAccounts = { admin: SeedAccount; manager?: SeedAccount };
export type SeedDb = PostgresJsDatabase<typeof schema>;

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1"];

/** Lève si l'URL ne vise pas une base locale (SEED_ALLOW_REMOTE=1 pour forcer). */
export function assertLocalDatabase(url: string): void {
  const host = new URL(url).hostname;
  if (!LOCAL_HOSTS.includes(host) && process.env.SEED_ALLOW_REMOTE !== "1") {
    throw new Error(
      `Hôte ${host} refusé : le seed ne vise qu'une base locale (SEED_ALLOW_REMOTE=1 pour forcer).`,
    );
  }
}

/** Insère par paquets de 400 lignes : postgres.js limite les paramètres d'une requête. */
async function inChunks<T>(
  rows: readonly T[],
  insert: (part: T[]) => Promise<unknown>,
  size = 400,
): Promise<void> {
  for (let i = 0; i < rows.length; i += size) {
    await insert(rows.slice(i, i + size));
  }
}

/** Vide et remplit la base ; renvoie le résumé des lignes insérées. */
export async function seedDatabase(
  db: SeedDb,
  { admin, manager }: SeedAccounts,
): Promise<string> {
  const accounts: (typeof schema.users.$inferInsert)[] = [
    {
      id: "usr-0001",
      email: admin.email,
      name: admin.name,
      role: "admin",
      passwordHash: await hashPassword(admin.password),
    },
  ];
  if (manager) {
    accounts.push({
      id: "usr-0002",
      email: manager.email,
      name: manager.name,
      role: "gestionnaire",
      passwordHash: await hashPassword(manager.password),
    });
  }

  await db.transaction(async (tx) => {
    // Messages et notifications avant les commandes et les clients qu'ils référencent.
    await tx.delete(schema.messageAttachments);
    await tx.delete(schema.customerMessages);
    await tx.delete(schema.customerNotifications);
    await tx.delete(schema.orderEvents);
    await tx.delete(schema.orderLines);
    await tx.delete(schema.orders);
    await tx.delete(schema.customerNotes);
    await tx.delete(schema.customers);
    await tx.delete(schema.communities);
    await tx.delete(schema.staff);
    await tx.delete(schema.products);
    await tx.delete(schema.articles);
    await tx.delete(schema.engagementMonthly);
    await tx.delete(schema.authTokens);
    await tx.delete(schema.users);
    await tx.delete(schema.loginAttempts);

    await tx.insert(schema.users).values(accounts);

    await tx.insert(schema.staff).values(
      staffFixtures.map((m) => ({
        id: m.id,
        kind: m.kind,
        firstName: m.firstName,
        lastName: m.lastName,
        email: m.email,
        phone: m.phone,
        shift: m.shift,
        availability: m.availability,
        workDays: [...m.workDays],
        startedAt: m.startedAt,
        notes: m.notes,
        active: m.active,
        createdAt: new Date(m.createdAt),
      })),
    );

    await tx.insert(schema.communities).values(
      communitiesFixtures.map((c) => ({
        id: c.id,
        name: c.name,
        kind: c.kind,
        visibility: c.visibility,
        contactName: c.contactName,
        contactEmail: c.contactEmail,
        contactPhone: c.contactPhone,
        pickupPlace: c.pickupPlace,
        pickupCity: c.pickupCity,
        pickupPostalCode: c.pickupPostalCode,
        active: c.active,
        createdAt: new Date(c.createdAt),
      })),
    );

    // Les parrains d'abord (clé étrangère sur la table elle-même) : les
    // clients du scénario, qui parrainent, sont en tête des fixtures.
    await inChunks(
      customersFixtures.map((c) => ({
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
      })),
      (part) => tx.insert(schema.customers).values(part),
    );
    const notes = customersFixtures.flatMap((c) =>
      c.notes.map((n) => ({
        id: n.id,
        customerId: c.id,
        text: n.text,
        authorName: n.authorName,
        createdAt: new Date(n.createdAt),
      })),
    );
    if (notes.length > 0) await tx.insert(schema.customerNotes).values(notes);

    // Paramètres du catalogue remis à leur valeur par défaut (une seule ligne).
    await tx
      .insert(schema.catalogSettings)
      .values({ id: "catalog", sellWhenOutOfStock: false })
      .onConflictDoUpdate({
        target: schema.catalogSettings.id,
        set: { sellWhenOutOfStock: false, updatedAt: new Date() },
      });

    await tx.insert(schema.products).values(
      productsFixtures.map((p) => ({
        id: p.id,
        name: p.name,
        variety: p.variety,
        category: p.category,
        unit: p.unit,
        priceCents: p.priceCents,
        unitWeightGrams: p.unitWeightGrams,
        container: p.container,
        originCountry: p.originCountry,
        originRegion: p.originRegion,
        caliberMinMm: p.caliber?.minMm ?? null,
        caliberMaxMm: p.caliber?.maxMm ?? null,
        organic: p.organic,
        inSeason: p.inSeason,
        available: p.available,
        visible: p.visible,
        stockQuantity: p.stockQuantity,
        illustration: p.illustration,
        imageUrl: p.imageUrl,
        updatedAt: new Date(p.updatedAt),
      })),
    );

    await inChunks(
      ordersFixtures.map((o) => ({
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
      })),
      (part) => tx.insert(schema.orders).values(part),
    );
    await inChunks(
      ordersFixtures.flatMap((o) =>
        o.lines.map((line, position) => ({
          orderId: o.id,
          position,
          productId: line.productId,
          productName: line.productName,
          quantity: line.quantity,
          unit: line.unit,
          lineTotalCents: line.lineTotalCents,
        })),
      ),
      (part) => tx.insert(schema.orderLines).values(part),
    );
    await inChunks(
      orderEventsFixtures.map((e) => ({
        id: e.id,
        orderId: e.orderId,
        fromStatus: e.from,
        toStatus: e.to,
        actorId: e.actor.id,
        actorName: e.actor.name,
        cancellationReason: e.cancellation?.reason ?? null,
        cancellationDetail: e.cancellation?.detail ?? null,
        at: new Date(e.at),
      })),
      (part) => tx.insert(schema.orderEvents).values(part),
    );

    // Après les commandes : la file de notifications déposées pour les clients.
    if (notificationsFixtures.length > 0) {
      await tx.insert(schema.customerNotifications).values(
        notificationsFixtures.map((n) => ({
          id: n.id,
          customerId: n.customerId,
          orderId: n.order.id,
          kind: n.kind,
          orderStatus: n.orderStatus,
          title: n.title,
          body: n.body,
          createdAt: new Date(n.createdAt),
          sentAt: n.sentAt === null ? null : new Date(n.sentAt),
        })),
      );
    }

    // Après les commandes et les clients : un message cite les deux.
    await tx.insert(schema.customerMessages).values(
      messagesFixtures.map((m) => ({
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
      })),
    );
    const attachments = messagesFixtures.flatMap((m) =>
      m.attachments.map((a, position) => ({
        id: a.id,
        messageId: m.id,
        position,
        fileName: a.fileName,
        contentType: a.contentType,
        sizeBytes: a.sizeBytes,
        url: a.url,
      })),
    );
    if (attachments.length > 0) {
      await tx.insert(schema.messageAttachments).values(attachments);
    }

    await tx.insert(schema.articles).values(
      articlesFixtures.map((a) => ({
        id: a.id,
        title: a.title,
        body: a.body,
        category: a.category,
        illustration: a.illustration,
        imageUrl: a.imageUrl,
        publishedAt: a.publishedAt,
        visible: a.visible,
        updatedAt: new Date(a.updatedAt),
      })),
    );

    await tx.insert(schema.engagementMonthly).values(
      engagementFixtures.map((e) => ({
        month: e.month,
        downloads: e.downloads,
        signups: e.signups,
        rating: e.rating === null ? null : e.rating.toFixed(2),
        ratingCount: e.ratingCount,
      })),
    );
  });

  return `${accounts.length} compte(s), ${staffFixtures.length} personnes, ${communitiesFixtures.length} communautés, ${customersFixtures.length} clients, ${productsFixtures.length} produits, ${ordersFixtures.length} commandes, ${orderEventsFixtures.length} événements, ${notificationsFixtures.length} notifications, ${messagesFixtures.length} messages, ${articlesFixtures.length} articles, ${engagementFixtures.length} mois d'usage`;
}
