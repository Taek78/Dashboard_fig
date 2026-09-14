import { z } from "zod";
import {
  CONTAINERS,
  ILLUSTRATIONS,
  ORIGIN_COUNTRY_CODES,
  PRODUCT_CATEGORIES,
} from "@/domain/products/category";
import { eurosToCents } from "@/domain/products/rules";
import {
  DELETE_CONFIRM_WORD,
  type ProductFilters,
  type ProductInput,
} from "@/domain/products/types";

/*
 * Schémas zod des ENTRÉES du catalogue. Lecture tolérante (filtres), écriture
 * stricte (fiche produit, création, suppression). Le prix est validé en euros
 * puis TRANSFORMÉ en centimes ici : la Server Action ne voit jamais d'euros.
 */
export const productIdSchema = z.string().trim().min(1).max(64);

const productFiltersSchema = z
  .object({
    categorie: z.enum(PRODUCT_CATEGORIES).optional().catch(undefined),
    q: z.string().trim().min(1).max(64).optional().catch(undefined),
    dispo: z.enum(["oui", "non"]).optional().catch(undefined),
    masques: z.literal("1").optional().catch(undefined),
  })
  .transform(({ categorie, q, dispo, masques }) => ({
    category: categorie,
    query: q,
    availability:
      dispo === "oui"
        ? ("available" as const)
        : dispo === "non"
          ? ("unavailable" as const)
          : undefined,
    includeHidden: masques === "1" ? true : undefined,
  }));

export function parseProductFilters(
  raw: Record<string, string | string[] | undefined>,
): ProductFilters {
  return productFiltersSchema.parse(raw);
}

/* Briques réutilisées par le formulaire. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));

const optionalInteger = (max: number) =>
  z
    .string()
    .trim()
    .regex(/^\d*$/, "Nombre entier attendu")
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || v <= max, "Valeur trop grande");

/** Une case à cocher absente du FormData = décochée. */
const checkbox = z
  .literal("on")
  .optional()
  .transform((value) => value === "on");

const priceEuros = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const cents = eurosToCents(value);
    if (cents === null) {
      ctx.addIssue({ code: "custom", message: "Prix invalide" });
      return z.NEVER;
    }
    return cents;
  });

/**
 * Formulaire de création et de modification : mêmes champs. Produit un
 * ProductInput prêt pour la source. Les cohérences croisées (calibre min ≤ max,
 * les deux bornes ou aucune) sont vérifiées ici, pas dans le composant.
 */
export const productInputSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    variety: optionalText(80),
    category: z.enum(PRODUCT_CATEGORIES),
    unit: z.enum(["piece", "g"]),
    priceEuros,
    unitWeightGrams: optionalInteger(50_000),
    container: z.enum(CONTAINERS),
    originCountry: z.enum(ORIGIN_COUNTRY_CODES),
    originRegion: optionalText(80),
    caliberMin: optionalInteger(1000),
    caliberMax: optionalInteger(1000),
    organic: checkbox,
    inSeason: checkbox,
    available: checkbox,
    visible: checkbox,
    stockQuantity: z
      .string()
      .trim()
      .regex(/^\d{1,7}$/, "Stock invalide")
      .transform(Number),
    illustration: z.enum(ILLUSTRATIONS),
    imageUrl: z
      .string()
      .trim()
      .max(500)
      .transform((v) => (v === "" ? null : v))
      .refine(
        (v) =>
          v === null || z.url({ protocol: /^https$/ }).safeParse(v).success,
        "URL https attendue",
      ),
  })
  .refine((v) => (v.caliberMin === null) === (v.caliberMax === null), {
    message: "Le calibre demande ses deux bornes",
    path: ["caliberMax"],
  })
  .refine(
    (v) =>
      v.caliberMin === null ||
      v.caliberMax === null ||
      v.caliberMin <= v.caliberMax,
    {
      message: "Calibre : le minimum dépasse le maximum",
      path: ["caliberMax"],
    },
  )
  .transform(
    ({
      priceEuros,
      caliberMin,
      caliberMax,
      unit,
      unitWeightGrams,
      ...rest
    }): ProductInput => ({
      ...rest,
      unit,
      priceCents: priceEuros,
      // Le poids moyen n'a de sens que pour une pièce.
      unitWeightGrams: unit === "piece" ? unitWeightGrams : null,
      caliber:
        caliberMin !== null && caliberMax !== null
          ? { minMm: caliberMin, maxMm: caliberMax }
          : null,
    }),
  );

export const updateProductSchema = z.object({ productId: productIdSchema });

export { DELETE_CONFIRM_WORD };
export const deleteProductSchema = z.object({
  productId: productIdSchema,
  /** Le mot tapé par l'utilisateur : la confirmation est aussi vérifiée côté serveur. */
  confirm: z.literal(DELETE_CONFIRM_WORD),
});
