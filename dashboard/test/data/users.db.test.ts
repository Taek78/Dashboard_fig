import { describe, expect, it, vi } from "vitest";
import { TEST_ACCOUNTS } from "../support/config";

/*
 * Comptes du back-office sur la base de test (seedée avec les comptes de test
 * usr-0001 admin et usr-0002 gestionnaire), chaque test dans une transaction
 * annulée. Aucun mot de passe en clair en base : seulement des hachages.
 */
vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () =>
  import("../support/test-database").then((m) => m.dbClientMock),
);
const { isolateEachTest } = await import("../support/test-database");
isolateEachTest();

const { usersDb } = await import("@/data/users.db");
const { verifyPassword } = await import("@/lib/password");

describe("usersDb : connexion", () => {
  it("retrouve un compte seedé, insensible à la casse de l'e-mail, avec un hachage vérifiable", async () => {
    const found = await usersDb.findUserByEmail(
      TEST_ACCOUNTS.admin.email.toUpperCase(),
    );
    expect(found).toMatchObject({ id: "usr-0001", role: "admin" });
    expect(
      await verifyPassword(TEST_ACCOUNTS.admin.password, found!.passwordHash),
    ).toBe(true);
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
      name: "Nour",
      role: "gestionnaire",
      passwordHash: "scrypt$a$b",
    });
    expect(created).toMatchObject({
      email: "nour@fig-demo.invalid",
      name: "Nour",
      role: "gestionnaire",
      active: true,
    });
    expect(created).not.toHaveProperty("passwordHash");
    expect(
      await usersDb.createUser({
        email: TEST_ACCOUNTS.admin.email.toUpperCase(),
        name: "Doublon",
        role: "lecture",
        passwordHash: "scrypt$c$d",
      }),
    ).toBe("email_taken");
    expect((await usersDb.listUsers()).map((u) => u.name)).toEqual(
      expect.arrayContaining(["Admin E2E", "Gestion E2E", "Nour"]),
    );
  });

  it("met à jour nom et rôle, change le mot de passe, null ou false si inconnu", async () => {
    expect(
      await usersDb.updateUser("usr-0002", { name: "Zaki", role: "lecture" }),
    ).toMatchObject({ name: "Zaki", role: "lecture" });
    expect(await usersDb.updateUser("nope", { name: "x" })).toBeNull();
    expect(await usersDb.setPassword("usr-0002", "scrypt$n$n")).toBe(true);
    expect((await usersDb.findUserById("usr-0002"))?.passwordHash).toBe(
      "scrypt$n$n",
    );
    expect(await usersDb.setPassword("nope", "scrypt$n$n")).toBe(false);
  });
});
