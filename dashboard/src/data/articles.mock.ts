import { articlesFixtures } from "@/domain/articles/fixtures";
import { sortArticlesNewestFirst } from "@/domain/articles/rules";
import type { ArticlesSource } from "@/domain/articles/source";
import type { Article, ArticleInput } from "@/domain/articles/types";

/*
 * Implémentation FIXTURES du contrat ArticlesSource : Map mutable seedée, clone
 * à l'entrée et à la sortie, latence simulée, resetArticlesMock() hors contrat.
 * updatedAt fixe (déterminisme sous Vitest) ; ids créés par compteur local.
 */
const store = new Map<string, Article>();
let counter = 0;

function seed(): void {
  store.clear();
  counter = 0;
  for (const article of articlesFixtures) {
    store.set(article.id, structuredClone(article));
  }
}

seed();

export const ARTICLES_MOCK_LATENCY_MS = 300;
export const MOCK_UPDATED_AT = "2026-09-13T12:00:00.000Z";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const articlesMock: ArticlesSource = {
  getArticles: async () => {
    await sleep(ARTICLES_MOCK_LATENCY_MS);
    return structuredClone(sortArticlesNewestFirst([...store.values()]));
  },

  getArticle: async (id: string) => {
    await sleep(ARTICLES_MOCK_LATENCY_MS);
    const article = store.get(id);
    return article ? structuredClone(article) : null;
  },

  createArticle: async (input: ArticleInput) => {
    await sleep(ARTICLES_MOCK_LATENCY_MS);
    counter += 1;
    const created: Article = {
      ...structuredClone(input),
      id: `art-m-${counter}`,
      updatedAt: MOCK_UPDATED_AT,
    };
    store.set(created.id, created);
    return structuredClone(created);
  },

  updateArticle: async (id: string, input: ArticleInput) => {
    await sleep(ARTICLES_MOCK_LATENCY_MS);
    const current = store.get(id);
    if (!current) return null;
    const updated: Article = {
      ...structuredClone(input),
      id: current.id,
      updatedAt: MOCK_UPDATED_AT,
    };
    store.set(id, updated);
    return structuredClone(updated);
  },

  deleteArticle: async (id: string) => {
    await sleep(ARTICLES_MOCK_LATENCY_MS);
    return store.delete(id);
  },
};

/** Repart des fixtures. Hors contrat : tests uniquement. */
export function resetArticlesMock(): void {
  seed();
}
