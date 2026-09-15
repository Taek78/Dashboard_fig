import { describe, expect, it, vi } from "vitest";
import { TEST_ACCOUNTS } from "../../support/config";

/*
 * changeOwnPassword de bout en bout sur la base de test (compte seedé
 * usr-0001) : mot de passe actuel vérifié, nouveau enregistré. Chaque test dans
 * une transaction annulée.
 */
vi.mock("@/data/session", () => ({
  getCurrentUser: async () => ({
    id: "usr-0001",
    name: "Admin E2E",
    role: "admin",
  }),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () =>
  import("../../support/test-database").then((m) => m.dbClientMock),
);
vi.mock("@/data/security-log", () => ({ logSecurity: vi.fn() }));

const { isolateEachTest } = await import("../../support/test-database");
isolateEachTest();

const { changeOwnPassword } = await import("@/app/(dashboard)/profil/actions");
const { findUserById } = await import("@/data/users");
const { verifyPassword } = await import("@/lib/password");
const { idleActionResult } = await import("@/lib/action-result");

const CURRENT = TEST_ACCOUNTS.admin.password;

function run(fields: Record<string, string>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.append(k, v);
  return changeOwnPassword(idleActionResult, data);
}

describe("changeOwnPassword", () => {
  it("refuse un mot de passe actuel faux sans rien changer", async () => {
    expect(
      await run({
        currentPassword: "Pas-le-bon-mdp-123",
        newPassword: "Nouveau-mot-de-passe",
        confirmPassword: "Nouveau-mot-de-passe",
      }),
    ).toEqual({
      status: "error",
      message: "Le mot de passe actuel est incorrect.",
    });
    const account = await findUserById("usr-0001");
    expect(await verifyPassword(CURRENT, account!.passwordHash)).toBe(true);
  });

  it("refuse une confirmation différente", async () => {
    const result = await run({
      currentPassword: CURRENT,
      newPassword: "Nouveau-mot-de-passe",
      confirmPassword: "Autre-mot-de-passe-9",
    });
    expect(result.status).toBe("error");
  });

  it("enregistre le nouveau mot de passe quand l'actuel est bon", async () => {
    expect(
      await run({
        currentPassword: CURRENT,
        newPassword: "Nouveau-mot-de-passe",
        confirmPassword: "Nouveau-mot-de-passe",
      }),
    ).toEqual({ status: "success", message: "Mot de passe modifié." });
    const account = await findUserById("usr-0001");
    expect(
      await verifyPassword("Nouveau-mot-de-passe", account!.passwordHash),
    ).toBe(true);
  });
});
