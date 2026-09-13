import { z } from "zod";

/* ?date=AAAA-MM-JJ de la page Livraisons ; invalide ou absent → undefined (jour courant). */
const tourDateSchema = z
  .object({ date: z.iso.date().optional().catch(undefined) })
  .transform(({ date }) => date);

export function parseTourDate(
  raw: Record<string, string | string[] | undefined>,
): string | undefined {
  return tourDateSchema.parse(raw);
}
