import { z } from "zod";
import {
  ARTICLE_CATEGORIES,
  ARTICLE_ILLUSTRATIONS,
} from "@/domain/articles/category";
import type { ArticleInput } from "@/domain/articles/types";

/*
 * Schémas zod des ENTRÉES des articles : écriture stricte (rédaction,
 * modification, visibilité, suppression). Le corps est du texte brut, borné.
 */
export const articleIdSchema = z.string().trim().min(1).max(64);

export const TITLE_MAX_LENGTH = 120;
export const BODY_MAX_LENGTH = 8000;

/** Une case à cocher absente du FormData = décochée. */
const checkbox = z
  .literal("on")
  .optional()
  .transform((value) => value === "on");

export const articleInputSchema = z
  .object({
    title: z.string().trim().min(1).max(TITLE_MAX_LENGTH),
    body: z.string().trim().min(1).max(BODY_MAX_LENGTH),
    category: z.enum(ARTICLE_CATEGORIES),
    illustration: z.enum(ARTICLE_ILLUSTRATIONS),
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
    publishedAt: z.iso.date(),
    visible: checkbox,
  })
  .transform((v): ArticleInput => v);

export const updateArticleSchema = z.object({ articleId: articleIdSchema });

/** La confirmation est aussi vérifiée côté serveur : pas de suppression par un POST forgé. */
export const deleteArticleSchema = z.object({
  articleId: articleIdSchema,
  confirm: z.literal("oui"),
});

export const articleVisibilitySchema = z.object({
  articleId: articleIdSchema,
  visible: z.enum(["1", "0"]).transform((v) => v === "1"),
});
