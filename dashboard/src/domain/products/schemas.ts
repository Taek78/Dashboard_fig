import { z } from "zod";
import { PRODUCT_CATEGORIES } from "@/domain/products/category";
import { eurosToCents } from "@/domain/products/rules";
import type { ProductFilters } from "@/domain/products/types";

/*
 * Schémas zod des ENTRÉES du catalogue. Lecture tolérante (filtres), écriture
 * stricte (fiche produit). Le prix est validé en euros puis TRANSFORMÉ en
 * centimes ici : la Server Action ne voit jamais d'euros.
 */
export const productIdSchema = z.string().trim().min(1).max(64);

const productFiltersSchema = z
  .object({
    categorie: z.enum(PRODUCT_CATEGORIES).optional().catch(undefined),
    q: z.string().trim().min(1).max(64).optional().catch(undefined),
    dispo: z.enum(["oui", "non"]).optional().catch(undefined),
  })
  .transform(({ categorie, q, dispo }) => ({
    category: categorie,
    query: q,
    availability:
      dispo === "oui"
        ? ("available" as const)
        : dispo === "non"
          ? ("unavailable" as const)
          : undefined,
  }));

export function parseProductFilters(
  raw: Record<string, string | string[] | undefined>,
): ProductFilters {
  return productFiltersSchema.parse(raw);
}

export const updateProductSchema = z.object({
  productId: productIdSchema,
  priceEuros: z
    .string()
    .trim()
    .transform((value, ctx) => {
      const cents = eurosToCents(value);
      if (cents === null) {
        ctx.addIssue({ code: "custom", message: "Prix invalide" });
        return z.NEVER;
      }
      return cents;
    }),
  // Une case à cocher absente du FormData = décochée.
  available: z
    .literal("on")
    .optional()
    .transform((value) => value === "on"),
  stockQuantity: z
    .string()
    .trim()
    .regex(/^\d{1,7}$/, "Stock invalide")
    .transform(Number),
});
