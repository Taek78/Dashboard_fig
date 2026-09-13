import { z } from "zod";
import { orderIdSchema } from "@/domain/orders/schemas";

/*
 * Schémas zod des ENTRÉES des livraisons (frontière de confiance).
 * Écriture stricte (assignCourierSchema), lecture tolérante (tourDateSchema).
 */
export const courierIdSchema = z.string().trim().min(1).max(64);

export const assignCourierSchema = z.object({
  orderId: orderIdSchema,
  courierId: courierIdSchema,
});

/** ?date=AAAA-MM-JJ de la page Livraisons ; invalide ou absent → undefined (jour courant). */
const tourDateSchema = z
  .object({ date: z.iso.date().optional().catch(undefined) })
  .transform(({ date }) => date);

export function parseTourDate(
  raw: Record<string, string | string[] | undefined>,
): string | undefined {
  return tourDateSchema.parse(raw);
}
