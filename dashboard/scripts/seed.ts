import { existsSync } from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { articlesFixtures } from "@/domain/articles/fixtures";
import { communitiesFixtures } from "@/domain/communities/fixtures";
import { customersFixtures } from "@/domain/customers/fixtures";
import { engagementFixtures } from "@/domain/engagement/fixtures";
import { orderEventsFixtures, ordersFixtures } from "@/domain/orders/fixtures";
import { productsFixtures } from "@/domain/products/fixtures";
import { staffFixtures } from "@/domain/staff/fixtures";
import { hashPassword } from "@/lib/password";

/*
 * Remplit la base LOCALE avec les fixtures du projet et les comptes de
 * l'environnement (`npm run db:seed`, après `npm run db:migrate`).
 * Tout est effacé puis réinséré dans une transaction : la base repart au même
 * état que le mock. Refuse un hôte distant sauf SEED_ALLOW_REMOTE=1 : ce
 * script n'a rien à faire sur une base partagée.
 * Hors Next : lit .env.local lui-même, n'importe aucun module server-only.
 */
if (!process.env.DATABASE_URL && existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} manquante dans l'environnement.`);
  return value;
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

async function main(): Promise<void> {
  const url = required("DATABASE_URL");
  const host = new URL(url).hostname;
  if (
    !["localhost", "127.0.0.1", "::1"].includes(host) &&
    process.env.SEED_ALLOW_REMOTE !== "1"
  ) {
    throw new Error(
      `Hôte ${host} refusé : le seed ne vise qu'une base locale (SEED_ALLOW_REMOTE=1 pour forcer).`,
    );
  }

  const accounts: (typeof schema.users.$inferInsert)[] = [
    {
      id: "usr-0001",
      email: required("AUTH_BOOTSTRAP_EMAIL"),
      name: process.env.AUTH_BOOTSTRAP_NAME ?? "Administrateur",
      role: "admin",
      passwordHash: await hashPassword(required("AUTH_BOOTSTRAP_PASSWORD")),
    },
  ];
  if (process.env.AUTH_MANAGER_EMAIL && process.env.AUTH_MANAGER_PASSWORD) {
    accounts.push({
      id: "usr-0002",
      email: process.env.AUTH_MANAGER_EMAIL,
      name: process.env.AUTH_MANAGER_NAME ?? "Gestionnaire",
      role: "gestionnaire",
      passwordHash: await hashPassword(process.env.AUTH_MANAGER_PASSWORD),
    });
  }

  const sql = postgres(url, { max: 1 });
  const db = drizzle(sql, { schema });
  try {
    await db.transaction(async (tx) => {
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
      await tx.delete(schema.users);

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
          contactName: c.contactName,
          contactEmail: c.contactEmail,
          contactPhone: c.contactPhone,
          pickupPlace: c.pickupPlace,
          pickupCity: c.pickupCity,
          pickupPostalCode: c.pickupPostalCode,
          pickupTime: c.pickupTime,
          discountPercent: c.discountPercent,
          active: c.active,
          createdAt: new Date(c.createdAt),
        })),
      );

      await inChunks(
        customersFixtures.map((c) => ({
          id: c.id,
          fullName: c.fullName,
          email: c.email,
          phone: c.phone,
          city: c.city,
          postalCode: c.postalCode,
          communityId: c.community?.id ?? null,
          createdAt: new Date(c.createdAt),
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
          deliveryCity: o.deliveryCity,
          deliveryPostalCode: o.deliveryPostalCode,
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
          complaints: e.complaints,
          rating: e.rating === null ? null : e.rating.toFixed(2),
          ratingCount: e.ratingCount,
        })),
      );
    });

    console.info(
      `[seed] ${accounts.length} compte(s), ${staffFixtures.length} personnes, ${communitiesFixtures.length} communautés, ${customersFixtures.length} clients, ${productsFixtures.length} produits, ${ordersFixtures.length} commandes, ${orderEventsFixtures.length} événements, ${articlesFixtures.length} articles, ${engagementFixtures.length} mois d'usage.`,
    );
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(
    "[seed] échec :",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
