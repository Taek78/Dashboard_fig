import { describe, expect, it } from "vitest";
import {
  ROLES,
  canAddCustomerNote,
  canChangeOrderStatus,
  canEditArticle,
  canEditProduct,
} from "@/domain/auth/roles";

describe("ROLES", () => {
  it("expose exactement les trois rôles du back-office", () => {
    expect(ROLES).toEqual(["admin", "gestionnaire", "lecture"]);
  });
});

describe("règles d'écriture : admin et gestionnaire oui, lecture non", () => {
  const rules = {
    canChangeOrderStatus,
    canEditProduct,
    canEditArticle,
    canAddCustomerNote,
  };
  for (const [name, rule] of Object.entries(rules)) {
    it.each([
      ["admin", true],
      ["gestionnaire", true],
      ["lecture", false],
    ] as const)(`${name}(%s) → %s`, (role, expected) => {
      expect(rule(role)).toBe(expected);
    });
  }
});
