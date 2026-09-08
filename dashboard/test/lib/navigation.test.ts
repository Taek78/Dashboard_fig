import { describe, expect, it } from "vitest";
import { NAV_ITEMS, isNavActive } from "@/lib/navigation";

describe("NAV_ITEMS", () => {
  it("pointe vers les cinq sections du back-office, racine en premier", () => {
    expect(NAV_ITEMS.map((i) => i.href)).toEqual([
      "/",
      "/commandes",
      "/catalogue",
      "/clients",
      "/metriques",
    ]);
  });

  it("a des hrefs uniques et sans slash final", () => {
    const hrefs = NAV_ITEMS.map((i) => i.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const href of hrefs) {
      if (href !== "/") expect(href.endsWith("/")).toBe(false);
    }
  });
});

describe("isNavActive", () => {
  it("racine : active seulement sur / exactement", () => {
    expect(isNavActive("/", "/")).toBe(true);
    expect(isNavActive("/commandes", "/")).toBe(false);
  });

  it("section : active sur la page et ses sous-pages", () => {
    expect(isNavActive("/commandes", "/commandes")).toBe(true);
    expect(isNavActive("/commandes/cmd-0001", "/commandes")).toBe(true);
  });

  it("section : inactive sur une autre section ou un préfixe trompeur", () => {
    expect(isNavActive("/clients", "/commandes")).toBe(false);
    expect(isNavActive("/commandes-archive", "/commandes")).toBe(false);
  });
});
