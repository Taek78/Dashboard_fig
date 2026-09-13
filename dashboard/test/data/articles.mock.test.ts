import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ARTICLES_MOCK_LATENCY_MS,
  articlesMock,
  MOCK_UPDATED_AT,
  resetArticlesMock,
} from "@/data/articles.mock";
import { articlesFixtures } from "@/domain/articles/fixtures";
import type { ArticleInput } from "@/domain/articles/types";

beforeEach(() => {
  vi.useFakeTimers();
  resetArticlesMock();
});
afterEach(() => vi.useRealTimers());

async function settle<T>(promise: Promise<T>): Promise<T> {
  await vi.advanceTimersByTimeAsync(ARTICLES_MOCK_LATENCY_MS);
  return promise;
}

const input: ArticleInput = {
  title: "Nouveau",
  body: "Texte.",
  category: "news",
  illustration: "📰",
  imageUrl: null,
  publishedAt: "2026-09-13",
  visible: true,
};

describe("articlesMock", () => {
  it("liste tous les articles du plus récent au plus ancien, en copies", async () => {
    const list = await settle(articlesMock.getArticles());
    expect(list).toHaveLength(articlesFixtures.length);
    expect(list[0]?.publishedAt >= (list[1]?.publishedAt ?? "")).toBe(true);
    list[0]!.title = "modifié";
    const again = await settle(articlesMock.getArticle(list[0]!.id));
    expect(again?.title).not.toBe("modifié");
  });

  it("crée avec un id et updatedAt fixes, met à jour, supprime", async () => {
    const created = await settle(articlesMock.createArticle(input));
    expect(created.id).toBe("art-m-1");
    expect(created.updatedAt).toBe(MOCK_UPDATED_AT);

    const updated = await settle(
      articlesMock.updateArticle(created.id, { ...input, visible: false }),
    );
    expect(updated?.visible).toBe(false);
    expect(await settle(articlesMock.updateArticle("nope", input))).toBeNull();

    expect(await settle(articlesMock.deleteArticle(created.id))).toBe(true);
    expect(await settle(articlesMock.deleteArticle(created.id))).toBe(false);
    expect(await settle(articlesMock.getArticle(created.id))).toBeNull();
  });
});
