import { describe, expect, it } from "vitest";
import { searchQueryFrom, settleRequests } from "@/lib/search-query";

describe("searchQueryFrom", () => {
  it("garde les valeurs texte non vides, sans espaces de bord, dans l'ordre", () => {
    expect(
      searchQueryFrom([
        ["q", "  amel benali "],
        ["statut", ""],
        ["du", "2026-09-05"],
        ["livreur", "   "],
      ]),
    ).toBe("q=amel+benali&du=2026-09-05");
  });

  it("ignore un fichier et donne une chaîne vide sans aucun filtre", () => {
    const file = new File(["x"], "x.txt");
    expect(searchQueryFrom([["photo", file]])).toBe("");
    expect(searchQueryFrom([])).toBe("");
  });

  it("encode comme URLSearchParams, pour se comparer à l'URL affichée", () => {
    const query = searchQueryFrom([["q", "crèche & co"]]);
    expect(query).toBe(new URLSearchParams({ q: "crèche & co" }).toString());
  });
});

describe("settleRequests", () => {
  it("notre dernière recherche arrive : plus rien en attente, champs gardés", () => {
    expect(settleRequests(["q=ben", "q=bena"], "q=bena")).toEqual({
      pending: [],
      external: false,
    });
  });

  it("une réponse plus ancienne arrive : la plus récente reste attendue, la saisie n'est pas écrasée", () => {
    expect(settleRequests(["q=ben", "q=bena"], "q=ben")).toEqual({
      pending: ["q=bena"],
      external: false,
    });
  });

  it("une URL que nous n'avons pas demandée est une navigation extérieure", () => {
    expect(settleRequests(["q=ben"], "")).toEqual({
      pending: [],
      external: true,
    });
    expect(settleRequests([], "page=2")).toEqual({
      pending: [],
      external: true,
    });
  });
});
