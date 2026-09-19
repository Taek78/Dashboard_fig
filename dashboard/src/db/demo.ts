import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gt, isNull } from "drizzle-orm";
import type { DbExecutor } from "@/db/client";
import { insertOrder } from "@/db/order-insert";
import * as schema from "@/db/schema";
import { todayInParis } from "@/domain/deliveries/rules";
import type { MessageSubject } from "@/domain/messages/subject";
import { deliveryFeeCents } from "@/domain/orders/delivery-fee";
import { lineTotalCents } from "@/domain/orders/quote";
import type { NewOrder, OrderLine } from "@/domain/orders/types";
import { addDays } from "@/lib/days";

/*
 * DÉMONSTRATION des alertes en direct : une commande ou un message « comme si
 * l'application FIG l'envoyait », écrits dans la base passée en paramètre.
 * Sans server-only : partagé par `npm run demo:commandes` (base locale) et
 * par les boutons de simulation du tableau de bord (développement seulement,
 * src/lib/demo-tools.ts). À RETIRER avec eux avant la livraison au client
 * (docs/backlog.md).
 * Clients et produits pris dans la base (données fictives du seed) ; montants
 * calculés par les règles du devis ; livraison demain de 10:00 à 11:00.
 * `seed` fait varier le client, les produits et le texte d'un appel à l'autre.
 */
export class DemoDataMissingError extends Error {
  constructor() {
    super(
      "Pas assez de clients ou de produits : lancer d'abord npm run db:seed.",
    );
  }
}

const DEMO_MESSAGES: readonly { subject: MessageSubject; body: string }[] = [
  {
    subject: "delivery_issue",
    body: "Bonjour, le livreur n'est pas encore passé, pouvez-vous me dire où en est ma commande ?",
  },
  {
    subject: "missing_or_damaged",
    body: "Il manquait les avocats dans mon panier de ce matin. Merci de vérifier.",
  },
  {
    subject: "product_question",
    body: "Vos fraises sont-elles issues de l'agriculture biologique ? Merci d'avance.",
  },
  {
    subject: "order_error",
    body: "J'ai reçu des pommes Gala au lieu des Golden commandées.",
  },
];

/** Crée une commande de démonstration ; renvoie sa référence. */
export async function insertDemoOrder(
  db: DbExecutor,
  now: Date,
  seed = 0,
): Promise<string> {
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
    .limit(20);
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
    .limit(8);
  if (buyers.length === 0 || goods.length < 2) throw new DemoDataMissingError();

  const buyer = buyers[seed % buyers.length]!;
  const lines: OrderLine[] = [
    goods[seed % goods.length]!,
    goods[(seed + 1) % goods.length]!,
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
  const subtotal = lines.reduce((sum, line) => sum + line.lineTotalCents, 0);
  const fee = deliveryFeeCents(subtotal, false);
  const order: NewOrder = {
    customerId: buyer.id,
    deliverySlot: {
      date: addDays(todayInParis(now), 1),
      start: "10:00",
      end: "11:00",
    },
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
  const id = await db.transaction((tx) => insertOrder(tx, order));
  const [created] = await db
    .select({ reference: schema.orders.reference })
    .from(schema.orders)
    .where(eq(schema.orders.id, id));
  return created?.reference ?? id;
}

/** Dépose un message « Nous contacter » de démonstration, lié à la dernière commande du client. */
export async function insertDemoMessage(
  db: DbExecutor,
  seed = 0,
): Promise<{ id: string; subject: MessageSubject }> {
  const customers = await db
    .select({ id: schema.customers.id })
    .from(schema.customers)
    .where(isNull(schema.customers.anonymizedAt))
    .orderBy(asc(schema.customers.id))
    .limit(20);
  if (customers.length === 0) throw new DemoDataMissingError();
  const customer = customers[seed % customers.length]!;
  const [lastOrder] = await db
    .select({ id: schema.orders.id })
    .from(schema.orders)
    .where(eq(schema.orders.customerId, customer.id))
    .orderBy(desc(schema.orders.createdAt))
    .limit(1);
  const message = DEMO_MESSAGES[seed % DEMO_MESSAGES.length]!;
  const id = randomUUID();
  await db.insert(schema.customerMessages).values({
    id,
    customerId: customer.id,
    subject: message.subject,
    body: message.body,
    orderId: lastOrder?.id ?? null,
  });
  return { id, subject: message.subject };
}
