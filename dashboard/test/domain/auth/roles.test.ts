import { describe, expect, it } from "vitest";
import { ROLES, canChangeOrderStatus } from "@/domain/auth/roles";

describe("ROLES", () => {
  it("expose exactement les trois rôles du back-office", () => {
    expect(ROLES).toEqual(["admin", "gestionnaire", "lecture"]);
  });
});

describe("canChangeOrderStatus", () => {
  it.each([
    ["admin", true],
    ["gestionnaire", true],
    ["lecture", false],
  ] as const)("%s → %s", (role, expected) => {
    expect(canChangeOrderStatus(role)).toBe(expected);
  });
});
