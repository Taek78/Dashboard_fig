import { beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_ACCOUNTS } from "../../support/config";

/*
 * Server Actions de la gestion des comptes, de bout en bout sur la base de
 * test (comptes seedés : usr-0001 admin, usr-0002 gestionnaire) : session
 * simulée (rôle et id pilotables), server-only neutralisé, revalidatePath
 * espionné, journal de sécurité neutralisé. Chaque test dans une transaction
 * annulée.
 */
const session = vi.hoisted(() => ({ id: "usr-0001", role: "admin" }));
vi.mock("@/data/session", () => ({
  getCurrentUser: async () => ({
    id: session.id,
    name: "Admin E2E",
    role: session.role,
  }),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () =>
  import("../../support/test-database").then((m) => m.dbClientMock),
);
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/data/security-log", () => ({ logSecurity: vi.fn() }));

const { isolateEachTest } = await import("../../support/test-database");
isolateEachTest();

const { createAccount, resetAccountPassword, setAccountActive, updateAccount } =
  await import("@/app/(dashboard)/comptes/actions");
const { listUsers, findUserByEmail } = await import("@/data/users");
const { verifyPassword } = await import("@/lib/password");
const { idleActionResult } = await import("@/lib/action-result");

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.append(k, v);
  return data;
}
const run = (action: typeof createAccount, fields: Record<string, string>) =>
  action(idleActionResult, form(fields));

beforeEach(() => {
  session.id = "usr-0001";
  session.role = "admin";
  revalidatePath.mockClear();
});

describe("createAccount", () => {
  it("crée un compte avec un hachage vérifiable, puis refuse le doublon", async () => {
    const email = "nour@fig-demo.invalid";
    const result = await run(createAccount, {
      email,
      name: "Nour",
      role: "gestionnaire",
      password: "Nour-mot-de-passe-1",
    });
    expect(result.status).toBe("success");
    const account = await findUserByEmail(email);
    expect(account?.role).toBe("gestionnaire");
    expect(
      await verifyPassword("Nour-mot-de-passe-1", account!.passwordHash),
    ).toBe(true);
    expect(revalidatePath).toHaveBeenCalledWith("/comptes", "layout");

    expect(
      await run(createAccount, {
        email: email.toUpperCase(),
        name: "Nour bis",
        role: "lecture",
        password: "Nour-mot-de-passe-2",
      }),
    ).toEqual({
      status: "error",
      message: "Un compte existe déjà avec cet e-mail.",
    });
  });

  it("refuse un non-administrateur et une saisie invalide", async () => {
    session.role = "gestionnaire";
    expect(
      (
        await run(createAccount, {
          email: "x@fig-demo.invalid",
          name: "X",
          role: "lecture",
          password: "Assez-long-oui-1",
        })
      ).status,
    ).toBe("error");
    session.role = "admin";
    expect(
      (
        await run(createAccount, {
          email: "x@fig-demo.invalid",
          name: "X",
          role: "lecture",
          password: "court",
        })
      ).status,
    ).toBe("error");
  });
});

describe("setAccountActive / updateAccount", () => {
  it("interdit de se désactiver soi-même et de retirer le dernier admin", async () => {
    expect(
      await run(setAccountActive, { userId: "usr-0001", active: "0" }),
    ).toEqual({
      status: "error",
      message: "Vous ne pouvez pas désactiver votre propre compte.",
    });
    const demote = await run(updateAccount, {
      userId: "usr-0001",
      name: "Admin",
      role: "lecture",
    });
    expect(demote.status).toBe("error");
    if (demote.status === "error") {
      expect(demote.message).toContain("dernier administrateur");
    }
  });

  it("désactive puis réactive un autre compte, qui ne peut plus se connecter entre-temps", async () => {
    const email = TEST_ACCOUNTS.manager.email;
    expect(
      (await run(setAccountActive, { userId: "usr-0002", active: "0" })).status,
    ).toBe("success");
    expect(await findUserByEmail(email)).toBeNull();
    expect(
      (await run(setAccountActive, { userId: "usr-0002", active: "1" })).status,
    ).toBe("success");
    expect((await findUserByEmail(email))?.id).toBe("usr-0002");
    expect((await listUsers()).find((u) => u.id === "usr-0002")?.active).toBe(
      true,
    );
  });
});

describe("resetAccountPassword", () => {
  it("remplace le hachage d'un compte existant, refuse un compte inconnu", async () => {
    expect(
      (
        await run(resetAccountPassword, {
          userId: "usr-0002",
          password: "Gestion-nouveau-34",
        })
      ).status,
    ).toBe("success");
    const account = await findUserByEmail(TEST_ACCOUNTS.manager.email);
    expect(
      await verifyPassword("Gestion-nouveau-34", account!.passwordHash),
    ).toBe(true);
    expect(
      await verifyPassword(
        TEST_ACCOUNTS.manager.password,
        account!.passwordHash,
      ),
    ).toBe(false);
    expect(
      (
        await run(resetAccountPassword, {
          userId: "nope",
          password: "Gestion-nouveau-34",
        })
      ).status,
    ).toBe("error");
  });
});
