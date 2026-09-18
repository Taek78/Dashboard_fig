import { existsSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";
import { and, asc, gt, isNull, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { DbExecutor } from "@/db/client";
import { insertOrder } from "@/db/order-insert";
import * as schema from "@/db/schema";
import { todayInParis } from "@/domain/deliveries/rules";
import { deliveryFeeCents } from "@/domain/orders/delivery-fee";
import { lineTotalCents } from "@/domain/orders/quote";
import type { NewOrder, OrderLine } from "@/domain/orders/types";
import { addDays } from "@/lib/days";
import { databaseHost, remoteDatabaseProblem } from "@/lib/database-url";

/*
 * `npm run demo:commandes` : DÉMONSTRATION des alertes en direct. Crée trois
 * commandes, une toutes les dix secondes, dans la base LOCALE, comme si
 * l'application FIG les envoyait : le back-office ouvert dans un navigateur
 * doit sonner et afficher une notification pour chacune.
 * `npm run demo:commandes -- 5 3` : cinq commandes, une toutes les 3 s.
 * - Clients et produits pris dans la base (données fictives du seed) : clients
 *   non anonymisés et hors communauté, produits en vente avec du stock.
 * - Montants calculés par les mêmes règles que le devis de l'API (lignes,
 *   frais de livraison) ; livraison demain de 10:00 à 11:00.
 * - Base distante TOUJOURS refusée, sans option pour forcer : ce script
 *   n'écrit que des commandes de démonstration.
 * N'affiche que les références créées, jamais une donnée personnelle.
 */
if (!process.env.DATABASE_URL && existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

function positiveInt(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 && value <= 60 ? value : fallback;
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquante dans l'environnement.");
  const problem = remoteDatabaseProblem(url, "—", {}, "la démonstration");
  if (problem) throw new Error(problem);
  const howMany = positiveInt(process.argv[2], 3);
  const everySeconds = positiveInt(process.argv[3], 10);

  const sql = postgres(url, { max: 1, onnotice: () => {} });
  const db = drizzle(sql, { schema });
  try {
    const buyers = await db
      .select()
      .from(schema.customers)
      .where(
        and(
          isNull(schema.customers.anonymizedAt),
          isNull(schema.customers.communityId),
        ),
      )
      .orderBy(asc(schema.customers.id))
      .limit(howMany);
    const goods = await db
      .select()
      .from(schema.products)
      .where(
        and(
          eq(schema.products.visible, true),
          eq(schema.products.available, true),
          gt(schema.products.stockQuantity, 0),
        ),
      )
      .orderBy(asc(schema.products.id))
      .limit(6);
    if (buyers.length === 0 || goods.length < 2) {
      throw new Error(
        "Pas assez de clients ou de produits : lancer d'abord npm run db:seed.",
      );
    }
    const deliveryDate = addDays(todayInParis(new Date()), 1);
    console.info(
      `[demo] ${howMany} commande(s), une toutes les ${everySeconds} s, sur ${databaseHost(url)}. Gardez le back-office ouvert (et cliquez une fois dans la page : le navigateur n'autorise le son qu'après un geste).`,
    );

    for (let i = 0; i < howMany; i += 1) {
      await sleep(everySeconds * 1000);
      const buyer = buyers[i % buyers.length]!;
      const lines: OrderLine[] = [
        goods[i % goods.length]!,
        goods[(i + 1) % goods.length]!,
      ].map((product) => {
        const quantity = product.unit === "g" ? 1000 : 2;
        return {
          productId: product.id,
          productName: product.name,
          quantity,
          unit: product.unit,
          lineTotalCents: lineTotalCents(product, quantity),
        };
      });
      const subtotal = lines.reduce(
        (sum, line) => sum + line.lineTotalCents,
        0,
      );
      const fee = deliveryFeeCents(subtotal, false);
      const order: NewOrder = {
        customerId: buyer.id,
        deliverySlot: { date: deliveryDate, start: "10:00", end: "11:00" },
        deliveryAddressLine: buyer.addressLine,
        deliveryCity: buyer.city,
        deliveryPostalCode: buyer.postalCode,
        lines,
        deliveryFeeCents: fee,
        totalCents: subtotal + fee,
        communityId: null,
        discount: null,
        paymentReference: null,
      };
      const id = await db.transaction((tx) =>
        insertOrder(tx as unknown as DbExecutor, order),
      );
      const [created] = await db
        .select({ reference: schema.orders.reference })
        .from(schema.orders)
        .where(eq(schema.orders.id, id));
      console.info(`[demo] ${i + 1}/${howMany} : ${created?.reference ?? id}`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error("[demo]", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
