import { describe, expect, it } from "vitest";
import {
  ARTICLE_CATEGORIES,
  ARTICLE_ILLUSTRATIONS,
} from "@/domain/articles/category";
import { articlesFixtures } from "@/domain/articles/fixtures";

describe("articlesFixtures", () => {
  it("ids uniques, dates ISO, catégories et illustrations connues", () => {
    const ids = articlesFixtures.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of articlesFixtures) {
      expect(a.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(ARTICLE_CATEGORIES).toContain(a.category);
      expect(ARTICLE_ILLUSTRATIONS).toContain(a.illustration);
      expect(a.title.length).toBeGreaterThan(0);
      expect(a.body.length).toBeGreaterThan(0);
    }
  });

  it("contient au moins un article masqué et un article programmé après le 13/09/2026", () => {
    expect(articlesFixtures.some((a) => !a.visible)).toBe(true);
    expect(articlesFixtures.some((a) => a.publishedAt > "2026-09-13")).toBe(
      true,
    );
  });
});
