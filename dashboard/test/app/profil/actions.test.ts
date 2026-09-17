import { beforeEach, describe, expect, it, vi } from "vitest";
import { TEST_ACCOUNTS } from "../../support/config";

/*
 * changeOwnPassword de bout en bout sur la base de test (compte seedé
 * usr-0001) : mot de passe actuel vérifié, politique appliquée (fuites
 * connues simulées), nouveau enregistré, session rouverte (simulée). Chaque
 * test dans une transaction annulée.
 */
const reopenSession = vi.hoisted(() => vi.fn());
vi.mock("@/data/session", () => ({
  getCurrentUser: async () => ({
    id: "usr-0001",
    name: "Admin E2E",
    role: "admin",
  }),
  reopenSession,
}));
vi.mock("server-only", () => ({}));
vi.mock("@/db/client", () =>
  import("../../support/test-database").then((m) => m.dbClientMock),
);
vi.mock("@/data/security-log", () => ({ logSecurity: vi.fn() }));
vi.mock("@/data/pwned-passwords", () => ({
  isPasswordPwned: async () => false,
}));

const { isolateEachTest } = await import("../../support/test-database");
isolateEachTest();

const { changeOwnPassword } = await import("@/app/(dashboard)/profil/actions");
const { findUserById } = await import("@/data/users");
const { verifyPassword } = await import("@/lib/password");
const { idleActionResult } = await import("@/lib/action-result");

const CURRENT = TEST_ACCOUNTS.admin.password;
const STRONG = "Poireau vinaigrette du jeudi";

function run(fields: Record<string, string>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.append(k, v);
  return changeOwnPassword(idleActionResult, data);
}

beforeEach(() => reopenSession.mockReset());

describe("changeOwnPassword", () => {
  it("refuse un mot de passe actuel faux sans rien changer", async () => {
    expect(
      await run({
        currentPassword: "Pas-le-bon-mdp-123",
        newPassword: STRONG,
        confirmPassword: STRONG,
      }),
    ).toEqual({
      status: "error",
      message: "Le mot de passe actuel est incorrect.",
    });
    const account = await findUserById("usr-0001");
    expect(await verifyPassword(CURRENT, account!.passwordHash!)).toBe(true);
    expect(reopenSession).not.toHaveBeenCalled();
  });

  it("refuse une confirmation différente et un mot de passe contraire à la politique", async () => {
    expect(
      (
        await run({
          currentPassword: CURRENT,
          newPassword: STRONG,
          confirmPassword: "Autre-mot-de-passe-9",
        })
      ).status,
    ).toBe("error");
    const common = await run({
      currentPassword: CURRENT,
      newPassword: "Motdepasse2026!",
      confirmPassword: "Motdepasse2026!",
    });
    expect(common.status).toBe("error");
    if (common.status === "error") expect(common.message).toMatch(/courant/);
    const personal = await run({
      currentPassword: CURRENT,
      newPassword: "Admin E2E pour toujours",
      confirmPassword: "Admin E2E pour toujours",
    });
    expect(personal.status).toBe("error");
    if (personal.status === "error") {
      expect(personal.message).toMatch(/ni votre nom/);
    }
  });

  it("enregistre le nouveau mot de passe quand l'actuel est bon, et rouvre la session", async () => {
    expect(
      await run({
        currentPassword: CURRENT,
        newPassword: STRONG,
        confirmPassword: STRONG,
      }),
    ).toEqual({
      status: "success",
      message: "Mot de passe modifié. Vos autres sessions sont fermées.",
    });
    const account = await findUserById("usr-0001");
    expect(await verifyPassword(STRONG, account!.passwordHash!)).toBe(true);
    expect(account?.passwordChangedAt).not.toBeNull();
    expect(reopenSession).toHaveBeenCalledWith(
      TEST_ACCOUNTS.admin.email,
      STRONG,
    );
  });
});
