import type { Article, ArticleInput } from "@/domain/articles/types";

/*
 * CONTRAT des articles, implémenté par PostgreSQL (src/data/articles.db.ts). getArticles renvoie TOUS les articles (masqués et programmés
 * compris : c'est le back-office), du plus récent au plus ancien. updateArticle
 * et deleteArticle renvoient null / false si l'article n'existe pas.
 * getPublishedArticles (API) : les articles visibles parus au plus tard le
 * jour `today` (AAAA-MM-JJ, Paris), les plus récents d'abord, `limit` au plus.
 */
export type ArticlesSource = {
  getArticles(): Promise<Article[]>;
  getPublishedArticles(today: string, limit: number): Promise<Article[]>;
  getArticle(id: string): Promise<Article | null>;
  createArticle(input: ArticleInput): Promise<Article>;
  updateArticle(id: string, input: ArticleInput): Promise<Article | null>;
  deleteArticle(id: string): Promise<boolean>;
};
