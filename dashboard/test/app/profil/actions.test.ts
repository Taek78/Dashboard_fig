import { describe, expect, it, vi } from "vitest";

/* changeOwnPassword de bout en bout sur le mock : mot de passe actuel vérifié, nouveau enregistré. */
vi.mock("@/data/session", () => ({
  getCurrentUser: async () => ({
    id: "usr-0001",
    name: "Admin",
    role: "admin",
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
vi.mock("@/data/security-log", () => ({ logSecurity: vi.fn() }));

const { changeOwnPassword } = await import("@/app/(dashboard)/profil/actions");
const { findUserById } = await import("@/data/users");
const { verifyPassword } = await import("@/lib/password");
const { idleActionResult } = await import("@/lib/action-result");

function run(fields: Record<string, string>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.append(k, v);
  return changeOwnPassword(idleActionResult, data);
}

describe("changeOwnPassword", () => {
  it("refuse un mot de passe actuel faux sans rien changer", async () => {
    const result = await run({
      currentPassword: "Pas-le-bon-mdp-123",
      newPassword: "Nouveau-mot-de-passe",
      confirmPassword: "Nouveau-mot-de-passe",
    });
    expect(result).toEqual({
      status: "error",
      message: "Le mot de passe actuel est incorrect.",
    });
    const account = await findUserById("usr-0001");
    expect(
      await verifyPassword("Admin-mot-de-passe-1", account!.passwordHash),
    ).toBe(true);
  });

  it("refuse une confirmation différente", async () => {
    const result = await run({
      currentPassword: "Admin-mot-de-passe-1",
      newPassword: "Nouveau-mot-de-passe",
      confirmPassword: "Autre-mot-de-passe-9",
    });
    expect(result.status).toBe("error");
  });

  it("enregistre le nouveau mot de passe quand l'actuel est bon", async () => {
    const result = await run({
      currentPassword: "Admin-mot-de-passe-1",
      newPassword: "Nouveau-mot-de-passe",
      confirmPassword: "Nouveau-mot-de-passe",
    });
    expect(result).toEqual({
      status: "success",
      message: "Mot de passe modifié.",
    });
    const account = await findUserById("usr-0001");
    expect(
      await verifyPassword("Nouveau-mot-de-passe", account!.passwordHash),
    ).toBe(true);
  });
});
