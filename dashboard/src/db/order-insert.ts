import { randomUUID } from "node:crypto";
import { count, sql } from "drizzle-orm";
import type { DbExecutor } from "@/db/client";
import { isUniqueViolation } from "@/db/errors";
import { orderLines, orders } from "@/db/schema";
import { orderReference } from "@/domain/orders/quote";
import type { NewOrder } from "@/domain/orders/types";

/*
 * Écriture d'une commande déjà calculée et de ses lignes, dans la transaction
 * `tx` de l'appelant. Sans server-only : partagée par la source des commandes
 * (createOrder, l'API) et le script de démonstration des alertes
 * (scripts/demo-commandes.ts), comme src/db/privacy.ts.
 * La référence est le rang du jour de livraison (« FIG-AAMMJJ-NNN »). Deux
 * commandes créées au même instant pour le même jour peuvent tirer le même
 * rang : l'index unique refuse la seconde, qui recompte et réessaie dans un
 * point de sauvegarde (la transaction survit). Renvoie l'identifiant.
 */
const REFERENCE_TRIES = 5;

export async function insertOrder(
  tx: DbExecutor,
  input: NewOrder,
): Promise<string> {
  const id = randomUUID();
  const prefix = orderReference(input.deliverySlot.date, 0).slice(0, -3);
  for (let attempt = 1; ; attempt += 1) {
    const [row] = await tx
      .select({ total: count() })
      .from(orders)
      .where(sql`${orders.reference} like ${`${prefix}%`}`);
    const reference = orderReference(
      input.deliverySlot.date,
      (row?.total ?? 0) + 1,
    );
    try {
      await tx.transaction(async (sp) => {
        await sp.insert(orders).values({
          id,
          reference,
          status: "preparing",
          customerId: input.customerId,
          deliveryDate: input.deliverySlot.date,
          deliveryStart: input.deliverySlot.start,
          deliveryEnd: input.deliverySlot.end,
          deliveryAddressLine: input.deliveryAddressLine,
          deliveryCity: input.deliveryCity,
          deliveryPostalCode: input.deliveryPostalCode,
          deliveryFeeCents: input.deliveryFeeCents,
          totalCents: input.totalCents,
          communityId: input.communityId,
          discountKind: input.discount?.kind ?? null,
          discountPercent: input.discount?.percent ?? null,
          discountCents: input.discount?.amountCents ?? 0,
          paymentReference: input.paymentReference,
        });
        await sp.insert(orderLines).values(
          input.lines.map((line, position) => ({
            orderId: id,
            position,
            productId: line.productId,
            productName: line.productName,
            quantity: line.quantity,
            unit: line.unit,
            lineTotalCents: line.lineTotalCents,
          })),
        );
      });
      return id;
    } catch (error) {
      if (
        isUniqueViolation(error, "orders_reference_idx") &&
        attempt < REFERENCE_TRIES
      ) {
        continue;
      }
      throw error;
    }
  }
}
