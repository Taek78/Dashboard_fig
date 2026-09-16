import { z } from "zod";
import { customerIdSchema } from "@/domain/customers/schemas";
import { ANONYMIZE_CONFIRM_WORD } from "@/domain/privacy/anonymization";

/*
 * Entrées des demandes RGPD. L'anonymisation est irréversible : le mot
 * ANONYMISER est exigé ici, côté serveur, et pas seulement par le bouton
 * (espaces et casse tolérés, comme l'encart de confirmation).
 */
export const anonymizeCustomerSchema = z.object({
  customerId: customerIdSchema,
  confirm: z
    .string()
    .trim()
    .toUpperCase()
    .pipe(z.literal(ANONYMIZE_CONFIRM_WORD)),
});
