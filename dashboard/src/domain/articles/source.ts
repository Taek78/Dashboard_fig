import type { Article, ArticleInput } from "@/domain/articles/types";

/*
 * CONTRAT des articles, implémenté par PostgreSQL (src/data/articles.db.ts). getArticles renvoie TOUS les articles (masqués et programmés
 * compris : c'est le back-office), du plus récent au plus ancien. updateArticle
 * et deleteArticle renvoient null / false si l'article n'existe pas.
 */
export type ArticlesSource = {
  getArticles(): Promise<Article[]>;
  getArticle(id: string): Promise<Article | null>;
  createArticle(input: ArticleInput): Promise<Article>;
  updateArticle(id: string, input: ArticleInput): Promise<Article | null>;
  deleteArticle(id: string): Promise<boolean>;
};
