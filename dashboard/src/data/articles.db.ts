import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, lte } from "drizzle-orm";
import { getDb } from "@/db/client";
import { articleToRow, toArticle } from "@/db/mappers";
import { articles } from "@/db/schema";
import type { ArticlesSource } from "@/domain/articles/source";
import type { ArticleInput } from "@/domain/articles/types";

/* Implémentation Drizzle du contrat ArticlesSource : du plus récent au plus ancien. */
export const articlesDb: ArticlesSource = {
  getArticles: async () => {
    const rows = await getDb()
      .select()
      .from(articles)
      .orderBy(
        desc(articles.publishedAt),
        desc(articles.updatedAt),
        asc(articles.title),
      );
    return rows.map(toArticle);
  },

  // Ce que l'application affiche : visibles et déjà parus (index articles_published_idx).
  getPublishedArticles: async (today: string, limit: number) => {
    const rows = await getDb()
      .select()
      .from(articles)
      .where(and(eq(articles.visible, true), lte(articles.publishedAt, today)))
      .orderBy(
        desc(articles.publishedAt),
        desc(articles.updatedAt),
        asc(articles.title),
      )
      .limit(limit);
    return rows.map(toArticle);
  },

  getArticle: async (id: string) => {
    const [row] = await getDb()
      .select()
      .from(articles)
      .where(eq(articles.id, id))
      .limit(1);
    return row ? toArticle(row) : null;
  },

  createArticle: async (input: ArticleInput) => {
    const [row] = await getDb()
      .insert(articles)
      .values({ id: randomUUID(), ...articleToRow(input) })
      .returning();
    if (!row) throw new Error("Insertion de l'article sans ligne renvoyée.");
    return toArticle(row);
  },

  updateArticle: async (id: string, input: ArticleInput) => {
    const [row] = await getDb()
      .update(articles)
      .set({ ...articleToRow(input), updatedAt: new Date() })
      .where(eq(articles.id, id))
      .returning();
    return row ? toArticle(row) : null;
  },

  deleteArticle: async (id: string) => {
    const deleted = await getDb()
      .delete(articles)
      .where(eq(articles.id, id))
      .returning({ id: articles.id });
    return deleted.length > 0;
  },
};
