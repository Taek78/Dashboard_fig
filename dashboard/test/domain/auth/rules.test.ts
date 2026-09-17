import { describe, expect, it } from "vitest";
import {
  activeAdmins,
  countActiveAdmins,
  isSessionAlive,
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
  hasPassword: true,
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

describe("activeAdmins", () => {
  it("garde les administrateurs actifs seulement", () => {
    expect(activeAdmins(users).map((x) => x.id)).toEqual(["a"]);
    expect(countActiveAdmins(users)).toBe(1);
  });
});

describe("isSessionAlive", () => {
  const changed = "2026-09-17T10:00:00.000Z";
  const at = Date.parse(changed);

  it("un compte inconnu ou désactivé n'a plus de session", () => {
    expect(isSessionAlive(null, at)).toBe(false);
    expect(isSessionAlive({ active: false, passwordChangedAt: null }, at)).toBe(
      false,
    );
  });

  it("sans changement de mot de passe, toute session vit", () => {
    expect(isSessionAlive({ active: true, passwordChangedAt: null }, at)).toBe(
      true,
    );
    expect(
      isSessionAlive({ active: true, passwordChangedAt: null }, undefined),
    ).toBe(true);
  });

  it("une session ouverte avant le changement est fermée, après ou au même instant elle vit", () => {
    const account = { active: true, passwordChangedAt: changed };
    expect(isSessionAlive(account, at - 1)).toBe(false);
    expect(isSessionAlive(account, at)).toBe(true);
    expect(isSessionAlive(account, at + 5_000)).toBe(true);
    // Jeton sans date d'ouverture (ancien format) : fermé.
    expect(isSessionAlive(account, undefined)).toBe(false);
  });
});
