import "server-only";
import { selectSource } from "@/data/select-source";
import type { ArticlesSource } from "@/domain/articles/source";
import { articlesDb } from "@/data/articles.db";
import { articlesMock } from "@/data/articles.mock";

/* FAÇADE des articles : seul module importé par le front ; DATA_SOURCE choisit fixtures ou Postgres. */
const source = (): ArticlesSource =>
  selectSource("articles", articlesMock, articlesDb);

export const getArticles: ArticlesSource["getArticles"] = () =>
  source().getArticles();
export const getArticle: ArticlesSource["getArticle"] = (id) =>
  source().getArticle(id);
export const createArticle: ArticlesSource["createArticle"] = (input) =>
  source().createArticle(input);
export const updateArticle: ArticlesSource["updateArticle"] = (id, input) =>
  source().updateArticle(id, input);
export const deleteArticle: ArticlesSource["deleteArticle"] = (id) =>
  source().deleteArticle(id);
