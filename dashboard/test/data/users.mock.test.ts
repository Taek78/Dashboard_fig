import { beforeEach, describe, expect, it } from "vitest";
import { resetUsersMock, seedUsersMock, usersMock } from "@/data/users.mock";

beforeEach(() => resetUsersMock());

describe("usersMock", () => {
  it("est vide tant qu'il n'est pas seedé : aucun compte en dur", async () => {
    expect(await usersMock.findUserByEmail("admin@example.invalid")).toBeNull();
  });

  it("retrouve un compte seedé, insensible à la casse de l'e-mail, en copie", async () => {
    seedUsersMock([
      {
        id: "usr-0001",
        email: "Admin@Example.invalid",
        name: "Admin",
        role: "admin",
        passwordHash: "scrypt$x$y",
      },
    ]);
    const found = await usersMock.findUserByEmail("admin@example.invalid");
    expect(found?.id).toBe("usr-0001");
    found!.role = "lecture";
    expect(
      (await usersMock.findUserByEmail("ADMIN@example.invalid"))?.role,
    ).toBe("admin");
  });
});
