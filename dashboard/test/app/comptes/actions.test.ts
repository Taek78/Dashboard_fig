import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Server Actions de la gestion des comptes, de bout en bout sur le mock :
 * session simulée (rôle et id pilotables), server-only et env neutralisés,
 * revalidatePath espionné, journal de sécurité neutralisé.
 */
const session = vi.hoisted(() => ({ id: "usr-0001", role: "admin" }));
vi.mock("@/data/session", () => ({
  getCurrentUser: async () => ({
    id: session.id,
    name: "Testeur",
    role: session.role,
  }),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/env", () => ({
  getEnv: () => ({
    DATA_SOURCE: "mock",
    AUTH_BOOTSTRAP_EMAIL: "admin@fig.invalid",
    AUTH_BOOTSTRAP_PASSWORD: "Admin-mot-de-passe-1",
    AUTH_BOOTSTRAP_NAME: "Admin",
  }),
}));
const revalidatePath = vi.fn();
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/data/security-log", () => ({ logSecurity: vi.fn() }));

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

beforeEach(async () => {
  session.id = "usr-0001";
  session.role = "admin";
  revalidatePath.mockClear();
  // Le store mock est un singleton : on remet chaque compte de test à plat.
  for (const u of await listUsers()) {
    if (u.id !== "usr-0001") {
      await (await import("@/data/users")).updateUser(u.id, { active: false });
    }
  }
});
afterEach(() => vi.useRealTimers());

describe("createAccount", () => {
  it("crée un compte avec un hachage vérifiable, puis refuse le doublon", async () => {
    const email = `nour-${Date.now()}@fig.invalid`;
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

    const again = await run(createAccount, {
      email: email.toUpperCase(),
      name: "Nour bis",
      role: "lecture",
      password: "Nour-mot-de-passe-2",
    });
    expect(again).toEqual({
      status: "error",
      message: "Un compte existe déjà avec cet e-mail.",
    });
  });

  it("refuse un non-administrateur et une saisie invalide", async () => {
    session.role = "gestionnaire";
    expect(
      (
        await run(createAccount, {
          email: "x@y.invalid",
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
          email: "x@y.invalid",
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
    if (demote.status === "error")
      expect(demote.message).toContain("dernier administrateur");
  });

  it("désactive puis réactive un autre compte, qui ne peut plus se connecter entre-temps", async () => {
    const email = `lea-${Date.now()}@fig.invalid`;
    await run(createAccount, {
      email,
      name: "Léa",
      role: "lecture",
      password: "Lea-mot-de-passe-12",
    });
    const created = (await listUsers()).find((u) => u.email === email)!;
    const off = await run(setAccountActive, {
      userId: created.id,
      active: "0",
    });
    expect(off.status).toBe("success");
    expect(await findUserByEmail(email)).toBeNull();
    const on = await run(setAccountActive, { userId: created.id, active: "1" });
    expect(on.status).toBe("success");
    expect((await findUserByEmail(email))?.id).toBe(created.id);
  });
});

describe("resetAccountPassword", () => {
  it("remplace le hachage d'un compte existant", async () => {
    const email = `sam-${Date.now()}@fig.invalid`;
    await run(createAccount, {
      email,
      name: "Sam",
      role: "livreur",
      password: "Sam-mot-de-passe-12",
    });
    const created = (await listUsers()).find((u) => u.email === email)!;
    const result = await run(resetAccountPassword, {
      userId: created.id,
      password: "Sam-nouveau-mdp-34",
    });
    expect(result.status).toBe("success");
    const account = await findUserByEmail(email);
    expect(
      await verifyPassword("Sam-nouveau-mdp-34", account!.passwordHash),
    ).toBe(true);
    expect(
      await verifyPassword("Sam-mot-de-passe-12", account!.passwordHash),
    ).toBe(false);
    expect(
      (
        await run(resetAccountPassword, {
          userId: "nope",
          password: "Sam-nouveau-mdp-34",
        })
      ).status,
    ).toBe("error");
  });
});
