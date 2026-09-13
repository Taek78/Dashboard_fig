import { describe, expect, it } from "vitest";
import {
  articleInputSchema,
  articleVisibilitySchema,
  deleteArticleSchema,
} from "@/domain/articles/schemas";

const valid = {
  title: "  Bien manger en septembre ",
  body: "Un texte.",
  category: "nutrition",
  illustration: "🥗",
  imageUrl: "",
  publishedAt: "2026-09-13",
  visible: "on",
};

describe("articleInputSchema", () => {
  it("accepte un formulaire valide et normalise", () => {
    expect(articleInputSchema.parse(valid)).toEqual({
      title: "Bien manger en septembre",
      body: "Un texte.",
      category: "nutrition",
      illustration: "🥗",
      imageUrl: null,
      publishedAt: "2026-09-13",
      visible: true,
    });
  });

  it("case absente = masqué ; URL https acceptée, http refusée", () => {
    const noCheckbox = Object.fromEntries(
      Object.entries(valid).filter(([key]) => key !== "visible"),
    );
    expect(articleInputSchema.parse(noCheckbox).visible).toBe(false);
    expect(
      articleInputSchema.parse({ ...valid, imageUrl: "https://x.test/a.jpg" })
        .imageUrl,
    ).toBe("https://x.test/a.jpg");
    expect(
      articleInputSchema.safeParse({ ...valid, imageUrl: "http://x.test/a" })
        .success,
    ).toBe(false);
  });

  it("refuse titre vide, catégorie inconnue, date non ISO, emoji hors liste", () => {
    expect(articleInputSchema.safeParse({ ...valid, title: " " }).success).toBe(
      false,
    );
    expect(
      articleInputSchema.safeParse({ ...valid, category: "sport" }).success,
    ).toBe(false);
    expect(
      articleInputSchema.safeParse({ ...valid, publishedAt: "13/09/2026" })
        .success,
    ).toBe(false);
    expect(
      articleInputSchema.safeParse({ ...valid, illustration: "🚀" }).success,
    ).toBe(false);
  });
});

describe("deleteArticleSchema", () => {
  it("exige confirm=oui", () => {
    expect(
      deleteArticleSchema.safeParse({ articleId: "art-0001", confirm: "oui" })
        .success,
    ).toBe(true);
    expect(
      deleteArticleSchema.safeParse({ articleId: "art-0001" }).success,
    ).toBe(false);
  });
});

describe("articleVisibilitySchema", () => {
  it("convertit 1/0 en booléen et refuse le reste", () => {
    expect(
      articleVisibilitySchema.parse({ articleId: "a", visible: "1" }).visible,
    ).toBe(true);
    expect(
      articleVisibilitySchema.parse({ articleId: "a", visible: "0" }).visible,
    ).toBe(false);
    expect(
      articleVisibilitySchema.safeParse({ articleId: "a", visible: "true" })
        .success,
    ).toBe(false);
  });
});
