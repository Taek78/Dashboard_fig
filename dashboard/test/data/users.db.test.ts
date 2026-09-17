import { describe, expect, it, vi } from "vitest";
import { TEST_ACCOUNTS } from "../support/config";

/*
 * Comptes du back-office sur la base de test (seedée avec les comptes de test
 * usr-0001 « Admin E2E » admin et usr-0002 « Gestion E2E » gestionnaire :
 * prénom puis nom, le nom « E2E » étant commun aux deux), chaque test dans
 * une transaction annulée. Aucun mot de passe en clair en base : seulement
 * des hachages.
 */
vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () =>
  import("../support/test-database").then((m) => m.dbClientMock),
);
const { isolateEachTest } = await import("../support/test-database");
isolateEachTest();

const { usersDb } = await import("@/data/users.db");
const { authTokensDb } = await import("@/data/auth-tokens.db");
const { verifyPassword } = await import("@/lib/password");

describe("usersDb : connexion", () => {
  it("retrouve un compte seedé, insensible à la casse de l'e-mail, avec un hachage vérifiable", async () => {
    const found = await usersDb.findUserByEmail(
      TEST_ACCOUNTS.admin.email.toUpperCase(),
    );
    expect(found).toMatchObject({
      id: "usr-0001",
      role: "admin",
      firstName: "Admin",
      lastName: "E2E",
      name: "Admin E2E",
    });
    expect(
      await verifyPassword(TEST_ACCOUNTS.admin.password, found!.passwordHash!),
    ).toBe(true);
    expect(found).toMatchObject({ active: true, passwordChangedAt: null });
    expect(
      await usersDb.findUserByEmail("inconnu@fig-demo.invalid"),
    ).toBeNull();
  });

  it("un compte désactivé ne se connecte plus mais reste lisible par id", async () => {
    await usersDb.updateUser("usr-0002", { active: false });
    expect(
      await usersDb.findUserByEmail(TEST_ACCOUNTS.manager.email),
    ).toBeNull();
    expect((await usersDb.findUserById("usr-0002"))?.id).toBe("usr-0002");
    expect((await usersDb.getUser("usr-0002"))?.active).toBe(false);
  });
});

describe("usersDb : gestion des comptes", () => {
  it("crée un compte sans exposer le hachage, refuse un e-mail déjà pris", async () => {
    const created = await usersDb.createUser({
      email: "nour@fig-demo.invalid",
      firstName: "Nour",
      lastName: "Benali",
      role: "gestionnaire",
      passwordHash: "scrypt$a$b",
    });
    expect(created).toMatchObject({
      email: "nour@fig-demo.invalid",
      firstName: "Nour",
      lastName: "Benali",
      name: "Nour Benali",
      role: "gestionnaire",
      active: true,
    });
    expect(created).not.toHaveProperty("passwordHash");
    expect(
      await usersDb.createUser({
        email: TEST_ACCOUNTS.admin.email.toUpperCase(),
        firstName: "Doublon",
        lastName: "Adresse",
        role: "lecture",
        passwordHash: "scrypt$c$d",
      }),
    ).toBe("email_taken");
    expect((await usersDb.listUsers()).map((u) => u.name)).toEqual(
      expect.arrayContaining(["Admin E2E", "Gestion E2E", "Nour Benali"]),
    );
  });

  it("met à jour prénom, nom et rôle, change le mot de passe, null ou false si inconnu", async () => {
    expect(
      await usersDb.updateUser("usr-0002", {
        firstName: "Zaki",
        lastName: "Affane",
        role: "lecture",
      }),
    ).toMatchObject({ name: "Zaki Affane", role: "lecture" });
    // Un seul des deux champs : l'autre est relu.
    expect(
      await usersDb.updateUser("usr-0002", { firstName: "Zak" }),
    ).toMatchObject({ firstName: "Zak", lastName: "Affane" });
    expect(await usersDb.updateUser("nope", { firstName: "x" })).toBeNull();
    const at = new Date("2026-09-17T10:00:00.000Z");
    expect(await usersDb.setPassword("usr-0002", "scrypt$n$n", at)).toBe(true);
    expect(await usersDb.findUserById("usr-0002")).toMatchObject({
      passwordHash: "scrypt$n$n",
      passwordChangedAt: at.toISOString(),
    });
    expect(await usersDb.setPassword("nope", "scrypt$n$n", at)).toBe(false);
  });

  it("revokeSessions ne pose que l'instant, sans toucher au mot de passe", async () => {
    const before = await usersDb.findUserById("usr-0002");
    const at = new Date("2026-09-17T11:00:00.000Z");
    expect(await usersDb.revokeSessions("usr-0002", at)).toBe(true);
    expect(await usersDb.findUserById("usr-0002")).toMatchObject({
      passwordHash: before!.passwordHash,
      passwordChangedAt: at.toISOString(),
    });
    expect(await usersDb.revokeSessions("nope", at)).toBe(false);
  });

  it("supprime un compte et ses jetons en cascade ; faux si inconnu", async () => {
    await authTokensDb.createToken({
      kind: "invitation",
      userId: "usr-0002",
      secretHash: "a".repeat(64),
      expiresAt: new Date("2026-09-19T10:00:00.000Z"),
      requestedIp: null,
    });
    expect(await usersDb.deleteUser("usr-0002")).toBe(true);
    expect(await usersDb.findUserById("usr-0002")).toBeNull();
    expect(await usersDb.getUser("usr-0002")).toBeNull();
    expect(await authTokensDb.findActiveToken("invitation", "usr-0002")).toBe(
      null,
    );
    expect(await usersDb.deleteUser("usr-0002")).toBe(false);
    expect(await usersDb.deleteUser("nope")).toBe(false);
  });
});

describe("usersDb : prénom et nom uniques, rappel d'adresse par le nom", () => {
  it("retrouve les comptes actifs par le nom seul, sans casse ni accent, homonymes compris", async () => {
    const byName = await usersDb.findUsersByLastName("e2e");
    expect(byName.map((u) => u.id).toSorted()).toEqual([
      "usr-0001",
      "usr-0002",
    ]);
    expect(
      (await usersDb.findUsersByLastName("  É2E ")).map((u) => u.id).toSorted(),
    ).toEqual(["usr-0001", "usr-0002"]);
    expect(await usersDb.findUsersByLastName("Inconnu")).toEqual([]);
    // Le prénom seul ne suffit pas.
    expect(await usersDb.findUsersByLastName("Gestion")).toEqual([]);
    await usersDb.updateUser("usr-0002", { active: false });
    expect((await usersDb.findUsersByLastName("E2E")).map((u) => u.id)).toEqual(
      ["usr-0001"],
    );
  });

  it("refuse un prénom et un nom déjà pris ensemble, à la création et au renommage", async () => {
    expect(
      await usersDb.createUser({
        email: "autre@fig-demo.invalid",
        firstName: "gestion",
        lastName: "e2e",
        role: "lecture",
        passwordHash: null,
      }),
    ).toBe("name_taken");
    // Même nom, autre prénom : permis (deux homonymes reçoivent chacun leur rappel).
    expect(
      await usersDb.createUser({
        email: "homonyme@fig-demo.invalid",
        firstName: "Autre",
        lastName: "E2E",
        role: "lecture",
        passwordHash: null,
      }),
    ).toMatchObject({ name: "Autre E2E" });
    expect(
      await usersDb.updateUser("usr-0002", {
        firstName: "ADMIN",
        lastName: "e2e",
      }),
    ).toBe("name_taken");
    // Un seul champ modifié qui recrée un doublon est refusé aussi.
    expect(await usersDb.updateUser("usr-0002", { firstName: "Admin" })).toBe(
      "name_taken",
    );
    // Se renommer soi-même avec son propre nom reste permis.
    expect(
      await usersDb.updateUser("usr-0002", {
        firstName: "Gestion",
        lastName: "E2E",
      }),
    ).toMatchObject({ name: "Gestion E2E" });
  });

  it("un compte créé sans mot de passe n'a pas de hachage et ne se connecte pas", async () => {
    const created = await usersDb.createUser({
      email: "invite@fig-demo.invalid",
      firstName: "Invité",
      lastName: "Test",
      role: "lecture",
      passwordHash: null,
    });
    expect(created).toMatchObject({ hasPassword: false, active: true });
    const account = await usersDb.findUserByEmail("invite@fig-demo.invalid");
    expect(account?.passwordHash).toBeNull();
  });
});
