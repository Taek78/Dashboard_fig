import { describe, expect, it, vi } from "vitest";
import { articlesFixtures } from "@/domain/articles/fixtures";
import type { ArticleInput } from "@/domain/articles/types";

/* Articles sur la base de test, chaque test dans une transaction annulée. */
vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () =>
  import("../support/test-database").then((m) => m.dbClientMock),
);
const { isolateEachTest } = await import("../support/test-database");
isolateEachTest();

const { articlesDb } = await import("@/data/articles.db");

const input: ArticleInput = {
  title: "Nouveau",
  body: "Texte.",
  category: "news",
  illustration: "📰",
  imageUrl: null,
  publishedAt: "2026-09-13",
  visible: true,
};

describe("articlesDb", () => {
  it("liste tous les articles du plus récent au plus ancien", async () => {
    const list = await articlesDb.getArticles();
    expect(list).toHaveLength(articlesFixtures.length);
    for (let i = 1; i < list.length; i += 1) {
      expect(list[i - 1]!.publishedAt >= list[i]!.publishedAt).toBe(true);
    }
    expect(await articlesDb.getArticle("art-9999")).toBeNull();
  });

  it("crée avec un id et une date de mise à jour posés par la base, met à jour, supprime", async () => {
    const created = await articlesDb.createArticle(input);
    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Date(created.updatedAt).toISOString()).toBe(created.updatedAt);
    expect((await articlesDb.getArticle(created.id))?.title).toBe("Nouveau");

    const updated = await articlesDb.updateArticle(created.id, {
      ...input,
      visible: false,
    });
    expect(updated?.visible).toBe(false);
    expect(await articlesDb.updateArticle("art-9999", input)).toBeNull();

    expect(await articlesDb.deleteArticle(created.id)).toBe(true);
    expect(await articlesDb.deleteArticle(created.id)).toBe(false);
    expect(await articlesDb.getArticle(created.id)).toBeNull();
  });
});
