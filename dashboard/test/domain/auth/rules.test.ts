import { describe, expect, it } from "vitest";
import {
  countActiveAdmins,
  sortUsers,
  wouldRemoveLastAdmin,
} from "@/domain/auth/rules";
import type { ManagedUser } from "@/domain/auth/types";

const u = (
  id: string,
  name: string,
  role: ManagedUser["role"],
  active = true,
): ManagedUser => ({
  id,
  name,
  email: `${id}@fig.invalid`,
  role,
  active,
  createdAt: "2026-09-14T08:00:00.000Z",
});

const users = [
  u("a", "Zoé", "admin"),
  u("b", "Amel", "gestionnaire"),
  u("c", "Bruno", "lecture", false),
  u("d", "Élise", "admin", false),
];

describe("sortUsers", () => {
  it("met les actifs d'abord, puis l'ordre français des noms, sans muter", () => {
    expect(sortUsers(users).map((x) => x.name)).toEqual([
      "Amel",
      "Zoé",
      "Bruno",
      "Élise",
    ]);
    expect(users[0]?.name).toBe("Zoé");
  });
});

describe("countActiveAdmins / wouldRemoveLastAdmin", () => {
  it("ne compte que les administrateurs actifs", () => {
    expect(countActiveAdmins(users)).toBe(1);
  });

  it("refuse de désactiver ou rétrograder le dernier admin actif", () => {
    expect(wouldRemoveLastAdmin(users, "a", { active: false })).toBe(true);
    expect(wouldRemoveLastAdmin(users, "a", { role: "lecture" })).toBe(true);
    expect(wouldRemoveLastAdmin(users, "a", { role: "admin" })).toBe(false);
    expect(wouldRemoveLastAdmin(users, "a", { name: "Z" })).toBe(false);
  });

  it("laisse faire quand un autre admin actif existe, ou sur un non-admin", () => {
    const two = [...users, u("e", "Nour", "admin")];
    expect(wouldRemoveLastAdmin(two, "a", { active: false })).toBe(false);
    expect(wouldRemoveLastAdmin(users, "b", { active: false })).toBe(false);
    expect(wouldRemoveLastAdmin(users, "d", { active: false })).toBe(false);
    expect(wouldRemoveLastAdmin(users, "zzz", { active: false })).toBe(false);
  });
});
