import { describe, expect, it } from "vitest";
import {
  ROLES,
  SECTION_ACCESS,
  SECTIONS,
  canAddCustomerNote,
  canChangeOrderStatus,
  canEditArticle,
  canEditProduct,
  canManageUsers,
  canViewSection,
  homeFor,
  sectionOf,
} from "@/domain/auth/roles";
import { NAV_ITEMS } from "@/lib/navigation";

describe("ROLES", () => {
  it("expose les quatre rôles du back-office", () => {
    expect(ROLES).toEqual(["admin", "gestionnaire", "lecture", "livreur"]);
  });
});

describe("règles d'écriture : admin et gestionnaire oui, lecture non", () => {
  const rules = { canEditProduct, canEditArticle, canAddCustomerNote };
  for (const [name, rule] of Object.entries(rules)) {
    it.each([
      ["admin", true],
      ["gestionnaire", true],
      ["lecture", false],
      ["livreur", false],
    ] as const)(`${name}(%s) → %s`, (role, expected) => {
      expect(rule(role)).toBe(expected);
    });
  }

  it("le livreur peut faire avancer le statut d'une commande, pas le rôle lecture", () => {
    expect(canChangeOrderStatus("livreur")).toBe(true);
    expect(canChangeOrderStatus("gestionnaire")).toBe(true);
    expect(canChangeOrderStatus("lecture")).toBe(false);
  });
});

describe("lecture des sections", () => {
  it("chaque entrée de navigation est une section connue", () => {
    for (const item of NAV_ITEMS) expect(SECTIONS).toContain(item.href);
  });

  it("sectionOf : racine exacte, préfixe pour les autres, null sinon", () => {
    expect(sectionOf("/")).toBe("/");
    expect(sectionOf("/commandes")).toBe("/commandes");
    expect(sectionOf("/commandes/cmd-0001")).toBe("/commandes");
    expect(sectionOf("/commandesx")).toBeNull();
    expect(sectionOf("/inconnu")).toBeNull();
  });

  it("seul l'admin ouvre /comptes, tout le monde ouvre /profil", () => {
    expect(canViewSection("admin", "/comptes")).toBe(true);
    expect(canViewSection("gestionnaire", "/comptes")).toBe(false);
    expect(canViewSection("lecture", "/comptes")).toBe(false);
    expect(canViewSection("livreur", "/comptes")).toBe(false);
    for (const role of ROLES)
      expect(canViewSection(role, "/profil")).toBe(true);
    expect(canManageUsers("admin")).toBe(true);
    expect(canManageUsers("gestionnaire")).toBe(false);
  });

  it("le livreur ne voit que livraisons, commandes et son profil ; les autres tout sauf /comptes", () => {
    expect(canViewSection("livreur", "/livraisons?date=2026-09-07")).toBe(true);
    expect(canViewSection("livreur", "/commandes/cmd-0001")).toBe(true);
    expect(canViewSection("livreur", "/")).toBe(false);
    expect(canViewSection("livreur", "/metriques")).toBe(false);
    expect(canViewSection("livreur", "/clients/cli-0001")).toBe(false);
    expect(canViewSection("livreur", "/inconnu")).toBe(true);
    for (const section of SECTIONS) {
      expect(canViewSection("admin", section)).toBe(true);
      if (section !== "/comptes") {
        expect(canViewSection("gestionnaire", section)).toBe(true);
        expect(canViewSection("lecture", section)).toBe(true);
      }
    }
  });

  it("homeFor renvoie une section autorisée", () => {
    for (const role of ROLES) {
      expect(SECTION_ACCESS[role]).toContain(homeFor(role));
    }
    expect(homeFor("livreur")).toBe("/livraisons");
    expect(homeFor("admin")).toBe("/");
  });
});
