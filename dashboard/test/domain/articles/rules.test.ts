import { describe, expect, it } from "vitest";
import {
  excerpt,
  paragraphs,
  publicationState,
  sortArticlesNewestFirst,
} from "@/domain/articles/rules";
import { articlesFixtures } from "@/domain/articles/fixtures";
import type { Article } from "@/domain/articles/types";

const base: Article = {
  id: "a",
  title: "Titre",
  body: "Texte",
  category: "nutrition",
  illustration: "🥗",
  imageUrl: null,
  publishedAt: "2026-09-01",
  visible: true,
  updatedAt: "2026-09-01T00:00:00.000Z",
};

describe("sortArticlesNewestFirst", () => {
  it("trie par parution décroissante, puis modification, puis titre", () => {
    const list: Article[] = [
      { ...base, id: "1", publishedAt: "2026-08-01" },
      { ...base, id: "2", publishedAt: "2026-09-10" },
      { ...base, id: "3", publishedAt: "2026-09-10", title: "Avant" },
      {
        ...base,
        id: "4",
        publishedAt: "2026-09-10",
        title: "Avant",
        updatedAt: "2026-09-12T00:00:00.000Z",
      },
    ];
    expect(sortArticlesNewestFirst(list).map((a) => a.id)).toEqual([
      "4",
      "3",
      "2",
      "1",
    ]);
    expect(list.map((a) => a.id)).toEqual(["1", "2", "3", "4"]);
  });

  it("les fixtures ressortent du plus récent au plus ancien", () => {
    const dates = sortArticlesNewestFirst(articlesFixtures).map(
      (a) => a.publishedAt,
    );
    expect(dates).toEqual([...dates].toSorted().toReversed());
  });
});

describe("excerpt", () => {
  it("normalise les espaces et coupe au dernier mot entier avec une ellipse", () => {
    expect(excerpt("Un  texte\n\ncourt ")).toBe("Un texte court");
    expect(excerpt("Les carottes sont cuites depuis longtemps", 20)).toBe(
      "Les carottes sont…",
    );
    expect(excerpt("Supercalifragilistique", 5)).toBe("Super…");
  });
});

describe("publicationState", () => {
  it("masqué l'emporte, programmé si daté après aujourd'hui, en ligne sinon", () => {
    const today = "2026-09-13";
    expect(
      publicationState({ visible: false, publishedAt: "2026-09-01" }, today),
    ).toBe("hidden");
    expect(
      publicationState({ visible: true, publishedAt: "2026-09-20" }, today),
    ).toBe("scheduled");
    expect(
      publicationState({ visible: true, publishedAt: "2026-09-13" }, today),
    ).toBe("published");
  });
});

describe("paragraphs", () => {
  it("coupe sur les lignes vides et ignore les blancs", () => {
    expect(paragraphs("Un.\n\nDeux.\n  \nTrois.\n")).toEqual([
      "Un.",
      "Deux.",
      "Trois.",
    ]);
  });
});
