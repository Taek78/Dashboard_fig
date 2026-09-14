import { beforeEach, describe, expect, it } from "vitest";
import {
  MOCK_CREATED_AT,
  resetUsersMock,
  seedUsersMock,
  usersMock,
} from "@/data/users.mock";

beforeEach(() => resetUsersMock());

const admin = {
  id: "usr-0001",
  email: "Admin@Example.invalid",
  name: "Admin",
  role: "admin" as const,
  passwordHash: "scrypt$x$y",
};

describe("usersMock : connexion", () => {
  it("est vide tant qu'il n'est pas seedé : aucun compte en dur", async () => {
    expect(await usersMock.findUserByEmail("admin@example.invalid")).toBeNull();
    expect(await usersMock.listUsers()).toEqual([]);
  });

  it("retrouve un compte seedé, insensible à la casse de l'e-mail, en copie", async () => {
    seedUsersMock([admin]);
    const found = await usersMock.findUserByEmail("admin@example.invalid");
    expect(found?.id).toBe("usr-0001");
    found!.role = "lecture";
    expect(
      (await usersMock.findUserByEmail("ADMIN@example.invalid"))?.role,
    ).toBe("admin");
  });

  it("un compte désactivé ne se connecte plus mais reste lisible par id", async () => {
    seedUsersMock([admin]);
    await usersMock.updateUser("usr-0001", { active: false });
    expect(await usersMock.findUserByEmail("admin@example.invalid")).toBeNull();
    expect((await usersMock.findUserById("usr-0001"))?.id).toBe("usr-0001");
    expect((await usersMock.getUser("usr-0001"))?.active).toBe(false);
  });
});

describe("usersMock : gestion des comptes", () => {
  it("crée un compte sans exposer le hachage, refuse un e-mail déjà pris", async () => {
    seedUsersMock([admin]);
    const created = await usersMock.createUser({
      email: "nour@example.invalid",
      name: "Nour",
      role: "gestionnaire",
      passwordHash: "scrypt$a$b",
    });
    expect(created).toEqual({
      id: "usr-m-1",
      email: "nour@example.invalid",
      name: "Nour",
      role: "gestionnaire",
      active: true,
      createdAt: MOCK_CREATED_AT,
    });
    expect(
      await usersMock.createUser({
        email: "ADMIN@example.invalid",
        name: "Doublon",
        role: "lecture",
        passwordHash: "scrypt$c$d",
      }),
    ).toBe("email_taken");
    expect((await usersMock.listUsers()).map((u) => u.name)).toEqual([
      "Admin",
      "Nour",
    ]);
  });

  it("met à jour nom et rôle, change le mot de passe, null ou false si inconnu", async () => {
    seedUsersMock([admin]);
    expect(
      await usersMock.updateUser("usr-0001", { name: "Zaki", role: "lecture" }),
    ).toMatchObject({ name: "Zaki", role: "lecture" });
    expect(await usersMock.updateUser("nope", { name: "x" })).toBeNull();
    expect(await usersMock.setPassword("usr-0001", "scrypt$n$n")).toBe(true);
    expect((await usersMock.findUserById("usr-0001"))?.passwordHash).toBe(
      "scrypt$n$n",
    );
    expect(await usersMock.setPassword("nope", "scrypt$n$n")).toBe(false);
  });
});
