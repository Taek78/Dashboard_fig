import "server-only";
import { articlesDb } from "@/data/articles.db";
import type { ArticlesSource } from "@/domain/articles/source";

/*
 * FAÇADE des articles : le seul module que le front (pages, Server Actions) importe.
 * L'implémentation est PostgreSQL (articles.db.ts) ; la façade fixe le contrat
 * ArticlesSource et `server-only` (un composant client qui l'importerait casse le build).
 */
export const {
  getArticles,
  getArticle,
  createArticle,
  updateArticle,
  deleteArticle,
}: ArticlesSource = articlesDb;
