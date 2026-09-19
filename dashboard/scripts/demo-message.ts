import { existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { desc, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { MESSAGE_SUBJECT_LABELS } from "@/domain/messages/subject";
import { remoteDatabaseProblem } from "@/lib/database-url";

/*
 * `npx tsx scripts/demo-message.ts` : DÉMONSTRATION des alertes en direct.
 * Dépose UN message « Nous contacter » dans la base LOCALE, comme si
 * l'application FIG l'envoyait par l'API (même contenu que `createMessage`,
 * sans la route HTTP) : le back-office ouvert dans un navigateur doit afficher
 * une notification pour ce message.
 * - Client pris dans la base (données fictives du seed), avec sa commande la
 *   plus récente citée dans le message.
 * - Base distante TOUJOURS refusée, sans option pour forcer : ce script n'écrit
 *   qu'un message de démonstration.
 * N'affiche que la référence de la commande, jamais une donnée personnelle.
 */
if (!process.env.DATABASE_URL && existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL manquante dans l'environnement.");
  const problem = remoteDatabaseProblem(url, "—", {}, "la démonstration");
  if (problem) throw new Error(problem);

  const sql = postgres(url, { max: 1, onnotice: () => {} });
  const db = drizzle(sql, { schema });
  try {
    const [last] = await db
      .select({
        customerId: schema.customers.id,
        orderId: schema.orders.id,
        reference: schema.orders.reference,
      })
      .from(schema.customers)
      .innerJoin(
        schema.orders,
        eq(schema.orders.customerId, schema.customers.id),
      )
      .where(isNull(schema.customers.anonymizedAt))
      .orderBy(desc(schema.orders.createdAt))
      .limit(1);
    if (!last) {
      throw new Error(
        "Aucune commande à citer : lancer d'abord npm run db:seed.",
      );
    }

    const body =
      "Bonjour, j'ai bien reçu ma commande mais il manque deux mangues dans " +
      "le panier livré. Pouvez-vous vérifier de votre côté et me tenir au " +
      "courant ? Merci d'avance.";
    const id = randomUUID();
    await db.insert(schema.customerMessages).values({
      id,
      customerId: last.customerId,
      subject: "order_error",
      body,
      orderId: last.orderId,
    });
    console.info(
      `[demo] message « ${MESSAGE_SUBJECT_LABELS.order_error} » déposé (commande ${last.reference ?? last.orderId}). Gardez le back-office ouvert.`,
    );
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error("[demo]", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
