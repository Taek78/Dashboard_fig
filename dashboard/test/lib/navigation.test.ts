import { describe, expect, it } from "vitest";
import {
  NAV_ITEMS,
  breadcrumbFor,
  groupNavItems,
  isNavActive,
} from "@/lib/navigation";

describe("NAV_ITEMS", () => {
  it("pointe vers les neuf sections du back-office, racine en premier (plus de Livraisons)", () => {
    expect(NAV_ITEMS.map((i) => i.href)).toEqual([
      "/",
      "/commandes",
      "/catalogue",
      "/articles",
      "/clients",
      "/messages",
      "/personnel",
      "/metriques",
      "/comptes",
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

describe("breadcrumbFor", () => {
  it("une section seule n'a qu'un maillon, non cliquable", () => {
    expect(breadcrumbFor("/commandes")).toEqual([
      { title: "Commandes", href: null },
    ]);
    expect(breadcrumbFor("/")).toEqual([
      { title: "Tableau de bord", href: null },
    ]);
  });

  it("une sous-page ajoute Détail ou Nouveau, la section devient cliquable", () => {
    expect(breadcrumbFor("/commandes/cmd-0001")).toEqual([
      { title: "Commandes", href: "/commandes" },
      { title: "Détail", href: null },
    ]);
    expect(breadcrumbFor("/catalogue/nouveau")).toEqual([
      { title: "Catalogue", href: "/catalogue" },
      { title: "Nouveau", href: null },
    ]);
    expect(breadcrumbFor("/personnel/nouveau")).toEqual([
      { title: "Personnel", href: "/personnel" },
      { title: "Nouveau", href: null },
    ]);
    expect(breadcrumbFor("/clients/communautes/com-0001")).toEqual([
      { title: "Clients", href: "/clients" },
      { title: "Détail", href: null },
    ]);
  });

  it("un chemin hors navigation donne une liste vide", () => {
    expect(breadcrumbFor("/inconnu")).toEqual([]);
  });
});

describe("groupNavItems", () => {
  it("range les neuf sections sous quatre intitulés, dans l'ordre du menu", () => {
    const groups = groupNavItems(NAV_ITEMS);
    expect(groups.map((g) => g.label)).toEqual([
      "Activité",
      "Offre",
      "Clients et équipe",
      "Pilotage",
    ]);
    expect(groups.flatMap((g) => g.items.map((i) => i.href))).toEqual(
      NAV_ITEMS.map((i) => i.href),
    );
  });

  it("n'affiche pas un groupe vide (rôle aux sections limitées)", () => {
    const livreur = NAV_ITEMS.filter((i) =>
      ["/", "/commandes"].includes(i.href),
    );
    expect(groupNavItems(livreur).map((g) => g.group)).toEqual(["activite"]);
  });
});
