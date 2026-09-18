import { describe, expect, it } from "vitest";
import {
  activeAdmins,
  countActiveAdmins,
  fullName,
  invitationState,
  isLastActiveAdmin,
  isSessionAlive,
  sortUsers,
  splitFullName,
  wouldRemoveLastAdmin,
} from "@/domain/auth/rules";
import type { ManagedUser } from "@/domain/auth/types";

const u = (
  id: string,
  firstName: string,
  lastName: string,
  role: ManagedUser["role"],
  active = true,
  hasPassword = true,
): ManagedUser => ({
  id,
  firstName,
  lastName,
  name: fullName({ firstName, lastName }),
  email: `${id}@fig.invalid`,
  role,
  active,
  hasPassword,
  invitationMail: null,
  invitationExpiresAt: null,
  createdAt: "2026-09-14T08:00:00.000Z",
});

const users = [
  u("a", "Zoé", "Martin", "admin"),
  u("b", "Amel", "Benali", "gestionnaire"),
  u("c", "Bruno", "Adam", "lecture", false),
  u("d", "Élise", "Moreau", "admin", false),
];

describe("fullName / splitFullName", () => {
  it("compose « Prénom Nom » sans espace superflu, prénom vide compris", () => {
    expect(fullName({ firstName: "Zoé", lastName: "Martin" })).toBe(
      "Zoé Martin",
    );
    expect(fullName({ firstName: "", lastName: "Martin" })).toBe("Martin");
  });

  it("découpe un nom d'amorçage : premier mot = prénom, le reste = nom ; un seul mot = nom seul", () => {
    expect(splitFullName("Zaki Affane")).toEqual({
      firstName: "Zaki",
      lastName: "Affane",
    });
    expect(splitFullName("  Jean  Le Gall ")).toEqual({
      firstName: "Jean",
      lastName: "Le Gall",
    });
    expect(splitFullName("Administrateur")).toEqual({
      firstName: "",
      lastName: "Administrateur",
    });
    expect(splitFullName("   ")).toEqual({ firstName: "", lastName: "" });
  });
});

describe("sortUsers", () => {
  it("met les actifs d'abord, puis l'ordre français des noms puis des prénoms, sans muter", () => {
    const withHomonym = [...users, u("e", "Anne", "Martin", "lecture")];
    expect(sortUsers(withHomonym).map((x) => x.name)).toEqual([
      "Amel Benali",
      "Anne Martin",
      "Zoé Martin",
      "Bruno Adam",
      "Élise Moreau",
    ]);
    expect(users[0]?.name).toBe("Zoé Martin");
  });
});

describe("isLastActiveAdmin / wouldRemoveLastAdmin", () => {
  it("ne compte que les administrateurs actifs", () => {
    expect(countActiveAdmins(users)).toBe(1);
    expect(isLastActiveAdmin(users, "a")).toBe(true);
    expect(isLastActiveAdmin(users, "b")).toBe(false);
    expect(isLastActiveAdmin(users, "d")).toBe(false);
    expect(isLastActiveAdmin(users, "zzz")).toBe(false);
  });

  it("refuse de désactiver ou rétrograder le dernier admin actif", () => {
    expect(wouldRemoveLastAdmin(users, "a", { active: false })).toBe(true);
    expect(wouldRemoveLastAdmin(users, "a", { role: "lecture" })).toBe(true);
    expect(wouldRemoveLastAdmin(users, "a", { role: "admin" })).toBe(false);
    expect(wouldRemoveLastAdmin(users, "a", { firstName: "Z" })).toBe(false);
  });

  it("laisse faire quand un autre admin actif existe, ou sur un non-admin", () => {
    const two = [...users, u("e", "Nour", "Haddad", "admin")];
    expect(isLastActiveAdmin(two, "a")).toBe(false);
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

  it("un administrateur invité, sans mot de passe, ne compte pas : ni contact, ni dernier admin, et son invitation s'annule", () => {
    const invited = u("f", "Lina", "Cohen", "admin", true, false);
    const withInvited = [...users, invited];
    expect(activeAdmins(withInvited).map((x) => x.id)).toEqual(["a"]);
    expect(isLastActiveAdmin(withInvited, "a")).toBe(true);
    expect(isLastActiveAdmin(withInvited, "f")).toBe(false);
    expect(wouldRemoveLastAdmin(withInvited, "a", { active: false })).toBe(
      true,
    );
  });
});

describe("invitationState", () => {
  const now = Date.parse("2026-09-17T12:00:00.000Z");
  const pending = {
    ...u("p", "Nour", "Benali", "lecture", true, false),
    invitationExpiresAt: "2026-09-19T12:00:00.000Z",
  };

  it("« none » dès que le mot de passe existe, quel que soit le lien", () => {
    expect(invitationState(u("a", "Z", "M", "admin"), now)).toBe("none");
    expect(
      invitationState(
        { ...pending, hasPassword: true, invitationExpiresAt: null },
        now,
      ),
    ).toBe("none");
  });

  it("« pending » tant que le dernier lien est valable, « expired » ensuite ou sans lien", () => {
    expect(invitationState(pending, now)).toBe("pending");
    expect(
      invitationState(pending, Date.parse("2026-09-19T12:00:00.000Z")),
    ).toBe("expired");
    expect(
      invitationState({ ...pending, invitationExpiresAt: null }, now),
    ).toBe("expired");
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
